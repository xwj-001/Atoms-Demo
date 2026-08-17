/**
 * 会话层：Atoms Studio 支持两种身份。
 * - atoms：Atoms Cloud 正式账号，可云端同步 + 灵感画廊
 * - guest：本地游客会话，仅使用本地 IndexedDB，不触发任何云端请求
 * 未建立任何会话时，整个 Demo 的功能入口都不可用。
 */
const GUEST_KEY = 'atoms-studio-guest-session';

export interface GuestSession {
  id: string;
  createdAt: number;
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

/** 读取本地游客会话，损坏或不存在时返回 null */
export function loadGuestSession(): GuestSession | null {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestSession>;
    if (typeof parsed?.id !== 'string' || !parsed.id) return null;
    return {
      id: parsed.id,
      createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
    };
  } catch {
    return null;
  }
}

/** 建立游客会话（已存在则复用，保证本地作品归属稳定） */
export function startGuestSession(): GuestSession {
  const existing = loadGuestSession();
  if (existing) return existing;
  const session: GuestSession = { id: `guest-${randomId()}`, createdAt: Date.now() };
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(session));
  } catch {
    /* localStorage 不可用时退化为内存会话 */
  }
  return session;
}

export function clearGuestSession(): void {
  try {
    localStorage.removeItem(GUEST_KEY);
  } catch {
    /* 忽略 */
  }
}

/** 游客昵称：便于在账户菜单里展示可识别的身份 */
export function guestDisplayName(session: GuestSession): string {
  return `游客 ${session.id.replace('guest-', '').toUpperCase()}`;
}