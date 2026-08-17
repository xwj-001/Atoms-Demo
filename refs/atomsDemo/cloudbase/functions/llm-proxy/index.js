/**
 * 腾讯云 CloudBase 云函数：LLM 代理
 * 支持智谱AI GLM 系列模型
 */

const https = require('https');

// 默认模型
const DEFAULT_MODEL = 'glm-5.2';

// 智谱AI API 地址
const ZHIPU_API_HOST = 'open.bigmodel.cn';
const ZHIPU_API_PATH = '/api/paas/v4/chat/completions';

// 允许的角色
const ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);

/**
 * 标准化消息格式
 */
function normalizeMessages(messages) {
  const normalized = [];
  for (const item of messages) {
    let role = String(item.role || 'user').trim().toLowerCase();
    if (!ALLOWED_ROLES.has(role)) {
      role = 'user';
    }
    const content = item.content;
    if (content === null || content === undefined) continue;
    const text = typeof content === 'string' ? content : String(content);
    if (!text.trim()) continue;
    normalized.push({ role, content: text });
  }
  return normalized;
}

/**
 * 调用智谱AI API
 */
function callZhipuAI(messages, model, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model,
      messages,
      temperature: 0.7,
    });

    const options = {
      hostname: ZHIPU_API_HOST,
      path: ZHIPU_API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 60000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(new Error('解析响应失败'));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * 云函数入口
 */
exports.main = async (event) => {
  // 支持 HTTP 触发和云函数调用
  const body = event.body ? JSON.parse(event.body) : event;
  
  const messages = body.messages || [];
  const model = body.model || DEFAULT_MODEL;

  if (!messages || messages.length === 0) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'messages 不能为空' }),
    };
  }

  // 获取 API Key（从环境变量）
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '未配置 ZHIPU_API_KEY 环境变量' }),
    };
  }

  // 标准化消息
  const normalizedMessages = normalizeMessages(messages);
  if (normalizedMessages.length === 0) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '有效消息不能为空' }),
    };
  }

  try {
    const result = await callZhipuAI(normalizedMessages, model, apiKey);
    
    // 提取回复内容
    let content = '';
    if (result.choices && result.choices.length > 0) {
      content = result.choices[0].message?.content || '';
    }

    if (!content) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'LLM 返回内容为空' }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.trim(), model }),
    };

  } catch (error) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `LLM 调用失败：${error.message}` }),
    };
  }
};
