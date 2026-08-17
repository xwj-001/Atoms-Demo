"""
DeepSeek 代理服务。

用户自备 DeepSeek 账号，但密钥绝不能落到浏览器：前端只发业务消息，
由本服务读取运行时环境变量 `DEEPSEEK_API_KEY` 后转发到 DeepSeek 的
OpenAI 兼容接口 `/v1/chat/completions`。

入口清洗（角色归一化、空消息过滤、单条预算截断、条数上限）直接复用
`LLMProxyService` 的实现，避免两套代理出现行为差异。

模型策略：
- 默认使用 `deepseek-v4-flash`；
- 只接受 `deepseek-` 前缀的模型名，防止前端借这条通道调用别的上游模型；
- 上游若判定模型不存在，自动改用 `deepseek-chat` 重试一次并在响应里标注回落，
  这样即便默认模型名尚未在账号上开通，生成链路也不会整轮失败。
"""

import logging
import os
from typing import Any, Dict, Iterable, List, Optional, Tuple

import httpx
from schemas.llm_proxy import DeepSeekStatusResponse, LLMCompleteResponse, ProxyMessage
from services.llm_proxy import LLMProxyService

logger = logging.getLogger(__name__)

# DeepSeek 官方端点。可用环境变量覆盖，便于切换到自建网关。
DEFAULT_BASE_URL = "https://api.deepseek.com"

# 默认模型：与前端 `src/lib/settings.ts` 的 DEEPSEEK_MODEL 保持一致
DEFAULT_MODEL = "deepseek-v4-flash"

# 上游拒绝默认模型时的兜底模型（DeepSeek 长期可用的通用对话模型）
FALLBACK_MODEL = "deepseek-chat"

# 只允许 deepseek 系列模型走这条通道
MODEL_PREFIX = "deepseek-"

# 单文件应用生成属于长输出，超时给足
REQUEST_TIMEOUT = 600.0

DEFAULT_MAX_TOKENS = 16_000
MAX_TOKENS_LIMIT = 32_000
MIN_MAX_TOKENS = 256
DEFAULT_TEMPERATURE = 0.7

# 上游错误文本里出现这些关键词时，判定为「模型名不被接受」
MODEL_ERROR_HINTS = ("model", "模型")


class DeepSeekProxyService:
    """把前端对话消息转发给 DeepSeek，并返回完整文本。"""

    def __init__(self) -> None:
        self._api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
        self._base_url = self._normalize_base_url(
            os.environ.get("DEEPSEEK_BASE_URL") or DEFAULT_BASE_URL
        )

    # ------------------------------ 基础信息 ------------------------------

    @staticmethod
    def _normalize_base_url(raw: str) -> str:
        """
        归一化 Base URL：去掉末尾斜杠，并补齐 `/v1` 版本段。

        用户填 `https://api.deepseek.com` 或 `https://api.deepseek.com/v1`
        都应该能正确拼出 `/v1/chat/completions`。
        """
        base = (raw or DEFAULT_BASE_URL).strip().rstrip("/")
        if not base:
            base = DEFAULT_BASE_URL
        if not base.endswith("/v1"):
            base = f"{base}/v1"
        return base

    @property
    def configured(self) -> bool:
        """密钥是否已注入运行时环境。"""
        return bool(self._api_key)

    def status(self) -> DeepSeekStatusResponse:
        """
        供前端探测通道可用性。

        只返回是否配置与端点/默认模型，绝不回显密钥本身。
        """
        return DeepSeekStatusResponse(
            configured=self.configured,
            base_url=self._base_url,
            default_model=DEFAULT_MODEL,
        )

    # ------------------------------ 入参清洗 ------------------------------

    @staticmethod
    def resolve_model(model: Optional[str]) -> Tuple[str, bool]:
        """解析模型名，返回 (生效模型, 是否发生回落)。"""
        candidate = (model or "").strip()
        if not candidate:
            return DEFAULT_MODEL, False
        if candidate.startswith(MODEL_PREFIX):
            return candidate, False
        logger.warning(
            "Rejected non-deepseek model %r on deepseek channel, falling back to %s",
            candidate,
            DEFAULT_MODEL,
        )
        return DEFAULT_MODEL, True

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

    # ------------------------------ 上游调用 ------------------------------

    @staticmethod
    def _looks_like_model_error(status_code: int, detail: str) -> bool:
        """判断上游报错是否由模型名引起，用于决定是否兜底重试。"""
        if status_code not in (400, 404, 422):
            return False
        lowered = detail.lower()
        return any(hint in lowered for hint in MODEL_ERROR_HINTS)

    async def _post_chat(
        self,
        client: httpx.AsyncClient,
        payload: Dict[str, Any],
    ) -> Tuple[Optional[str], int, str]:
        """
        调用一次 `/chat/completions`。

        返回 (文本内容, 状态码, 错误详情)。成功时错误详情为空字符串。
        """
        response = await client.post(
            f"{self._base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

        if response.status_code != 200:
            detail = (response.text or "").strip()[:400]
            return None, response.status_code, detail

        try:
            data = response.json()
        except ValueError:
            return None, response.status_code, "上游返回的内容不是合法 JSON"

        choices = data.get("choices") or []
        message = (choices[0].get("message") or {}) if choices else {}
        content = (message.get("content") or "").strip()
        return content, response.status_code, ""

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

        生成链路需要按分隔符/补丁标记严格切分输出，非流式可以保证
        拿到的是完整文本，不会因连接中断而解析降级。
        """
        if not self.configured:
            raise ValueError(
                "DEEPSEEK_API_KEY 未配置，无法调用 DeepSeek。请在平台密钥配置中补齐后重试。"
            )

        payload_messages, dropped, truncated = LLMProxyService.normalize_messages(messages)
        if not payload_messages:
            raise ValueError("messages 不能为空：所有消息内容均为空白已被丢弃。")

        resolved_model, fallback = self.resolve_model(model)
        body: Dict[str, Any] = {
            "model": resolved_model,
            "stream": False,
            "temperature": self._clamp_temperature(temperature),
            "max_tokens": self._clamp_max_tokens(max_tokens),
            "messages": [{"role": m.role, "content": m.content} for m in payload_messages],
        }

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            content, status_code, detail = await self._post_chat(client, body)

            # 默认模型未开通时不要让整轮生成失败，换通用模型再试一次
            if (
                content is None
                and resolved_model != FALLBACK_MODEL
                and self._looks_like_model_error(status_code, detail)
            ):
                logger.warning(
                    "DeepSeek rejected model %r (%s), retrying with %s",
                    resolved_model,
                    status_code,
                    FALLBACK_MODEL,
                )
                resolved_model = FALLBACK_MODEL
                fallback = True
                body["model"] = FALLBACK_MODEL
                content, status_code, detail = await self._post_chat(client, body)

        if content is None:
            raise RuntimeError(
                f"DeepSeek 接口返回 {status_code}" + (f"：{detail}" if detail else "")
            )
        if not content:
            raise RuntimeError("DeepSeek 返回内容为空，请稍后重试。")

        return LLMCompleteResponse(
            content=content,
            model=resolved_model,
            model_fallback=fallback,
            dropped_messages=dropped,
            truncated_messages=truncated,
        )