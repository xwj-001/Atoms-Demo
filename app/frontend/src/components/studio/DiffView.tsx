import { useMemo, useState } from 'react';
import { FileDiff as FileDiffIcon, Minus, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { collapseContext, diffFiles, type CollapsedRow } from '@/lib/diff';
import { FILE_LABEL, type CodeFiles } from '@/lib/codeFiles';

interface DiffViewProps {
  oldFiles: CodeFiles;
  newFiles: CodeFiles;
  oldLabel: string;
  newLabel: string;
}

const ROW_STYLE: Record<CollapsedRow['kind'], string> = {
  equal: 'bg-transparent text-muted-foreground',
  added: 'bg-mint/12 text-foreground',
  removed: 'bg-destructive/10 text-foreground',
};

const SIGN: Record<CollapsedRow['kind'], string> = {
  equal: ' ',
  added: '+',
  removed: '-',
};

/** 单个文件的行级差异表格，未改动的大段内容会被折叠 */
function FileDiffTable({ rows }: { rows: CollapsedRow[] }) {
  if (!rows.length) {
    return <p className="px-3 py-4 text-[11px] text-muted-foreground">该文件两版内容完全一致。</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-[11px] leading-relaxed">
        <tbody>
          {rows.map((row, index) => {
            if (row.collapsed) {
              return (
                <tr key={`fold-${index}`} className="bg-muted/40">
                  <td colSpan={4} className="px-3 py-1 text-center text-[10px] text-muted-foreground">
                    ⋯ 折叠 {row.collapsed} 行未改动内容 ⋯
                  </td>
                </tr>
              );
            }
            return (
              <tr key={`row-${index}`} className={ROW_STYLE[row.kind]}>
                <td className="w-10 select-none border-r border-border/60 px-2 text-right text-[10px] text-muted-foreground/70">
                  {row.leftNo ?? ''}
                </td>
                <td className="w-10 select-none border-r border-border/60 px-2 text-right text-[10px] text-muted-foreground/70">
                  {row.rightNo ?? ''}
                </td>
                <td className="w-5 select-none text-center text-[10px] font-semibold">
                  {SIGN[row.kind]}
                </td>
                <td className="whitespace-pre-wrap break-all px-2 py-0.5">{row.text || ' '}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 版本差异视图：只能「预览 / 恢复」时看不清一轮迭代到底改了什么，
 * 有了行级差异，配合已存档的校验结论就能判断这一轮是变好还是变坏。
 */
export default function DiffView({ oldFiles, newFiles, oldLabel, newLabel }: DiffViewProps) {
  const summary = useMemo(() => diffFiles(oldFiles, newFiles), [oldFiles, newFiles]);
  const [activeFile, setActiveFile] = useState<keyof CodeFiles>(
    () => summary.changedFiles[0] ?? 'html',
  );

  const active = summary.files.find((f) => f.file === activeFile) ?? summary.files[0];
  const rows = useMemo(() => (active ? collapseContext(active.rows) : []), [active]);

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <FileDiffIcon className="h-3.5 w-3.5" />
          {oldLabel} → {newLabel}
        </span>
        <Badge className="h-5 gap-0.5 bg-mint/18 px-1.5 text-[10px] text-mint hover:bg-mint/18">
          <Plus className="h-2.5 w-2.5" />
          {summary.added}
        </Badge>
        <Badge className="h-5 gap-0.5 bg-destructive/12 px-1.5 text-[10px] text-destructive hover:bg-destructive/12">
          <Minus className="h-2.5 w-2.5" />
          {summary.removed}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {summary.files.map((file) => (
          <button
            key={file.file}
            type="button"
            onClick={() => setActiveFile(file.file)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors duration-200 ${
              activeFile === file.file
                ? 'bg-primary text-primary-foreground'
                : 'bg-white/60 text-muted-foreground hover:bg-white/85'
            }`}
          >
            {FILE_LABEL[file.file]}
            {file.identical ? (
              <span className="ml-1 opacity-60">无改动</span>
            ) : (
              <span className="ml-1 opacity-80">
                +{file.added} / -{file.removed}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-white/70 bg-white/70">
        <FileDiffTable rows={rows} />
      </div>
    </div>
  );
}