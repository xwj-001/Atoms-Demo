"""
自建账号体系下的作品数据接口。

替代原先通过平台实体 SDK 直接读写 studio_apps 的方式：
数据归属改为自建账号（studio_apps.user_id 存 `studio:<id>`），
所有写操作都强制校验归属，避免越权改删他人作品。
"""

import logging
from typing import Any, Dict, List, Optional

from core.database import get_db
from dependencies.studio_auth import get_current_account, get_optional_account
from fastapi import APIRouter, Depends, HTTPException, Query, status
from models.studio_accounts import Studio_accounts
from models.studio_apps import Studio_apps
from pydantic import BaseModel, Field
from services.studio_auth import owner_key
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/studio-data", tags=["studio-data"])

# 单次拉取上限，避免一次返回过多大字段记录
MAX_LIST_LIMIT = 100
MAX_GALLERY_LIMIT = 60


class AppPayload(BaseModel):
    """前端上传的作品数据；versions_json 为压缩后的版本数组。"""

    local_id: int = Field(0, description="本地 IndexedDB 主键，用于去重")
    name: str
    description: str = ""
    style: str = "modern"
    versions_json: str
    current_version_index: int = 0
    version_count: int = 0
    tags: str = ""
    is_public: bool = False


class AppRow(BaseModel):
    id: int
    user_id: str
    local_id: Optional[int] = None
    name: str
    description: str = ""
    style: str = "modern"
    versions_json: str
    current_version_index: int = 0
    version_count: Optional[int] = None
    tags: Optional[str] = None
    is_public: Optional[bool] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AppListResponse(BaseModel):
    items: List[AppRow]


class DeleteResponse(BaseModel):
    id: int
    deleted: bool


def to_row(record: Studio_apps) -> AppRow:
    return AppRow(
        id=record.id,
        user_id=record.user_id,
        local_id=record.local_id,
        name=record.name,
        description=record.description or "",
        style=record.style or "modern",
        versions_json=record.versions_json,
        current_version_index=record.current_version_index or 0,
        version_count=record.version_count,
        tags=record.tags,
        is_public=bool(record.is_public),
        created_at=record.created_at.isoformat() if record.created_at else None,
        updated_at=record.updated_at.isoformat() if record.updated_at else None,
    )


def apply_payload(record: Studio_apps, payload: AppPayload, owner: str) -> None:
    """把请求体写入 ORM 对象；created_at / updated_at 由模型自动维护。"""
    record.user_id = owner
    record.local_id = payload.local_id or None
    record.name = payload.name or "未命名应用"
    record.description = payload.description or ""
    record.style = payload.style or "modern"
    record.versions_json = payload.versions_json
    record.current_version_index = max(0, payload.current_version_index)
    record.version_count = payload.version_count or 0
    record.tags = payload.tags or ""
    record.is_public = bool(payload.is_public)


async def load_owned(db: AsyncSession, app_id: int, owner: str) -> Studio_apps:
    """按 ID 加载作品并校验归属，越权时返回 404 而不泄露记录是否存在。"""
    result = await db.execute(select(Studio_apps).where(Studio_apps.id == app_id))
    record = result.scalars().first()
    if not record or record.user_id != owner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="作品不存在或无权访问")
    return record


@router.get("/apps", response_model=AppListResponse)
async def list_my_apps(
    limit: int = Query(MAX_LIST_LIMIT, ge=1, le=MAX_LIST_LIMIT),
    account: Studio_accounts = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
) -> AppListResponse:
    """拉取当前账号的全部作品，供云端同步下行使用。"""
    owner = owner_key(account.id)
    result = await db.execute(
        select(Studio_apps)
        .where(Studio_apps.user_id == owner)
        .order_by(Studio_apps.created_at.desc())
        .limit(limit)
    )
    return AppListResponse(items=[to_row(item) for item in result.scalars().all()])


@router.post("/apps", response_model=AppRow, status_code=status.HTTP_201_CREATED)
async def create_app(
    payload: AppPayload,
    account: Studio_accounts = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
) -> AppRow:
    """新增作品；同一账号下 local_id 已存在时改为更新，保证同步幂等。"""
    owner = owner_key(account.id)

    if payload.local_id:
        existing = await db.execute(
            select(Studio_apps).where(
                Studio_apps.user_id == owner, Studio_apps.local_id == payload.local_id
            )
        )
        found = existing.scalars().first()
        if found:
            apply_payload(found, payload, owner)
            await db.commit()
            return to_row(found)

    record = Studio_apps()
    apply_payload(record, payload, owner)
    db.add(record)
    await db.commit()
    return to_row(record)


@router.put("/apps/{app_id}", response_model=AppRow)
async def update_app(
    app_id: int,
    payload: AppPayload,
    account: Studio_accounts = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
) -> AppRow:
    """更新自己的作品。"""
    owner = owner_key(account.id)
    record = await load_owned(db, app_id, owner)
    apply_payload(record, payload, owner)
    await db.commit()
    return to_row(record)


@router.delete("/apps/{app_id}", response_model=DeleteResponse)
async def delete_app(
    app_id: int,
    account: Studio_accounts = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
) -> DeleteResponse:
    """删除自己的作品。"""
    owner = owner_key(account.id)
    record = await load_owned(db, app_id, owner)
    await db.delete(record)
    await db.commit()
    return DeleteResponse(id=app_id, deleted=True)


@router.get("/gallery", response_model=AppListResponse)
async def gallery(
    limit: int = Query(MAX_GALLERY_LIMIT, ge=1, le=MAX_GALLERY_LIMIT),
    account: Optional[Studio_accounts] = Depends(get_optional_account),
    db: AsyncSession = Depends(get_db),
) -> AppListResponse:
    """灵感画廊：读取所有账号公开的作品，未登录也可浏览。"""
    result = await db.execute(
        select(Studio_apps)
        .where(Studio_apps.is_public.is_(True))
        .order_by(Studio_apps.created_at.desc())
        .limit(limit)
    )
    rows = [to_row(item) for item in result.scalars().all()]

    # 标记哪些是当前账号自己的作品，便于前端展示「我的」标签
    current_owner = owner_key(account.id) if account else None
    payload: List[Dict[str, Any]] = []
    for row in rows:
        data = row.model_dump()
        data["user_id"] = row.user_id if row.user_id == current_owner else "others"
        payload.append(data)
    return AppListResponse(items=[AppRow(**item) for item in payload])