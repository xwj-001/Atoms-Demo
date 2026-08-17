"""LLM 代理服务。

atomsDemo 的后端只承担一个职责：把前端智能体流水线的 LLM 请求
转发给 Atoms Cloud 的 AIHub，避免在浏览器暴露任何 API Key。

业务数据（用户 / 项目 / 版本）全部由前端 IndexedDB 负责，
本服务不接触数据库。
"""

from typing import Any, Dict, List, Optional

from schemas.aihub import ChatMessage, GenTxtRequest
from services.aihub import AIHubService

# 文本 / 代码生成统一使用的模型
DEFAULT_MODEL = "claude-opus-5"

ALLOWED_ROLES = {"system", "user", "assistant"}


class LLMProxyService:
    """把前端传入的对话消息转发给 AIHub，并返回完整文本。"""

    def __init__(self) -> None:
        self._aihub = AIHubService()

    @staticmethod
    def _normalize_messages(messages: List[Dict[str, Any]]) -> List[ChatMessage]:
        normalized: List[ChatMessage] = []
        for item in messages:
            role = str(item.get("role") or "user").strip().lower()
            if role not in ALLOWED_ROLES:
                role = "user"
            content = item.get("content")
            if content is None:
                continue
            text = content if isinstance(content, str) else str(content)
            if not text.strip():
                continue
            normalized.append(ChatMessage(role=role, content=text))
        return normalized

    async def complete(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
    ) -> str:
        """非流式补全。

        流水线需要拿到完整输出后再做分隔符解析，因此这里刻意使用
        非流式调用，保证内容不会被截断。
        """
        payload = self._normalize_messages(messages)
        if not payload:
            raise ValueError("messages 不能为空")

        request = GenTxtRequest(
            messages=payload,
            model=(model or DEFAULT_MODEL),
        )
        response = await self._aihub.gentxt(request)
        content = getattr(response, "content", "") or ""
        return content.strip()