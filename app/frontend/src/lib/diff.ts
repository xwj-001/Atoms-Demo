import { FILE_LABEL, FILE_ORDER, type CodeFiles } from './codeFiles';

/**
 * 行级差异算法（LCS 动态规划 + 回溯）。
 * 版本历史只能「预览 / 恢复」时，用户看不清一轮迭代到底改了什么；
 * 有了并排差异，配合已存档的校验结论，就能判断这一轮是变好还是变坏。
 */
export type DiffKind = 'equal' | 'added' | 'removed';

export interface DiffRow {
  kind: DiffKind;
  /** 左侧（旧版）行号，新增行为 null */
  leftNo: number | null;
  /** 右侧（新版）行号，删除行为 null */
  rightNo: number | null;
  text: string;
}

export interface FileDiff {
  file: keyof CodeFiles;
  label: string;
  rows: DiffRow[];
  added: number;
  removed: number;
  /** 两侧内容完全一致 */
  identical: boolean;
}

export interface DiffSummary {
  files: FileDiff[];
  added: number;
  removed: number;
  changedFiles: Array<keyof CodeFiles>;
}

/** 超过此行数放弃精确 LCS，退化为整块替换，避免大文件卡死主线程 */
const LCS_LINE_LIMIT = 1600;

function splitLines(text: string): string[] {
  if (!text) return [];
  return text.replace(/\r\n/g, '\n').split('\n');
}

/** 计算两组行的 LCS 长度表 */
function lcsTable(left: string[], right: string[]): Uint32Array {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const table = new Uint32Array(rows * cols);
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      const index = i * cols + j;
      table[index] =
        left[i] === right[j]
          ? table[(i + 1) * cols + (j + 1)] + 1
          : Math.max(table[(i + 1) * cols + j], table[index + 1]);
    }
  }
  return table;
}

/** 逐行比对，产出可直接并排渲染的行序列 */
export function diffLines(oldText: string, newText: string): DiffRow[] {
  const left = splitLines(oldText);
  const right = splitLines(newText);

  if (!left.length && !right.length) return [];

  // 大文件不做精确匹配：先按整块删除再整块新增，仍然可读且不会卡顿
  if (left.length > LCS_LINE_LIMIT || right.length > LCS_LINE_LIMIT) {
    return [
      ...left.map((text, index) => ({
        kind: 'removed' as DiffKind,
        leftNo: index + 1,
        rightNo: null,
        text,
      })),
      ...right.map((text, index) => ({
        kind: 'added' as DiffKind,
        leftNo: null,
        rightNo: index + 1,
        text,
      })),
    ];
  }

  const cols = right.length + 1;
  const table = lcsTable(left, right);
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      rows.push({ kind: 'equal', leftNo: i + 1, rightNo: j + 1, text: left[i] });
      i += 1;
      j += 1;
    } else if (table[(i + 1) * cols + j] >= table[i * cols + (j + 1)]) {
      rows.push({ kind: 'removed', leftNo: i + 1, rightNo: null, text: left[i] });
      i += 1;
    } else {
      rows.push({ kind: 'added', leftNo: null, rightNo: j + 1, text: right[j] });
      j += 1;
    }
  }
  while (i < left.length) {
    rows.push({ kind: 'removed', leftNo: i + 1, rightNo: null, text: left[i] });
    i += 1;
  }
  while (j < right.length) {
    rows.push({ kind: 'added', leftNo: null, rightNo: j + 1, text: right[j] });
    j += 1;
  }

  return rows;
}

/** 三文件整体差异 */
export function diffFiles(oldFiles: CodeFiles, newFiles: CodeFiles): DiffSummary {
  const files: FileDiff[] = FILE_ORDER.map((file) => {
    const rows = diffLines(oldFiles[file] ?? '', newFiles[file] ?? '');
    const added = rows.filter((r) => r.kind === 'added').length;
    const removed = rows.filter((r) => r.kind === 'removed').length;
    return {
      file,
      label: FILE_LABEL[file],
      rows,
      added,
      removed,
      identical: added === 0 && removed === 0,
    };
  });

  return {
    files,
    added: files.reduce((sum, f) => sum + f.added, 0),
    removed: files.reduce((sum, f) => sum + f.removed, 0),
    changedFiles: files.filter((f) => !f.identical).map((f) => f.file),
  };
}

/**
 * 折叠大段未改动内容，只保留改动点附近的上下文。
 * 每个折叠段用一个占位行表示，避免几百行相同代码把界面撑爆。
 */
export interface CollapsedRow extends DiffRow {
  /** 大于 0 表示这是一个折叠占位行，值为被折叠的行数 */
  collapsed?: number;
}

export function collapseContext(rows: DiffRow[], context = 3): CollapsedRow[] {
  const keep = new Set<number>();
  rows.forEach((row, index) => {
    if (row.kind === 'equal') return;
    for (let i = index - context; i <= index + context; i += 1) {
      if (i >= 0 && i < rows.length) keep.add(i);
    }
  });

  // 没有任何改动时，仅展示开头一小段，明确告知两版一致
  if (!keep.size) return rows.slice(0, 6).map((row) => ({ ...row }));

  const out: CollapsedRow[] = [];
  let skipped = 0;
  rows.forEach((row, index) => {
    if (keep.has(index)) {
      if (skipped > 0) {
        out.push({ kind: 'equal', leftNo: null, rightNo: null, text: '', collapsed: skipped });
        skipped = 0;
      }
      out.push({ ...row });
    } else {
      skipped += 1;
    }
  });
  if (skipped > 0) {
    out.push({ kind: 'equal', leftNo: null, rightNo: null, text: '', collapsed: skipped });
  }
  return out;
}