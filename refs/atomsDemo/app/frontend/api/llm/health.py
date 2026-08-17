"""
Vercel Serverless Function: 健康检查
"""

import json

DEFAULT_MODEL = "glm-5.2"


def handler(request):
    """健康检查接口"""
    return {
        "statusCode": 200,
        "body": json.dumps({"status": "ok", "model": DEFAULT_MODEL}),
        "headers": {"Content-Type": "application/json"},
    }
