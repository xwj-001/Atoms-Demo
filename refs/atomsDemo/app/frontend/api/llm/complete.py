"""
Vercel Serverless Function: LLM 代理接口
支持智谱AI GLM 系列模型
"""

import json
import os

import requests

# 默认模型
DEFAULT_MODEL = "glm-5.2"

# 智谱AI API 地址
ZHIPU_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

# 允许的角色
ALLOWED_ROLES = {"system", "user", "assistant"}


def normalize_messages(messages):
    """标准化消息格式"""
    normalized = []
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
        normalized.append({"role": role, "content": text})
    return normalized


def handler(request):
    """Vercel Serverless Function 入口"""
    # 只允许 POST 请求
    if request.method != "POST":
        return {
            "statusCode": 405,
            "body": json.dumps({"error": "只支持 POST 请求"}),
            "headers": {"Content-Type": "application/json"},
        }

    # 解析请求体
    try:
        body = json.loads(request.body)
    except Exception:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "请求体格式错误"}),
            "headers": {"Content-Type": "application/json"},
        }

    messages = body.get("messages", [])
    model = body.get("model") or DEFAULT_MODEL

    if not messages:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "messages 不能为空"}),
            "headers": {"Content-Type": "application/json"},
        }

    # 获取 API Key
    api_key = os.environ.get("ZHIPU_API_KEY")
    if not api_key:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "未配置 ZHIPU_API_KEY 环境变量"}),
            "headers": {"Content-Type": "application/json"},
        }

    # 标准化消息
    normalized_messages = normalize_messages(messages)
    if not normalized_messages:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "有效消息不能为空"}),
            "headers": {"Content-Type": "application/json"},
        }

    # 调用智谱AI API
    try:
        response = requests.post(
            ZHIPU_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": normalized_messages,
                "temperature": 0.7,
            },
            timeout=60,
        )

        response.raise_for_status()
        result = response.json()

        # 提取回复内容
        content = ""
        if result.get("choices") and len(result["choices"]) > 0:
            content = result["choices"][0].get("message", {}).get("content", "")

        if not content:
            return {
                "statusCode": 502,
                "body": json.dumps({"error": "LLM 返回内容为空"}),
                "headers": {"Content-Type": "application/json"},
            }

        return {
            "statusCode": 200,
            "body": json.dumps({"content": content.strip(), "model": model}),
            "headers": {"Content-Type": "application/json"},
        }

    except requests.exceptions.Timeout:
        return {
            "statusCode": 504,
            "body": json.dumps({"error": "LLM 调用超时"}),
            "headers": {"Content-Type": "application/json"},
        }
    except Exception as e:
        return {
            "statusCode": 502,
            "body": json.dumps({"error": f"LLM 调用失败：{str(e)}"}),
            "headers": {"Content-Type": "application/json"},
        }
