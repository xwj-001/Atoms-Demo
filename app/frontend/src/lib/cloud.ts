/**
 * 云端同步层：已切换为自建邮箱 + 密码账号体系。
 *
 * 所有请求都走本项目后端的 /api/v1/studio-data/* 接口，并通过
 * X-Studio-Token 头携带自建令牌；后端按 `studio:<id>` 校验数据归属。
 */
import {
  listApps,
  markSynced,
  normalizeStyle,
  upsertFromRemote,
  type AppVersion,
  type StudioApp,
} from './db';
import { authedRequest, type StudioAccount } from './studioAuth';

/** 同步到云端时每个应用最多保留的版本数，避免单条记录过大 */
const MAX_SYNC_VERSIONS = 5;

/** 沿用旧类型名，避免上层组件大面积改动 */
export type StudioUser = StudioAccount;

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

interface ListPayload {
  items?: RemoteRow[];
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
      await authedRequest<RemoteRow>(
        'put',
        `/api/v1/studio-data/apps/${app.remoteId}`,
        payload,
        '同步失败，请稍后重试',
      );
      await markSynced(app.id, app.remoteId, user.id);
    } else {
      const created = await authedRequest<RemoteRow>(
        'post',
        '/api/v1/studio-data/apps',
        payload,
        '同步失败，请稍后重试',
      );
      const remoteId = Number(created?.id);
      if (Number.isFinite(remoteId)) {
        await markSynced(app.id, remoteId, user.id);
      }
    }
    uploaded += 1;
  }

  const response = await authedRequest<ListPayload>(
    'get',
    '/api/v1/studio-data/apps',
    undefined,
    '拉取云端作品失败',
  );
  const rows = response?.items ?? [];
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
  await authedRequest('delete', `/api/v1/studio-data/apps/${remoteId}`, undefined, '删除云端记录失败');
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
 * 灵感画廊：读取全部账号公开的作品。
 * 后端已把非本人作品的归属字段脱敏为 others，仅用于标记「我的」。
 */
export async function fetchGallery(currentUserId: string | null): Promise<GalleryItem[]> {
  const response = await authedRequest<ListPayload>(
    'get',
    '/api/v1/studio-data/gallery',
    undefined,
    '加载灵感画廊失败',
  );
  const rows = response?.items ?? [];
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