/**
 * 腾讯云 CloudBase 云函数：健康检查
 */

const DEFAULT_MODEL = 'glm-5.2';

exports.main = async (event) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'ok', model: DEFAULT_MODEL }),
  };
};
