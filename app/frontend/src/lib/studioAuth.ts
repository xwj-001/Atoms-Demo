/**
 * 自建邮箱 + 密码账号体系的前端客户端。
 *
 * 与平台账号体系无关：令牌由本项目后端签发，存在 localStorage，
 * 每次请求通过 X-Studio-Token 头携带；令牌过期会自动清理并回到登录门。
 *
 * 请求统一走 web-sdk 的 apiCall 通道，而不是自己拼 Base URL 的 axios。
 * 之前直连 `getAPIBaseURL()` 时，运行时配置尚未加载完会退回本机地址
 * `http://127.0.0.1:8000`，在预览与线上环境下必然请求失败，
 * 表现就是「登录失败 / 注册失败」。
 */
import { createClient } from '@metagptx/web-sdk';

const client = createClient();

const TOKEN_KEY = 'atoms-studio-token';
const ACCOUNT_KEY = 'atoms-studio-account';

/** 单次请求超时：认证接口用 PBKDF2 派生密码，留足余量 */
const REQUEST_TIMEOUT = 30_000;

export interface StudioAccount {
  id: string;
  email: string;
  name: string;
  role: string;
  lastLoginAt?: string;
}

interface RawAccount {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  last_login_at?: string;
}

interface AuthTokenPayload {
  token?: string;
  expires_in?: number;
  account?: RawAccount;
}

function normalizeAccount(raw: RawAccount | undefined): StudioAccount | null {
  if (!raw?.id || !raw.email) return null;
  return {
    id: String(raw.id),
    email: String(raw.email),
    name: raw.name ? String(raw.name) : String(raw.email).split('@')[0],
    role: raw.role ? String(raw.role) : 'user',
    lastLoginAt: raw.last_login_at ? String(raw.last_login_at) : undefined,
  };
}

/** 读取本地缓存的令牌 */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** 读取本地缓存的账号，用于首屏先渲染再后台校验 */
export function getCachedAccount(): StudioAccount | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return null;
    return normalizeAccount(JSON.parse(raw) as RawAccount);
  } catch {
    return null;
  }
}

function persistSession(token: string, account: StudioAccount): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(
      ACCOUNT_KEY,
      JSON.stringify({
        id: account.id,
        email: account.email,
        name: account.name,
        role: account.role,
        last_login_at: account.lastLoginAt,
      }),
    );
  } catch {
    /* 存储不可用时退化为仅内存会话 */
  }
}

/** 清除本地会话（退出登录或令牌失效） */
export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    /* 忽略 */
  }
}

/* ------------------------------ 错误处理 ------------------------------ */

interface ApiError {
  status?: number;
  message?: string;
  data?: { detail?: unknown };
  response?: { status?: number; data?: { detail?: unknown } };
}

/** 从 detail 里提取可直接展示的中文提示（兼容 FastAPI 校验错误数组） */
function pickDetail(detail: unknown): string | null {
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: string };
    if (first?.msg) return String(first.msg);
  }
  return null;
}

function toMessage(error: unknown, fallback: string): string {
  const err = error as ApiError;
  return (
    pickDetail(err?.data?.detail) ||
    pickDetail(err?.response?.data?.detail) ||
    (err?.message && err.message !== 'Network Error' ? err.message : null) ||
    fallback
  );
}

function statusOf(error: unknown): number | undefined {
  const err = error as ApiError;
  return err?.response?.status ?? err?.status;
}

/* ------------------------------ 请求封装 ------------------------------ */

async function request<T>(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  body?: unknown,
  fallbackMessage = '请求失败，请稍后重试',
): Promise<T> {
  const token = getToken();
  try {
    const response = await client.apiCall.invoke({
      url: path,
      method: method.toUpperCase(),
      data: body ?? {},
      options: {
        timeout: REQUEST_TIMEOUT,
        headers: token ? { 'X-Studio-Token': token } : {},
      },
    });
    return (response?.data ?? {}) as T;
  } catch (error) {
    if (statusOf(error) === 401 && token) {
      // 令牌过期或被吊销：清理本地会话，让首屏回到登录门
      clearSession();
    }
    throw new Error(toMessage(error, fallbackMessage));
  }
}

/** 已登录时用于业务接口的带鉴权请求 */
export async function authedRequest<T>(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  body?: unknown,
  fallbackMessage?: string,
): Promise<T> {
  return request<T>(method, path, body, fallbackMessage);
}

/** 注册并直接登录 */
export async function register(
  email: string,
  password: string,
  displayName?: string,
): Promise<StudioAccount> {
  const data = await request<AuthTokenPayload>(
    'post',
    '/api/v1/studio-auth/register',
    {
      email: email.trim().toLowerCase(),
      password,
      display_name: displayName?.trim() || undefined,
    },
    '注册失败，请检查网络后重试',
  );
  const account = normalizeAccount(data.account);
  if (!data.token || !account) throw new Error('注册返回数据异常，请重试');
  persistSession(data.token, account);
  return account;
}

/** 邮箱密码登录 */
export async function login(email: string, password: string): Promise<StudioAccount> {
  const data = await request<AuthTokenPayload>(
    'post',
    '/api/v1/studio-auth/login',
    { email: email.trim().toLowerCase(), password },
    '登录失败，请检查网络后重试',
  );
  const account = normalizeAccount(data.account);
  if (!data.token || !account) throw new Error('登录返回数据异常，请重试');
  persistSession(data.token, account);
  return account;
}

/** 首屏校验令牌是否仍然有效；无令牌或已失效均返回 null */
export async function fetchAccount(): Promise<StudioAccount | null> {
  if (!getToken()) return null;
  try {
    const data = await request<RawAccount>('get', '/api/v1/studio-auth/me');
    const account = normalizeAccount(data);
    if (!account) {
      clearSession();
      return null;
    }
    const token = getToken();
    if (token) persistSession(token, account);
    return account;
  } catch {
    // 网络抖动时不要把用户踢下线：令牌还在就先用本地缓存渲染
    return getToken() ? getCachedAccount() : null;
  }
}

/** 修改密码 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<string> {
  const data = await request<{ message?: string }>(
    'post',
    '/api/v1/studio-auth/change-password',
    { current_password: currentPassword, new_password: newPassword },
    '修改密码失败，请稍后重试',
  );
  return data.message || '密码已更新';
}

/** 退出登录：自建体系无需服务端跳转，直接清理本地令牌 */
export function logout(): void {
  clearSession();
}

/* ------------------------------ 前端预校验 ------------------------------ */

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return '请填写邮箱地址';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value)) return '邮箱格式不正确';
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return '密码至少需要 8 位';
  if (password.length > 128) return '密码过长';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return '密码需要同时包含字母和数字';
  return null;
}