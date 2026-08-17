/**
 * 认证状态。
 *
 * 会话通过 zustand persist 存 localStorage，有效期 7 天；
 * 用户凭据（salt + 哈希）存 IndexedDB。访客模式不落项目数据。
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  GUEST_USER_ID,
  getUserById,
  loginUser,
  registerUser,
  type PublicUser,
} from '@/lib/db';
import { DEFAULT_LLM_SETTINGS, type LLMSettings } from '@/lib/llm/adapter';

const SESSION_DAYS = 7;
const SESSION_TTL = SESSION_DAYS * 24 * 60 * 60 * 1000;

export interface AuthState {
  user: PublicUser | null;
  isGuest: boolean;
  expiresAt: number;
  /** 会话恢复是否已完成 */
  hydrated: boolean;
  settings: LLMSettings;

  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  enterGuest: () => void;
  logout: () => void;
  restore: () => Promise<void>;
  updateSettings: (patch: Partial<LLMSettings>) => void;
  /** 当前生效的数据归属 id（访客为固定常量） */
  currentUserId: () => string;
}

const GUEST_USER: PublicUser = {
  id: GUEST_USER_ID,
  username: '访客',
  createdAt: 0,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isGuest: false,
      expiresAt: 0,
      hydrated: false,
      settings: { ...DEFAULT_LLM_SETTINGS },

      async login(username, password) {
        const user = await loginUser(username, password);
        set({ user, isGuest: false, expiresAt: Date.now() + SESSION_TTL, hydrated: true });
      },

      async register(username, password) {
        const user = await registerUser(username, password);
        set({ user, isGuest: false, expiresAt: Date.now() + SESSION_TTL, hydrated: true });
      },

      enterGuest() {
        set({
          user: GUEST_USER,
          isGuest: true,
          expiresAt: Date.now() + SESSION_TTL,
          hydrated: true,
        });
      },

      logout() {
        set({ user: null, isGuest: false, expiresAt: 0, hydrated: true });
      },

      async restore() {
        const { user, isGuest, expiresAt } = get();

        // 会话过期
        if (!user || !expiresAt || Date.now() > expiresAt) {
          set({ user: null, isGuest: false, expiresAt: 0, hydrated: true });
          return;
        }

        if (isGuest) {
          set({ user: GUEST_USER, hydrated: true });
          return;
        }

        // 校验用户在 IndexedDB 中仍然存在
        const record = await getUserById(user.id);
        if (record) {
          set({ user: record, hydrated: true });
        } else {
          set({ user: null, isGuest: false, expiresAt: 0, hydrated: true });
        }
      },

      updateSettings(patch) {
        set({ settings: { ...get().settings, ...patch } });
      },

      currentUserId() {
        const { user, isGuest } = get();
        if (isGuest) return GUEST_USER_ID;
        return user?.id ?? GUEST_USER_ID;
      },
    }),
    {
      name: 'atoms-demo-session',
      partialize: (state) => ({
        user: state.user,
        isGuest: state.isGuest,
        expiresAt: state.expiresAt,
        settings: state.settings,
      }),
      onRehydrateStorage: () => (state) => {
        // persist 恢复完成后，执行 restore 校验会话有效性
        state?.restore();
      },
    },
  ),
);