/**
 * 工作区状态管理。
 *
 * 三态：input（需求输入） / generating（生成中） / result（结果展示）
 * 管理当前项目、文件、日志、对话、UI 状态等。
 */

import { create } from 'zustand';
import { emptyFiles, type AgentLog, type AppFiles, type ChatMessageRecord, type ProjectRecord, type ValidationReport } from '@/lib/db';
import type { Blueprint } from '@/lib/llm/mockTemplates';

export type WorkspacePhase = 'input' | 'generating' | 'result';
export type ResultTab = 'preview' | 'code' | 'split';
export type ViewportSize = 'desktop' | 'tablet' | 'mobile';

export interface WorkspaceState {
  /* ---------------- 基础状态 ---------------- */
  phase: WorkspacePhase;
  currentProjectId: string | null;
  currentProject: ProjectRecord | null;

  /* ---------------- 生成产物 ---------------- */
  files: AppFiles;
  logs: AgentLog[];
  blueprint: Blueprint | null;
  blueprintText: string;
  report: ValidationReport | null;
  statusNote: string;

  /* ---------------- 对话状态 ---------------- */
  chatMessages: ChatMessageRecord[];
  isChatting: boolean;

  /* ---------------- UI 状态 ---------------- */
  sidebarOpen: boolean;
  activeTab: ResultTab;
  viewportSize: ViewportSize;
  splitRatio: number;
  chatPanelOpen: boolean;
  chatPanelHeight: number;
  projectListVersion: number;

  /* ---------------- 操作方法 ---------------- */
  setPhase: (phase: WorkspacePhase) => void;
  setCurrentProject: (project: ProjectRecord | null) => void;
  setFiles: (files: AppFiles) => void;
  updateFile: (name: keyof AppFiles, content: string) => void;
  setLogs: (logs: AgentLog[]) => void;
  appendLog: (log: AgentLog) => void;
  setBlueprint: (blueprint: Blueprint | null, text: string) => void;
  setReport: (report: ValidationReport | null) => void;
  setStatusNote: (note: string) => void;
  setChatMessages: (messages: ChatMessageRecord[]) => void;
  appendChatMessage: (message: ChatMessageRecord) => void;
  updateLastChatMessage: (patch: Partial<ChatMessageRecord>) => void;
  setIsChatting: (value: boolean) => void;
  clearChat: () => void;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: ResultTab) => void;
  setViewportSize: (size: ViewportSize) => void;
  setSplitRatio: (ratio: number) => void;
  toggleChatPanel: () => void;
  setChatPanelOpen: (open: boolean) => void;
  setChatPanelHeight: (height: number) => void;
  refreshProjectList: () => void;

  resetToInput: () => void;
  resetGenerating: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  /* ---------------- 基础状态 ---------------- */
  phase: 'input',
  currentProjectId: null,
  currentProject: null,

  /* ---------------- 生成产物 ---------------- */
  files: emptyFiles(),
  logs: [],
  blueprint: null,
  blueprintText: '',
  report: null,
  statusNote: '',

  /* ---------------- 对话状态 ---------------- */
  chatMessages: [],
  isChatting: false,

  /* ---------------- UI 状态 ---------------- */
  sidebarOpen: true,
  activeTab: 'preview',
  viewportSize: 'desktop',
  splitRatio: 0.5,
  chatPanelOpen: true,
  chatPanelHeight: 320,
  projectListVersion: 0,

  /* ---------------- 操作方法 ---------------- */
  setPhase: (phase) => set({ phase }),

  setCurrentProject: (project) =>
    set({
      currentProject: project,
      currentProjectId: project?.id ?? null,
    }),

  setFiles: (files) => set({ files }),

  updateFile: (name, content) =>
    set((state) => ({
      files: { ...state.files, [name]: content },
    })),

  setLogs: (logs) => set({ logs }),

  appendLog: (log) =>
    set((state) => ({
      logs: [...state.logs, log],
    })),

  setBlueprint: (blueprint, text) => set({ blueprint, blueprintText: text }),

  setReport: (report) => set({ report }),

  setStatusNote: (statusNote) => set({ statusNote }),

  setChatMessages: (chatMessages) => set({ chatMessages }),

  appendChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),

  updateLastChatMessage: (patch) =>
    set((state) => {
      if (state.chatMessages.length === 0) return state;
      const messages = [...state.chatMessages];
      messages[messages.length - 1] = { ...messages[messages.length - 1], ...patch };
      return { chatMessages: messages };
    }),

  setIsChatting: (isChatting) => set({ isChatting }),

  clearChat: () => set({ chatMessages: [], isChatting: false }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  setActiveTab: (activeTab) => set({ activeTab }),

  setViewportSize: (viewportSize) => set({ viewportSize }),

  setSplitRatio: (splitRatio) => set({ splitRatio }),

  toggleChatPanel: () => set((state) => ({ chatPanelOpen: !state.chatPanelOpen })),
  setChatPanelOpen: (chatPanelOpen) => set({ chatPanelOpen }),
  setChatPanelHeight: (chatPanelHeight) => set({ chatPanelHeight }),

  refreshProjectList: () =>
    set((state) => ({ projectListVersion: state.projectListVersion + 1 })),

  resetToInput: () =>
    set({
      phase: 'input',
      files: emptyFiles(),
      logs: [],
      blueprint: null,
      blueprintText: '',
      report: null,
      statusNote: '',
      chatMessages: [],
      isChatting: false,
    }),

  resetGenerating: () =>
    set({
      phase: 'generating',
      files: emptyFiles(),
      logs: [],
      blueprint: null,
      blueprintText: '',
      report: null,
      statusNote: '',
      chatMessages: [],
      isChatting: false,
    }),
}));
