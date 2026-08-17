"""
自建账号的鉴权依赖。

令牌通过 `X-Studio-Token` 请求头传递，而不是复用 `Authorization`，
这样自建体系与平台鉴权可以并存互不干扰（例如后端仍可继续使用平台能力）。
"""

import logging
from typing import Optional

from core.auth import AccessTokenError, decode_access_token
from core.database import get_db
from fastapi import Depends, Header, HTTPException, status
from models.studio_accounts import Studio_accounts
from services.studio_auth import TOKEN_TYPE, StudioAuthService, parse_owner_key
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

STUDIO_TOKEN_HEADER = "X-Studio-Token"


async def get_studio_token(x_studio_token: Optional[str] = Header(None, alias=STUDIO_TOKEN_HEADER)) -> str:
    token = (x_studio_token or "").strip()
    # 兼容前端可能带上的 Bearer 前缀
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="请先登录")
    return token


async def get_current_account(
    token: str = Depends(get_studio_token),
    db: AsyncSession = Depends(get_db),
) -> Studio_accounts:
    """解析自建令牌并加载账号，令牌无效 / 过期 / 账号已删除均返回 401。"""
    try:
        payload = decode_access_token(token)
    except AccessTokenError as exc:
        logger.info("Studio token rejected: %s", type(exc).__name__)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已过期，请重新登录")

    if payload.get("typ") != TOKEN_TYPE:
        # 平台令牌不能用于自建账号接口，防止身份混用
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录凭证无效，请重新登录")

    account_id = parse_owner_key(str(payload.get("sub") or ""))
    if account_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录凭证无效，请重新登录")

    account = await StudioAuthService(db).get_by_id(account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号不存在，请重新注册")
    return account


async def get_optional_account(
    x_studio_token: Optional[str] = Header(None, alias=STUDIO_TOKEN_HEADER),
    db: AsyncSession = Depends(get_db),
) -> Optional[Studio_accounts]:
    """可选鉴权：未登录时返回 None，用于公开数据接口标记归属。"""
    if not x_studio_token:
        return None
    try:
        token = await get_studio_token(x_studio_token)
        return await get_current_account(token=token, db=db)
    except HTTPException:
        return None