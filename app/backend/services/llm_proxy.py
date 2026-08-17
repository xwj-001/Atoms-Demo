"""
LLM 代理服务。

该服务只承担一个职责：把前端的生成请求转发给平台的 AI 能力（AIHub），
让模型凭据始终留在后端，浏览器侧不持有任何 API Key。

入口处统一做三件事，避免前端传入异常参数导致整轮生成白跑：
1. 角色归一化：只允许 system / user / assistant，非法角色按 user 处理；
2. 空内容过滤与单条预算截断，防止上游直接返回 400 或上下文超限；
3. 模型白名单校验，非法或缺省模型回落到默认模型。

本服务不接触数据库，业务数据仍由前端 IndexedDB 负责。
"""

import logging
from typing import Iterable, List, Optional, Sequence, Tuple

from schemas.aihub import ChatMessage, GenTxtRequest
from schemas.llm_proxy import LLMCompleteResponse, ProxyMessage
from services.aihub import AIHubService

logger = logging.getLogger(__name__)

# 默认模型：与前端 atoms 模式保持一致
DEFAULT_MODEL = "gpt-5.6-sol"

# 允许前端指定的模型白名单，防止浏览器侧任意选择模型消耗额度。
# 需与前端 `src/lib/settings.ts` 的 ATOMS_MODELS 保持一致：
# 前端只提供白名单内的可选项，后端再做一次裁决，非白名单一律回落默认模型。
MODEL_WHITELIST: frozenset[str] = frozenset(
    {
        "gpt-5.6-sol",  # 综合均衡，默认模型
        "claude-opus-5",  # 代码能力最强，复杂改写优先
        "deepseek-v4-pro",  # 纯文本、性价比高，适合频繁迭代
        "gemini-2.5-pro",  # 生产级通用
        "gemini-3.1-pro-preview",  # 超长上下文
    }
)

ALLOWED_ROLES: frozenset[str] = frozenset({"system", "user", "assistant"})

# 单条消息字符预算，超出即截断并标注，避免上下文无限膨胀
MAX_CONTENT_CHARS = 24_000
# 单次请求最多保留的消息条数（system 优先保留，其余取最近的）
MAX_MESSAGES = 24

DEFAULT_MAX_TOKENS = 16_000
MAX_TOKENS_LIMIT = 32_000
MIN_MAX_TOKENS = 256
DEFAULT_TEMPERATURE = 0.7

TRUNCATE_MARK = "\n/* …内容过长已截断，未展示部分保持不变 */"


class LLMProxyService:
    """把前端传入的对话消息转发给 AIHub，并返回完整文本。"""

    def __init__(self) -> None:
        self._aihub = AIHubService()

    # ------------------------------ 入口清洗 ------------------------------

    @staticmethod
    def resolve_model(model: Optional[str]) -> Tuple[str, bool]:
        """解析模型名，返回 (生效模型, 是否发生回落)。"""
        candidate = (model or "").strip()
        if not candidate:
            return DEFAULT_MODEL, False
        if candidate in MODEL_WHITELIST:
            return candidate, False
        logger.warning("Rejected non-whitelisted model %r, falling back to %s", candidate, DEFAULT_MODEL)
        return DEFAULT_MODEL, True

    @staticmethod
    def _normalize_role(role: object) -> str:
        """归一化角色，非法角色统一按 user 处理。"""
        normalized = str(role or "user").strip().lower()
        return normalized if normalized in ALLOWED_ROLES else "user"

    @staticmethod
    def _clip(text: str) -> Tuple[str, bool]:
        """按单条预算截断，返回 (文本, 是否被截断)。"""
        if len(text) <= MAX_CONTENT_CHARS:
            return text, False
        return text[:MAX_CONTENT_CHARS] + TRUNCATE_MARK, True

    @staticmethod
    def _limit_count(messages: Sequence[ChatMessage]) -> List[ChatMessage]:
        """
        限制消息条数：system 指令必须保留，其余保留最近的若干条。
        """
        if len(messages) <= MAX_MESSAGES:
            return list(messages)
        systems = [m for m in messages if m.role == "system"]
        others = [m for m in messages if m.role != "system"]
        keep = max(MAX_MESSAGES - len(systems), 1)
        return systems + others[-keep:]

    @classmethod
    def normalize_messages(
        cls, messages: Iterable[ProxyMessage]
    ) -> Tuple[List[ChatMessage], int, int]:
        """
        清洗前端消息，返回 (归一化消息, 丢弃条数, 截断条数)。

        丢弃规则：content 为空或只含空白的消息直接丢掉，
        因为上游对空消息会直接报错，提前拦掉比让整轮生成失败更划算。
        """
        normalized: List[ChatMessage] = []
        dropped = 0
        truncated = 0

        for item in messages:
            raw = item.content if isinstance(item.content, str) else str(item.content or "")
            text = raw.strip()
            if not text:
                dropped += 1
                continue
            clipped, was_clipped = cls._clip(text)
            if was_clipped:
                truncated += 1
            normalized.append(ChatMessage(role=cls._normalize_role(item.role), content=clipped))

        return cls._limit_count(normalized), dropped, truncated

    @staticmethod
    def _clamp_max_tokens(value: Optional[int]) -> int:
        if value is None:
            return DEFAULT_MAX_TOKENS
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return DEFAULT_MAX_TOKENS
        return max(MIN_MAX_TOKENS, min(MAX_TOKENS_LIMIT, parsed))

    @staticmethod
    def _clamp_temperature(value: Optional[float]) -> float:
        if value is None:
            return DEFAULT_TEMPERATURE
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return DEFAULT_TEMPERATURE
        return max(0.0, min(2.0, parsed))

    # ------------------------------ 对外能力 ------------------------------

    async def complete(
        self,
        messages: Iterable[ProxyMessage],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> LLMCompleteResponse:
        """
        非流式补全。

        调用方（生成流水线的定向修复环节）需要拿到完整输出后再按分隔符解析，
        因此这里刻意使用非流式调用，保证内容不会因连接中断而被截断。
        """
        payload, dropped, truncated = self.normalize_messages(messages)
        if not payload:
            raise ValueError("messages 不能为空：所有消息内容均为空白已被丢弃。")

        resolved_model, fallback = self.resolve_model(model)

        request = GenTxtRequest(
            messages=payload,
            model=resolved_model,
            stream=False,
            temperature=self._clamp_temperature(temperature),
            max_tokens=self._clamp_max_tokens(max_tokens),
        )
        response = await self._aihub.gentxt(request)
        content = (getattr(response, "content", "") or "").strip()
        if not content:
            raise RuntimeError("模型返回内容为空，请稍后重试。")

        return LLMCompleteResponse(
            content=content,
            model=resolved_model,
            model_fallback=fallback,
            dropped_messages=dropped,
            truncated_messages=truncated,
        )