"""
LLM 代理模块的请求 / 响应模型。

代理层的职责是替前端持有模型凭据，因此入口必须对前端传入的
消息与模型做严格约束，避免浏览器侧决定调用哪个模型、花多少额度。
"""

from typing import List, Optional

from pydantic import BaseModel, Field


class ProxyMessage(BaseModel):
    """前端传入的单条对话消息（仅支持纯文本）。"""

    role: str = Field(default="user", description="消息角色：system / user / assistant。")
    content: str = Field(default="", description="消息文本内容。")


class LLMCompleteRequest(BaseModel):
    """非流式补全请求。"""

    messages: List[ProxyMessage] = Field(..., description="对话消息列表。")
    model: Optional[str] = Field(
        default=None,
        description="可选模型名，必须在服务端白名单内；非法或缺省时回落到默认模型。",
    )
    temperature: Optional[float] = Field(default=None, description="采样温度，服务端会做区间钳制。")
    max_tokens: Optional[int] = Field(default=None, description="最大生成 token 数，服务端会做区间钳制。")


class LLMCompleteResponse(BaseModel):
    """非流式补全响应。"""

    content: str = Field(..., description="模型生成的完整文本。")
    model: str = Field(..., description="实际生效的模型名。")
    model_fallback: bool = Field(
        default=False,
        description="请求模型不在白名单内、已回落到默认模型时为 true。",
    )
    dropped_messages: int = Field(default=0, description="因内容为空而被丢弃的消息条数。")
    truncated_messages: int = Field(default=0, description="因超出单条预算而被截断的消息条数。")