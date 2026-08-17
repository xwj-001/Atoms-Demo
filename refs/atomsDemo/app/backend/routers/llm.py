"""LLM 代理路由。

前端通过 `client.apiCall.invoke` 调用本路由完成所有 LLM 请求，
API Key 只存在于服务端。
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.llm_proxy import DEFAULT_MODEL, LLMProxyService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/llm", tags=["llm"])


class ProxyMessage(BaseModel):
    role: str = Field(default="user", description="system / user / assistant")
    content: str = Field(default="", description="消息正文")


class CompleteRequest(BaseModel):
    messages: List[ProxyMessage] = Field(default_factory=list)
    model: Optional[str] = Field(default=None, description="可选，默认 claude-opus-5")


class CompleteResponse(BaseModel):
    content: str
    model: str


@router.post("/complete", response_model=CompleteResponse)
async def complete(payload: CompleteRequest) -> CompleteResponse:
    """一次性返回完整补全文本（非流式）。"""
    if not payload.messages:
        raise HTTPException(status_code=400, detail="messages 不能为空")

    service = LLMProxyService()
    model = payload.model or DEFAULT_MODEL

    try:
        content = await service.complete(
            [message.model_dump() for message in payload.messages],
            model,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - 需要把底层异常转成可读错误
        logger.exception("LLM 代理调用失败")
        raise HTTPException(status_code=502, detail=f"LLM 调用失败：{exc}") from exc

    if not content:
        raise HTTPException(status_code=502, detail="LLM 返回内容为空，请重试")

    return CompleteResponse(content=content, model=model)


@router.get("/health")
async def health() -> dict:
    """供前端探测代理是否可用。"""
    return {"status": "ok", "model": DEFAULT_MODEL}