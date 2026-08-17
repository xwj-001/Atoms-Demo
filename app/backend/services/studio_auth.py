"""
自建邮箱 + 密码账号体系的服务层。

与平台账号体系完全独立：账号数据落在 studio_accounts 表，密码使用
PBKDF2-HMAC-SHA256 + 每账号独立随机盐值派生，数据库中不保存任何明文。

登录成功后签发本项目自有的 JWT，令牌主体形如 `studio:<id>`，并带上
`typ=studio_account` 标记，避免与平台令牌混用。
"""

import hashlib
import hmac
import logging
import re
import secrets
from datetime import datetime, timezone
from typing import Optional, Tuple

from core.auth import create_access_token
from models.studio_accounts import Studio_accounts
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# 迭代次数越高越难被暴力破解，10 万量级在服务端仍是毫秒级开销
PBKDF2_ITERATIONS = 200_000
PBKDF2_ALGORITHM = "sha256"
SALT_BYTES = 16

# 令牌主体前缀与类型标记，用于和平台令牌区分
TOKEN_SUBJECT_PREFIX = "studio"
TOKEN_TYPE = "studio_account"
# 自建体系的登录有效期：7 天，避免用户频繁被踢出
TOKEN_EXPIRE_MINUTES = 7 * 24 * 60

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128
MAX_DISPLAY_NAME_LENGTH = 40


class StudioAuthError(Exception):
    """业务可预期的认证错误，路由层据此返回对应状态码与中文提示。"""

    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def normalize_email(email: str) -> str:
    """邮箱统一小写去空格，保证唯一性判断不受大小写影响。"""
    return (email or "").strip().lower()


def validate_email(email: str) -> str:
    normalized = normalize_email(email)
    if not normalized:
        raise StudioAuthError("请填写邮箱地址")
    if len(normalized) > 120:
        raise StudioAuthError("邮箱地址过长")
    if not EMAIL_PATTERN.match(normalized):
        raise StudioAuthError("邮箱格式不正确")
    return normalized


def validate_password(password: str) -> str:
    """密码强度校验：长度 + 至少包含字母和数字，避免过弱口令。"""
    value = password or ""
    if len(value) < MIN_PASSWORD_LENGTH:
        raise StudioAuthError(f"密码至少需要 {MIN_PASSWORD_LENGTH} 位")
    if len(value) > MAX_PASSWORD_LENGTH:
        raise StudioAuthError("密码过长")
    if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
        raise StudioAuthError("密码需要同时包含字母和数字")
    return value


def derive_display_name(email: str, display_name: Optional[str] = None) -> str:
    """昵称缺省时取邮箱前缀，保证界面上总有可读身份。"""
    candidate = (display_name or "").strip()
    if candidate:
        return candidate[:MAX_DISPLAY_NAME_LENGTH]
    return normalize_email(email).split("@", 1)[0][:MAX_DISPLAY_NAME_LENGTH] or "用户"


def _derive_hash(password: str, salt_hex: str) -> str:
    """用给定盐值派生密码哈希，返回十六进制字符串。"""
    salt = bytes.fromhex(salt_hex)
    digest = hashlib.pbkdf2_hmac(PBKDF2_ALGORITHM, password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return digest.hex()


def hash_password(password: str) -> Tuple[str, str]:
    """生成 (哈希, 盐值)，每次注册都用全新随机盐。"""
    salt_hex = secrets.token_hex(SALT_BYTES)
    return _derive_hash(password, salt_hex), salt_hex


def verify_password(password: str, password_hash: str, salt_hex: str) -> bool:
    """定时安全比较，避免通过响应时间旁路推测哈希。"""
    if not password or not password_hash or not salt_hex:
        return False
    try:
        candidate = _derive_hash(password, salt_hex)
    except ValueError:
        # 盐值不是合法十六进制，视为数据损坏，直接拒绝
        logger.warning("Stored password salt is malformed; rejecting login")
        return False
    return hmac.compare_digest(candidate, password_hash)


def owner_key(account_id: int) -> str:
    """自建账号在业务表中的归属标识，与平台用户 ID 命名空间隔离。"""
    return f"{TOKEN_SUBJECT_PREFIX}:{account_id}"


def parse_owner_key(subject: str) -> Optional[int]:
    """从令牌主体解析账号自增 ID。"""
    if not subject or not subject.startswith(f"{TOKEN_SUBJECT_PREFIX}:"):
        return None
    raw = subject.split(":", 1)[1]
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


class StudioAuthService:
    """账号注册、登录、资料读取与改密。"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_email(self, email: str) -> Optional[Studio_accounts]:
        normalized = normalize_email(email)
        result = await self.db.execute(
            select(Studio_accounts).where(func.lower(Studio_accounts.email) == normalized)
        )
        return result.scalars().first()

    async def get_by_id(self, account_id: int) -> Optional[Studio_accounts]:
        result = await self.db.execute(select(Studio_accounts).where(Studio_accounts.id == account_id))
        return result.scalars().first()

    async def register(
        self, email: str, password: str, display_name: Optional[str] = None
    ) -> Studio_accounts:
        """注册新账号；邮箱已存在时返回 409。"""
        normalized_email = validate_email(email)
        validated_password = validate_password(password)

        if await self.get_by_email(normalized_email):
            raise StudioAuthError("该邮箱已注册，请直接登录", status_code=409)

        password_hash, password_salt = hash_password(validated_password)
        now_iso = datetime.now(timezone.utc).isoformat()
        account = Studio_accounts(
            email=normalized_email,
            password_hash=password_hash,
            password_salt=password_salt,
            display_name=derive_display_name(normalized_email, display_name),
            role="user",
            last_login_at=now_iso,
        )
        self.db.add(account)
        await self.db.commit()

        # 并发注册兜底：若同一邮箱产生了多条记录，保留最早的一条并提示重新登录
        duplicates = await self.db.execute(
            select(Studio_accounts.id)
            .where(func.lower(Studio_accounts.email) == normalized_email)
            .order_by(Studio_accounts.id.asc())
        )
        ids = [row[0] for row in duplicates.all()]
        if len(ids) > 1 and account.id != ids[0]:
            await self.db.delete(account)
            await self.db.commit()
            raise StudioAuthError("该邮箱已注册，请直接登录", status_code=409)

        logger.info("Studio account registered: id=%s", account.id)
        return account

    async def authenticate(self, email: str, password: str) -> Studio_accounts:
        """校验邮箱密码；失败时统一提示，不暴露邮箱是否存在。"""
        normalized_email = normalize_email(email)
        if not normalized_email or not password:
            raise StudioAuthError("请填写邮箱和密码", status_code=401)

        account = await self.get_by_email(normalized_email)
        if not account or not verify_password(password, account.password_hash, account.password_salt):
            raise StudioAuthError("邮箱或密码不正确", status_code=401)

        account.last_login_at = datetime.now(timezone.utc).isoformat()
        await self.db.commit()
        logger.info("Studio account logged in: id=%s", account.id)
        return account

    async def change_password(
        self, account: Studio_accounts, current_password: str, new_password: str
    ) -> None:
        """改密要求先校验旧密码，并强制新旧不同。"""
        if not verify_password(current_password, account.password_hash, account.password_salt):
            raise StudioAuthError("当前密码不正确", status_code=401)

        validated = validate_password(new_password)
        if verify_password(validated, account.password_hash, account.password_salt):
            raise StudioAuthError("新密码不能与当前密码相同")

        password_hash, password_salt = hash_password(validated)
        account.password_hash = password_hash
        account.password_salt = password_salt
        await self.db.commit()
        logger.info("Studio account password changed: id=%s", account.id)

    def issue_token(self, account: Studio_accounts) -> Tuple[str, int]:
        """签发自有 JWT，返回 (令牌, 有效期秒数)。"""
        claims = {
            "sub": owner_key(account.id),
            "typ": TOKEN_TYPE,
            "email": account.email,
            "name": account.display_name or "",
            "role": account.role or "user",
        }
        token = create_access_token(claims, expires_minutes=TOKEN_EXPIRE_MINUTES)
        return token, TOKEN_EXPIRE_MINUTES * 60