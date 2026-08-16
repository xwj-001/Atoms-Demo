import type { CodeFiles } from './codeFiles';

/**
 * 补丁式编辑：让模型只输出「要替换哪一段」而不是重写整份文件。
 * 好处是省 token、改动范围可审计，也能避免「改一个按钮顺手把别处逻辑改坏」。
 * 一旦补丁无法定位，上层会自动回落到整文件重写，保证链路不会卡死。
 */
export interface PatchBlock {
  file: keyof CodeFiles;
  search: string;
  replace: string;
}

export type PatchMatchKind = 'exact' | 'loose';

export interface AppliedPatch extends PatchBlock {
  /** 命中方式：精确字符串命中，或忽略缩进/行尾空白的宽松命中 */
  match: PatchMatchKind;
}

export interface FailedPatch {
  block: PatchBlock;
  reason: string;
}

export interface PatchApplyResult {
  files: CodeFiles;
  applied: AppliedPatch[];
  failed: FailedPatch[];
  /** 实际被改动的文件 */
  touched: Array<keyof CodeFiles>;
}

export const SEARCH_MARK = '<<<<<<< SEARCH';
export const DIVIDER_MARK = '=======';
export const REPLACE_MARK = '>>>>>>> REPLACE';

const PATCH_HEADER_RE = /^\s*-{2,}\s*patch\s*:\s*([\w.\-/]+)\s*-{2,}\s*$/i;

const FILE_ALIAS: Array<{ key: keyof CodeFiles; match: string[] }> = [
  { key: 'html', match: ['index.html', '.html', 'html', 'markup'] },
  { key: 'css', match: ['style.css', '.css', 'css', 'style'] },
  { key: 'js', match: ['app.js', '.js', 'javascript', 'js', 'script'] },
];

/** 把模型写出的文件名归一到三文件的键 */
export function resolveFileKey(name: string): keyof CodeFiles | null {
  const lower = (name || '').trim().toLowerCase();
  if (!lower) return null;
  for (const alias of FILE_ALIAS) {
    if (alias.match.some((m) => lower.includes(m))) return alias.key;
  }
  return null;
}

/** 输出里是否带补丁标记，用于判断该走补丁路径还是整文件路径 */
export function hasPatchMarkers(raw: string): boolean {
  const text = raw || '';
  return text.includes(SEARCH_MARK) && text.includes(REPLACE_MARK);
}

/**
 * 解析补丁块。容错点：
 * - 允许一个文件段内包含多个 SEARCH/REPLACE 块
 * - 允许模型漏写 `--patch:xxx--` 头，此时按块内容猜测归属文件
 */
export function parsePatchBlocks(raw: string, base?: CodeFiles): PatchBlock[] {
  const lines = (raw || '').split(/\r?\n/);
  const blocks: PatchBlock[] = [];

  let currentFile: keyof CodeFiles | null = null;
  let state: 'idle' | 'search' | 'replace' = 'idle';
  let searchBuf: string[] = [];
  let replaceBuf: string[] = [];

  const flush = () => {
    const search = searchBuf.join('\n');
    const replace = replaceBuf.join('\n');
    searchBuf = [];
    replaceBuf = [];
    if (!search.trim()) return;
    const file = currentFile ?? guessFile(search, base);
    if (!file) return;
    blocks.push({ file, search, replace });
  };

  for (const line of lines) {
    const header = line.match(PATCH_HEADER_RE);
    if (header) {
      if (state !== 'idle') flush();
      state = 'idle';
      currentFile = resolveFileKey(header[1]);
      continue;
    }
    const trimmed = line.trim();
    if (trimmed.startsWith(SEARCH_MARK)) {
      if (state !== 'idle') flush();
      state = 'search';
      continue;
    }
    if (state === 'search' && trimmed === DIVIDER_MARK) {
      state = 'replace';
      continue;
    }
    if (state === 'replace' && trimmed.startsWith(REPLACE_MARK)) {
      flush();
      state = 'idle';
      continue;
    }
    if (state === 'search') searchBuf.push(line);
    else if (state === 'replace') replaceBuf.push(line);
  }

  if (state !== 'idle') flush();
  return blocks;
}

/** 漏写文件头时，按当前产物内容判断这段 search 属于哪个文件 */
function guessFile(search: string, base?: CodeFiles): keyof CodeFiles | null {
  if (base) {
    const owners = (['html', 'css', 'js'] as Array<keyof CodeFiles>).filter(
      (key) => base[key] && locate(base[key], search) !== null,
    );
    if (owners.length === 1) return owners[0];
  }
  if (/<\/?[a-z][\w-]*[\s>]/i.test(search)) return 'html';
  if (/[.#][\w-]+\s*\{|:\s*[^;]+;/.test(search) && !/function|=>|const |let /.test(search)) {
    return 'css';
  }
  if (/function|=>|const |let |var |addEventListener/.test(search)) return 'js';
  return null;
}

/* ------------------------------ 定位与替换 ------------------------------ */

interface LineRange {
  start: number;
  end: number;
  kind: PatchMatchKind;
}

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

/** 去掉 search 片段首尾的空行，避免模型多带空行导致定位失败 */
function meaningfulLines(text: string): string[] {
  const lines = text.split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines;
}

/**
 * 定位 search 片段在源文件中的行区间。
 * 先按原文精确比对，再退化为忽略缩进与多余空白的宽松比对。
 */
function locate(source: string, search: string): LineRange | null {
  const needle = meaningfulLines(search);
  if (!needle.length) return null;

  const srcLines = source.split('\n');
  const total = srcLines.length;
  const size = needle.length;
  if (size > total) return null;

  for (let i = 0; i + size <= total; i += 1) {
    let hit = true;
    for (let j = 0; j < size; j += 1) {
      if (srcLines[i + j] !== needle[j]) {
        hit = false;
        break;
      }
    }
    if (hit) return { start: i, end: i + size, kind: 'exact' };
  }

  const normNeedle = needle.map(normalizeLine);
  for (let i = 0; i + size <= total; i += 1) {
    let hit = true;
    for (let j = 0; j < size; j += 1) {
      if (normalizeLine(srcLines[i + j]) !== normNeedle[j]) {
        hit = false;
        break;
      }
    }
    if (hit) return { start: i, end: i + size, kind: 'loose' };
  }

  return null;
}

/** 判断 search 片段是否在源文件中出现多次，多次命中时拒绝套用以免改错位置 */
function countMatches(source: string, search: string): number {
  const needle = meaningfulLines(search).map(normalizeLine);
  if (!needle.length) return 0;
  const srcLines = source.split('\n').map(normalizeLine);
  let count = 0;
  for (let i = 0; i + needle.length <= srcLines.length; i += 1) {
    let hit = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (srcLines[i + j] !== needle[j]) {
        hit = false;
        break;
      }
    }
    if (hit) count += 1;
  }
  return count;
}

/**
 * 按顺序套用补丁。每个块独立判定，失败的块不会影响已成功的块，
 * 因此部分成功也能返回可用产物，由上层决定是否回落整文件重写。
 */
export function applyPatchBlocks(base: CodeFiles, blocks: PatchBlock[]): PatchApplyResult {
  const files: CodeFiles = { ...base };
  const applied: AppliedPatch[] = [];
  const failed: FailedPatch[] = [];
  const touched = new Set<keyof CodeFiles>();

  for (const block of blocks) {
    const source = files[block.file] ?? '';
    if (!source.trim()) {
      // 目标文件本来是空的，整段视为新增内容
      files[block.file] = meaningfulLines(block.replace).join('\n');
      applied.push({ ...block, match: 'exact' });
      touched.add(block.file);
      continue;
    }

    const hits = countMatches(source, block.search);
    if (hits === 0) {
      failed.push({ block, reason: '在目标文件中找不到这段原文，可能已被前一个补丁改动过' });
      continue;
    }
    if (hits > 1) {
      failed.push({ block, reason: `这段原文在文件中出现了 ${hits} 次，无法确定改哪一处` });
      continue;
    }

    const range = locate(source, block.search);
    if (!range) {
      failed.push({ block, reason: '无法定位这段原文' });
      continue;
    }

    const srcLines = source.split('\n');
    const replaceLines = block.replace.trim() ? meaningfulLines(block.replace) : [];
    srcLines.splice(range.start, range.end - range.start, ...replaceLines);
    files[block.file] = srcLines.join('\n');
    applied.push({ ...block, match: range.kind });
    touched.add(block.file);
  }

  return { files, applied, failed, touched: [...touched] };
}

/** 补丁失败清单转成可回喂模型的说明文本 */
export function describePatchFailures(failed: FailedPatch[]): string[] {
  return failed.map((item, index) => {
    const preview = meaningfulLines(item.block.search).slice(0, 2).join(' / ').slice(0, 90);
    return `第 ${index + 1} 个补丁未能套用（${item.reason}）：${preview}`;
  });
}