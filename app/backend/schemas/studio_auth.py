"""自建账号体系的请求 / 响应模型。响应中永不包含密码哈希与盐值。"""

from typing import Optional

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    email: str = Field(..., description="登录邮箱")
    password: str = Field(..., description="登录密码，至少 8 位且含字母与数字")
    display_name: Optional[str] = Field(None, description="展示昵称，留空则取邮箱前缀")


class LoginRequest(BaseModel):
    email: str = Field(..., description="登录邮箱")
    password: str = Field(..., description="登录密码")


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., description="当前密码")
    new_password: str = Field(..., description="新密码，至少 8 位且含字母与数字")


class AccountResponse(BaseModel):
    """对外暴露的账号信息，仅含可公开字段。"""

    id: str
    email: str
    name: str
    role: str
    last_login_at: Optional[str] = None


class AuthTokenResponse(BaseModel):
    token: str
    expires_in: int
    account: AccountResponse


class SimpleMessageResponse(BaseModel):
    message: str