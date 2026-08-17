import Dexie, { type Table } from 'dexie';
import {
  emptyLocks,
  normalizeLocks,
  renderToHTML,
  splitDocument,
  type CodeFiles,
  type FileLocks,
} from './codeFiles';

/** 应用风格标签 */
export type StyleTag = 'minimal' | 'card' | 'dashboard';

export const STYLE_ORDER: StyleTag[] = ['minimal', 'card', 'dashboard'];

export const STYLE_LABEL: Record<StyleTag, string> = {
  minimal: '简约风',
  card: '卡片风',
  dashboard: '数据看板风',
};

export const STYLE_DESC: Record<StyleTag, string> = {
  minimal: '克制的中性色，单列纵向流，无多余装饰',
  card: '圆角卡片与柔和阴影，配色明亮，带进入动画',
  dashboard: '深色底 + KPI 指标条 + 分区面板，信息密度高',
};

export function normalizeStyle(value: unknown): StyleTag {
  return value === 'card' || value === 'dashboard' ? value : 'minimal';
}

/** 版本的确定性校验结论，随版本一起存档，便于复盘质量 */
export interface VersionCheck {
  passed: boolean;
  /** 未通过的检查项名称 */
  failed: string[];
  /** 本次产出共尝试了几轮（含自动修复） */
  attempts: number;
}

/**
 * 单个历史版本。
 * - files：三文件结构，代码工作区按文件分栏编辑
 * - code：合成后的纯净单文件 HTML，用于导出、云端同步与旧数据兼容
 */
export interface AppVersion {
  code: string;
  files?: CodeFiles;
  timestamp: number;
  changelog: string;
  check?: VersionCheck;
  /** 本版产出方式：整文件重写、补丁套用，或用户手改 */
  origin?: 'full' | 'patch' | 'manual';
  /** 本版被补丁改动的文件（仅 patch 来源） */
  patched?: Array<keyof CodeFiles>;
}

/**
 * 已保存的应用。userId / tags / isPublic 用于云端同步与灵感画廊，
 * remoteId 记录云端记录主键，未登录时为 null。
 */
export interface StudioApp {
  id?: number;
  name: string;
  description: string;
  style: StyleTag;
  versions: AppVersion[];
  currentVersionIndex: number;
  createdAt: number;
  updatedAt: number;
  userId: string | null;
  tags: string[];
  isPublic: boolean;
  remoteId: number | null;
  /** 本地是否有未同步到云端的改动 */
  dirty: boolean;
  /** 被锁定的文件，迭代时不允许模型覆盖 */
  locks?: FileLocks;
  schemaVersion: number;
}

class StudioDatabase extends Dexie {
  apps!: Table<StudioApp, number>;

  constructor() {
    super('atoms-studio-lab');
    this.version(1).stores({
      apps: '++id, name, style, createdAt',
    });
    this.version(2)
      .stores({
        apps: '++id, name, style, createdAt, remoteId',
      })
      .upgrade(async (tx) =>
        tx
          .table<StudioApp>('apps')
          .toCollection()
          .modify((app) => {
            app.remoteId = app.remoteId ?? null;
            app.dirty = app.dirty ?? true;
          }),
      );
    // v3 引入文件锁定：旧数据一律视为未锁定，不影响既有迭代行为
    this.version(3)
      .stores({
        apps: '++id, name, style, createdAt, remoteId',
      })
      .upgrade(async (tx) =>
        tx
          .table<StudioApp>('apps')
          .toCollection()
          .modify((app) => {
            app.locks = normalizeLocks(app.locks);
            app.schemaVersion = 3;
          }),
      );
  }
}

export const db = new StudioDatabase();

export interface CreateAppInput {
  name: string;
  description: string;
  style: StyleTag;
  files: CodeFiles;
  changelog?: string;
  check?: VersionCheck;
  origin?: AppVersion['origin'];
}

/** 首次生成成功后创建应用，并写入第一个版本 */
export async function createApp(input: CreateAppInput): Promise<StudioApp> {
  const now = Date.now();
  const record: StudioApp = {
    name: input.name,
    description: input.description,
    style: input.style,
    versions: [
      {
        code: renderToHTML(input.files),
        files: input.files,
        timestamp: now,
        changelog: input.changelog ?? '初始版本',
        check: input.check,
        origin: input.origin ?? 'full',
      },
    ],
    currentVersionIndex: 0,
    createdAt: now,
    updatedAt: now,
    userId: null,
    tags: [],
    isPublic: false,
    remoteId: null,
    dirty: true,
    locks: emptyLocks(),
    schemaVersion: 3,
  };
  const id = await db.apps.add(record);
  return { ...record, id };
}

export interface AppendVersionMeta {
  check?: VersionCheck;
  origin?: AppVersion['origin'];
  patched?: Array<keyof CodeFiles>;
}

/** 迭代成功后追加新版本，并把当前版本指向它 */
export async function appendVersion(
  appId: number,
  files: CodeFiles,
  changelog: string,
  meta: AppendVersionMeta = {},
): Promise<StudioApp> {
  const app = await db.apps.get(appId);
  if (!app) throw new Error('应用不存在');
  const versions = [
    ...app.versions,
    {
      code: renderToHTML(files),
      files,
      timestamp: Date.now(),
      changelog,
      check: meta.check,
      origin: meta.origin ?? 'full',
      patched: meta.patched,
    },
  ];
  const next: StudioApp = {
    ...app,
    versions,
    currentVersionIndex: versions.length - 1,
    updatedAt: Date.now(),
    dirty: true,
  };
  await db.apps.put(next);
  return next;
}

/** 恢复到指定历史版本 */
export async function setCurrentVersion(appId: number, index: number): Promise<StudioApp> {
  const app = await db.apps.get(appId);
  if (!app) throw new Error('应用不存在');
  const safeIndex = Math.min(Math.max(index, 0), app.versions.length - 1);
  const next: StudioApp = {
    ...app,
    currentVersionIndex: safeIndex,
    updatedAt: Date.now(),
    dirty: true,
  };
  await db.apps.put(next);
  return next;
}

/** 更新文件锁定状态：被锁文件在后续迭代中不会被模型覆盖 */
export async function setAppLocks(appId: number, locks: FileLocks): Promise<StudioApp> {
  const app = await db.apps.get(appId);
  if (!app) throw new Error('应用不存在');
  const next: StudioApp = { ...app, locks, updatedAt: Date.now(), dirty: true };
  await db.apps.put(next);
  return next;
}

/** 取出应用的锁定状态，旧数据默认全部未锁定 */
export function locksOf(app: StudioApp | null): FileLocks {
  return normalizeLocks(app?.locks);
}

/** 切换公开状态（灵感画廊可见性） */
export async function setAppPublic(appId: number, isPublic: boolean): Promise<StudioApp> {
  const app = await db.apps.get(appId);
  if (!app) throw new Error('应用不存在');
  const next: StudioApp = { ...app, isPublic, updatedAt: Date.now(), dirty: true };
  await db.apps.put(next);
  return next;
}

/** 同步成功后回写云端主键并清除 dirty 标记 */
export async function markSynced(
  appId: number,
  remoteId: number,
  userId: string,
): Promise<void> {
  await db.apps.update(appId, { remoteId, userId, dirty: false });
}

/** 把云端记录写入本地：已有则按 remoteId 覆盖，否则新增 */
export async function upsertFromRemote(remote: StudioApp): Promise<void> {
  const existing = remote.remoteId
    ? await db.apps.where('remoteId').equals(remote.remoteId).first()
    : undefined;
  if (existing?.id) {
    await db.apps.put({ ...remote, id: existing.id });
    return;
  }
  const { id: _ignored, ...rest } = remote;
  await db.apps.add(rest as StudioApp);
}

export async function renameApp(appId: number, name: string): Promise<void> {
  await db.apps.update(appId, { name, updatedAt: Date.now(), dirty: true });
}

/** 按名称 / 需求描述模糊搜索，按创建时间倒序 */
export async function listApps(keyword = ''): Promise<StudioApp[]> {
  const all = await db.apps.orderBy('createdAt').reverse().toArray();
  const q = keyword.trim().toLowerCase();
  if (!q) return all;
  return all.filter(
    (app) => app.name.toLowerCase().includes(q) || app.description.toLowerCase().includes(q),
  );
}

export async function getApp(appId: number): Promise<StudioApp | undefined> {
  return db.apps.get(appId);
}

export async function removeApp(appId: number): Promise<void> {
  await db.apps.delete(appId);
}

/** 取出应用当前生效版本的代码 */
export function currentCodeOf(app: StudioApp | null): string {
  if (!app || app.versions.length === 0) return '';
  const index = Math.min(Math.max(app.currentVersionIndex, 0), app.versions.length - 1);
  return app.versions[index].code;
}

/**
 * 取出当前版本的三文件结构。
 * 旧数据只有单文件 code，这里即时拆分，保证代码工作区始终可用。
 */
export function currentFilesOf(app: StudioApp | null): CodeFiles {
  if (!app || app.versions.length === 0) return { html: '', css: '', js: '' };
  const index = Math.min(Math.max(app.currentVersionIndex, 0), app.versions.length - 1);
  const version = app.versions[index];
  if (version.files && (version.files.html || version.files.css || version.files.js)) {
    return version.files;
  }
  return splitDocument(version.code);
}

/** 取出指定版本的三文件结构 */
export function filesOfVersion(version: AppVersion): CodeFiles {
  if (version.files && (version.files.html || version.files.css || version.files.js)) {
    return version.files;
  }
  return splitDocument(version.code);
}

export interface StyleStat {
  tag: StyleTag;
  count: number;
  ratio: number;
}

/** 风格使用次数统计，用于「我的应用」顶部统计卡片 */
export function computeStyleStats(apps: StudioApp[]): {
  total: number;
  stats: StyleStat[];
  favorite: StyleTag | null;
} {
  const counter: Record<StyleTag, number> = { minimal: 0, card: 0, dashboard: 0 };
  apps.forEach((app) => {
    counter[app.style] = (counter[app.style] ?? 0) + 1;
  });
  const total = apps.length;
  const stats = STYLE_ORDER.map((tag) => ({
    tag,
    count: counter[tag],
    ratio: total ? counter[tag] / total : 0,
  }));
  const sorted = [...stats].sort((a, b) => b.count - a.count);
  return { total, stats, favorite: total && sorted[0].count > 0 ? sorted[0].tag : null };
}

/** 导出单个 HTML 文件 */
export function downloadHtml(fileName: string, code: string): void {
  const safe = (fileName || 'atoms-app').replace(/[\\/:*?"<>|]/g, '_');
  const blob = new Blob([code], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safe}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}