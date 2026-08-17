"""
自建账号体系的 API 路由：注册、登录、当前用户、修改密码。

所有响应都不包含密码哈希与盐值；错误提示统一使用中文并避免暴露邮箱是否存在。
"""

import logging

from core.database import get_db
from dependencies.studio_auth import get_current_account
from fastapi import APIRouter, Depends, HTTPException, status
from models.studio_accounts import Studio_accounts
from schemas.studio_auth import (
    AccountResponse,
    AuthTokenResponse,
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    SimpleMessageResponse,
)
from services.studio_auth import StudioAuthError, StudioAuthService, owner_key
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/studio-auth", tags=["studio-auth"])


def to_account_response(account: Studio_accounts) -> AccountResponse:
    return AccountResponse(
        id=owner_key(account.id),
        email=account.email,
        name=account.display_name or account.email.split("@", 1)[0],
        role=account.role or "user",
        last_login_at=account.last_login_at,
    )


@router.post("/register", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> AuthTokenResponse:
    """注册新账号并直接返回登录令牌，省去注册后再登录一次。"""
    service = StudioAuthService(db)
    try:
        account = await service.register(payload.email, payload.password, payload.display_name)
    except StudioAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        logger.error("Studio register failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="注册失败，请稍后重试"
        )

    token, expires_in = service.issue_token(account)
    return AuthTokenResponse(token=token, expires_in=expires_in, account=to_account_response(account))


@router.post("/login", response_model=AuthTokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> AuthTokenResponse:
    """邮箱密码登录。"""
    service = StudioAuthService(db)
    try:
        account = await service.authenticate(payload.email, payload.password)
    except StudioAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        logger.error("Studio login failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="登录失败，请稍后重试"
        )

    token, expires_in = service.issue_token(account)
    return AuthTokenResponse(token=token, expires_in=expires_in, account=to_account_response(account))


@router.get("/me", response_model=AccountResponse)
async def me(account: Studio_accounts = Depends(get_current_account)) -> AccountResponse:
    """读取当前登录账号，前端首屏据此恢复会话。"""
    return to_account_response(account)


@router.post("/change-password", response_model=SimpleMessageResponse)
async def change_password(
    payload: ChangePasswordRequest,
    account: Studio_accounts = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
) -> SimpleMessageResponse:
    """修改密码，需要校验当前密码。"""
    try:
        await StudioAuthService(db).change_password(account, payload.current_password, payload.new_password)
    except StudioAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        logger.error("Studio change password failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="修改密码失败，请稍后重试"
        )
    return SimpleMessageResponse(message="密码已更新，请使用新密码登录")