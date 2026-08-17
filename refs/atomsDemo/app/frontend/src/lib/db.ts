/**
 * IndexedDB 数据层（Dexie）。
 *
 * 三张表：users / projects / versions —— 所有业务数据均本地持久化，
 * 不依赖任何云端数据库。
 */

import Dexie, { type Table } from 'dexie';
import { generateId, generateSalt, hashPassword, safeEqual } from './crypto';

export const MAX_VERSIONS = 20;

/** 生成应用固定包含三个文件。 */
export const FILE_NAMES = ['index.html', 'style.css', 'app.js'] as const;
export type FileName = (typeof FILE_NAMES)[number];
export type AppFiles = Record<FileName, string>;

export type PipelineStage = 'plan' | 'generate' | 'validate' | 'render';
export type AgentRole = 'leader' | 'pm' | 'dev' | 'qa';
export type LogStatus = 'running' | 'done' | 'failed' | 'warning';

export interface AgentLog {
  id: string;
  role: AgentRole;
  roleName: string;
  stage: PipelineStage;
  title: string;
  /** 该智能体接收的输入摘要 */
  input: string;
  /** 该智能体产出的结构化结果 */
  output: string;
  /** 思考过程（紫色主题展示） */
  thinking: string;
  status: LogStatus;
  round: number;
  startedAt: number;
  finishedAt?: number;
}

export interface ChatMessageRecord {
  id: string;
  role: 'user' | 'assistant' | 'system';
  /** 已剥离代码块的正文，避免上下文膨胀 */
  content: string;
  thinking?: string;
  agent?: AgentRole;
  /** 本条消息是否产生了代码变更 */
  changedFiles?: FileName[];
  createdAt: number;
}

export type ProjectStatus = 'draft' | 'success' | 'partial' | 'failed';

export interface ProjectRecord {
  id: string;
  userId: string;
  name: string;
  requirement: string;
  blueprint: string;
  files: AppFiles;
  logs: AgentLog[];
  chat: ChatMessageRecord[];
  status: ProjectStatus;
  /** 校验结论摘要，例如「未完全通过测试」 */
  statusNote: string;
  createdAt: number;
  updatedAt: number;
}

export interface VersionRecord {
  id: string;
  projectId: string;
  versionNo: number;
  files: AppFiles;
  note: string;
  createdAt: number;
}

export interface UserRecord {
  id: string;
  username: string;
  salt: string;
  passwordHash: string;
  createdAt: number;
}

class AtomsDemoDB extends Dexie {
  users!: Table<UserRecord, string>;
  projects!: Table<ProjectRecord, string>;
  versions!: Table<VersionRecord, string>;

  constructor() {
    super('atomsDemo');
    this.version(1).stores({
      users: 'id, &username, createdAt',
      projects: 'id, userId, updatedAt, name',
      versions: 'id, projectId, versionNo, createdAt',
    });
  }
}

export const db = new AtomsDemoDB();

export const GUEST_USER_ID = '__guest__';

export function emptyFiles(): AppFiles {
  return { 'index.html': '', 'style.css': '', 'app.js': '' };
}

/* ------------------------------------------------------------------ */
/* 用户                                                                */
/* ------------------------------------------------------------------ */

export interface PublicUser {
  id: string;
  username: string;
  createdAt: number;
}

function toPublicUser(record: UserRecord): PublicUser {
  return { id: record.id, username: record.username, createdAt: record.createdAt };
}

export async function registerUser(username: string, password: string): Promise<PublicUser> {
  const name = username.trim();
  if (name.length < 2) throw new Error('用户名至少 2 个字符');
  if (password.length < 6) throw new Error('密码至少 6 个字符');

  const existing = await db.users.where('username').equals(name).first();
  if (existing) throw new Error('该用户名已被注册');

  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  const record: UserRecord = {
    id: generateId(),
    username: name,
    salt,
    passwordHash,
    createdAt: Date.now(),
  };
  await db.users.add(record);
  return toPublicUser(record);
}

export async function loginUser(username: string, password: string): Promise<PublicUser> {
  const name = username.trim();
  const record = await db.users.where('username').equals(name).first();
  if (!record) throw new Error('用户名或密码不正确');
  const hash = await hashPassword(password, record.salt);
  if (!safeEqual(hash, record.passwordHash)) throw new Error('用户名或密码不正确');
  return toPublicUser(record);
}

export async function getUserById(id: string): Promise<PublicUser | undefined> {
  const record = await db.users.get(id);
  return record ? toPublicUser(record) : undefined;
}

/* ------------------------------------------------------------------ */
/* 项目                                                                */
/* ------------------------------------------------------------------ */

export interface CreateProjectInput {
  userId: string;
  name: string;
  requirement: string;
  blueprint?: string;
  files?: AppFiles;
  logs?: AgentLog[];
  status?: ProjectStatus;
  statusNote?: string;
}

export async function createProject(input: CreateProjectInput): Promise<ProjectRecord> {
  const now = Date.now();
  const record: ProjectRecord = {
    id: generateId(),
    userId: input.userId,
    name: input.name.trim() || '未命名应用',
    requirement: input.requirement,
    blueprint: input.blueprint ?? '',
    files: input.files ?? emptyFiles(),
    logs: input.logs ?? [],
    chat: [],
    status: input.status ?? 'draft',
    statusNote: input.statusNote ?? '',
    createdAt: now,
    updatedAt: now,
  };
  await db.projects.add(record);
  return record;
}

export async function listProjects(userId: string, keyword = ''): Promise<ProjectRecord[]> {
  const items = await db.projects.where('userId').equals(userId).toArray();
  const search = keyword.trim().toLowerCase();
  const filtered = search
    ? items.filter(
        (item) =>
          item.name.toLowerCase().includes(search) ||
          item.requirement.toLowerCase().includes(search),
      )
    : items;
  return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<ProjectRecord | undefined> {
  return db.projects.get(id);
}

export async function updateProject(
  id: string,
  patch: Partial<Omit<ProjectRecord, 'id' | 'userId' | 'createdAt'>>,
): Promise<void> {
  await db.projects.update(id, { ...patch, updatedAt: Date.now() });
}

export async function renameProject(id: string, name: string): Promise<void> {
  const next = name.trim();
  if (!next) throw new Error('项目名不能为空');
  await updateProject(id, { name: next });
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.versions, async () => {
    await db.versions.where('projectId').equals(id).delete();
    await db.projects.delete(id);
  });
}

/* ------------------------------------------------------------------ */
/* 版本                                                                */
/* ------------------------------------------------------------------ */

export async function listVersions(projectId: string): Promise<VersionRecord[]> {
  const items = await db.versions.where('projectId').equals(projectId).toArray();
  return items.sort((a, b) => b.versionNo - a.versionNo);
}

/** 保存一个新版本，版本号递增，最多保留 MAX_VERSIONS 个。 */
export async function saveVersion(
  projectId: string,
  files: AppFiles,
  note: string,
): Promise<VersionRecord> {
  const existing = await listVersions(projectId);
  const nextNo = existing.length ? existing[0].versionNo + 1 : 1;
  const record: VersionRecord = {
    id: generateId(),
    projectId,
    versionNo: nextNo,
    files: { ...files },
    note: note.trim() || `版本 v${nextNo}`,
    createdAt: Date.now(),
  };
  await db.versions.add(record);

  // 超出上限时裁剪最旧的版本
  if (existing.length + 1 > MAX_VERSIONS) {
    const overflow = [...existing, record]
      .sort((a, b) => a.versionNo - b.versionNo)
      .slice(0, existing.length + 1 - MAX_VERSIONS);
    await db.versions.bulkDelete(overflow.map((item) => item.id));
  }
  return record;
}