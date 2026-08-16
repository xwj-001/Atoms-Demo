import { createClient } from '@metagptx/web-sdk';
import {
  listApps,
  markSynced,
  normalizeStyle,
  upsertFromRemote,
  type AppVersion,
  type StudioApp,
} from './db';

const client = createClient();

/** 同步到云端时每个应用最多保留的版本数，避免单条记录过大 */
const MAX_SYNC_VERSIONS = 5;

export interface StudioUser {
  id: string;
  name?: string;
  email?: string;
}

/** 三态认证结果：null 表示未登录 */
export async function fetchCurrentUser(): Promise<StudioUser | null> {
  const response = await client.auth.me();
  const data = response?.data as Record<string, unknown> | undefined;
  if (!data) return null;
  const id = String(data.id ?? data.user_id ?? data.sub ?? '');
  if (!id) return null;
  return {
    id,
    name: typeof data.name === 'string' ? data.name : undefined,
    email: typeof data.email === 'string' ? data.email : undefined,
  };
}

export function toLogin(): void {
  client.auth.toLogin();
}

export async function logout(): Promise<void> {
  await client.auth.logout();
}

interface RemoteRow {
  id: number;
  user_id?: string;
  local_id?: number;
  name?: string;
  description?: string;
  style?: string;
  versions_json?: string;
  current_version_index?: number;
  version_count?: number;
  tags?: string;
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
}

function trimVersions(versions: AppVersion[]): AppVersion[] {
  return versions.length > MAX_SYNC_VERSIONS ? versions.slice(-MAX_SYNC_VERSIONS) : versions;
}

function toRemotePayload(app: StudioApp) {
  const versions = trimVersions(app.versions);
  const dropped = app.versions.length - versions.length;
  return {
    local_id: app.id ?? 0,
    name: app.name,
    description: app.description,
    style: app.style,
    versions_json: JSON.stringify(versions),
    current_version_index: Math.max(0, app.currentVersionIndex - dropped),
    version_count: app.versions.length,
    tags: app.tags.join(','),
    is_public: app.isPublic,
  };
}

function parseVersions(raw: string | undefined): AppVersion[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => {
        const rawFiles = item.files as Record<string, unknown> | undefined;
        const files =
          rawFiles && typeof rawFiles === 'object'
            ? {
                html: typeof rawFiles.html === 'string' ? rawFiles.html : '',
                css: typeof rawFiles.css === 'string' ? rawFiles.css : '',
                js: typeof rawFiles.js === 'string' ? rawFiles.js : '',
              }
            : undefined;
        const rawCheck = item.check as Record<string, unknown> | undefined;
        const check =
          rawCheck && typeof rawCheck === 'object'
            ? {
                passed: !!rawCheck.passed,
                failed: Array.isArray(rawCheck.failed) ? rawCheck.failed.map(String) : [],
                attempts: typeof rawCheck.attempts === 'number' ? rawCheck.attempts : 1,
              }
            : undefined;
        return {
          code: typeof item.code === 'string' ? item.code : '',
          files,
          timestamp: typeof item.timestamp === 'number' ? item.timestamp : Date.now(),
          changelog: typeof item.changelog === 'string' ? item.changelog : '云端版本',
          check,
        };
      })
      .filter((v) => v.code);
  } catch {
    return [];
  }
}

function fromRemoteRow(row: RemoteRow): StudioApp | null {
  const versions = parseVersions(row.versions_json);
  if (!versions.length) return null;
  const createdAt = row.created_at ? Date.parse(row.created_at) : Date.now();
  const updatedAt = row.updated_at ? Date.parse(row.updated_at) : createdAt;
  return {
    name: row.name || '未命名应用',
    description: row.description || '',
    style: normalizeStyle(row.style),
    versions,
    currentVersionIndex: Math.min(
      Math.max(row.current_version_index ?? 0, 0),
      versions.length - 1,
    ),
    createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
    updatedAt: Number.isNaN(updatedAt) ? Date.now() : updatedAt,
    userId: row.user_id ?? null,
    tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
    isPublic: !!row.is_public,
    remoteId: row.id,
    dirty: false,
    schemaVersion: 2,
  };
}

export interface SyncReport {
  uploaded: number;
  downloaded: number;
}

/**
 * 双向同步：先把本地有改动的应用推送到云端，再把云端记录合并回本地。
 * 云端记录以 remoteId 为准做去重覆盖。
 */
export async function syncWithCloud(user: StudioUser): Promise<SyncReport> {
  const locals = await listApps('');
  let uploaded = 0;

  for (const app of locals) {
    if (!app.id) continue;
    if (!app.dirty && app.remoteId) continue;
    const payload = toRemotePayload(app);
    if (app.remoteId) {
      await client.entities.studio_apps.update({ id: String(app.remoteId), data: payload });
      await markSynced(app.id, app.remoteId, user.id);
    } else {
      const created = await client.entities.studio_apps.create({ data: payload });
      const remoteId = Number((created?.data as RemoteRow | undefined)?.id);
      if (Number.isFinite(remoteId)) {
        await markSynced(app.id, remoteId, user.id);
      }
    }
    uploaded += 1;
  }

  const response = await client.entities.studio_apps.query({ sort: '-created_at', limit: 100 });
  const rows = ((response?.data as { items?: RemoteRow[] } | undefined)?.items ?? []) as RemoteRow[];
  let downloaded = 0;
  for (const row of rows) {
    const mapped = fromRemoteRow(row);
    if (!mapped) continue;
    await upsertFromRemote(mapped);
    downloaded += 1;
  }

  return { uploaded, downloaded };
}

/** 删除云端记录（本地删除时同步清理） */
export async function deleteRemote(remoteId: number): Promise<void> {
  await client.entities.studio_apps.delete({ id: String(remoteId) });
}

export interface GalleryItem {
  remoteId: number;
  name: string;
  description: string;
  style: StudioApp['style'];
  versionCount: number;
  createdAt: number;
  code: string;
  mine: boolean;
}

/**
 * 灵感画廊：读取全部用户公开的应用。
 * studio_apps 为 create_only 表，因此使用 queryAll 跨用户读取。
 */
export async function fetchGallery(currentUserId: string | null): Promise<GalleryItem[]> {
  const response = await client.entities.studio_apps.queryAll({
    query: { is_public: true },
    sort: '-created_at',
    limit: 60,
  });
  const rows = ((response?.data as { items?: RemoteRow[] } | undefined)?.items ?? []) as RemoteRow[];
  return rows
    .map((row) => {
      const mapped = fromRemoteRow(row);
      if (!mapped) return null;
      const index = mapped.currentVersionIndex;
      return {
        remoteId: row.id,
        name: mapped.name,
        description: mapped.description,
        style: mapped.style,
        versionCount: row.version_count ?? mapped.versions.length,
        createdAt: mapped.createdAt,
        code: mapped.versions[index]?.code ?? mapped.versions[0].code,
        mine: !!currentUserId && row.user_id === currentUserId,
      } satisfies GalleryItem;
    })
    .filter((item): item is GalleryItem => item !== null);
}