"""
LLM 代理路由。

前端只发业务消息，不携带任何模型凭据；密钥由平台在运行时注入后端环境。
所有入参在服务层统一做角色归一化、空消息过滤与模型白名单校验。
"""

import logging

from fastapi import APIRouter, HTTPException, status
from routers.aihub import extract_error_message
from schemas.llm_proxy import (
    DeepSeekStatusResponse,
    LLMCompleteRequest,
    LLMCompleteResponse,
)
from services.deepseek_proxy import DeepSeekProxyService
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


@router.get("/deepseek/status", response_model=DeepSeekStatusResponse)
async def deepseek_status() -> DeepSeekStatusResponse:
    """
    探测 DeepSeek 通道是否可用。

    只回报「是否已配置密钥」与端点/默认模型，密钥本身不下发到前端。
    """
    return DeepSeekProxyService().status()


@router.post("/deepseek/complete", response_model=LLMCompleteResponse)
async def deepseek_complete(request: LLMCompleteRequest) -> LLMCompleteResponse:
    """
    走用户自备 DeepSeek 账号的非流式补全。

    密钥由平台注入后端环境变量，浏览器侧只发业务消息。
    """
    try:
        service = DeepSeekProxyService()
        return await service.complete(
            messages=request.messages,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
    except ValueError as e:
        message = extract_error_message(e)
        if "messages" in str(e):
            logger.warning(f"Invalid DeepSeek proxy request: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
        logger.error(f"DeepSeek configuration error: {e}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=message)
    except Exception as e:
        logger.error(f"DeepSeek proxy completion failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=extract_error_message(e),
        )