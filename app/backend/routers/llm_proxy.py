"""
LLM 代理路由。

前端只发业务消息，不携带任何模型凭据；密钥由平台在运行时注入后端环境。
所有入参在服务层统一做角色归一化、空消息过滤与模型白名单校验。
"""

import logging

from fastapi import APIRouter, HTTPException, status
from routers.aihub import extract_error_message
from schemas.llm_proxy import LLMCompleteRequest, LLMCompleteResponse
from services.llm_proxy import LLMProxyService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/llm", tags=["llm"])


@router.post("/complete", response_model=LLMCompleteResponse)
async def complete(request: LLMCompleteRequest) -> LLMCompleteResponse:
    """
    非流式文本补全。

    用于需要严格解析完整输出的环节（例如按分隔符切分三文件产物的定向修复），
    非流式可避免末尾被截断而导致解析降级。
    """
    try:
        service = LLMProxyService()
        return await service.complete(
            messages=request.messages,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
    except ValueError as e:
        # 入参问题（消息全空、AI 服务未配置）与服务端故障区分开
        message = extract_error_message(e)
        if "messages" in str(e):
            logger.warning(f"Invalid LLM proxy request: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
        logger.error(f"AI service configuration error: {e}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=message)
    except Exception as e:
        logger.error(f"LLM proxy completion failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=extract_error_message(e),
        )