import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { html as htmlLang } from '@codemirror/lang-html';
import { css as cssLang } from '@codemirror/lang-css';
import { javascript as jsLang } from '@codemirror/lang-javascript';
import { FileCode2, Lock, LockOpen, RotateCcw, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FILE_LABEL, FILE_ORDER, type CodeFiles, type FileLocks } from '@/lib/codeFiles';

interface CodeWorkspaceProps {
  files: CodeFiles;
  activeFile: keyof CodeFiles;
  onActiveFileChange: (file: keyof CodeFiles) => void;
  onFileChange: (file: keyof CodeFiles, value: string) => void;
  /** 是否存在未应用到预览的改动 */
  dirty: boolean;
  onApply: () => void;
  onReset: () => void;
  /** 文件锁定状态：锁定后模型迭代不会覆盖该文件 */
  locks: FileLocks;
  onToggleLock: (file: keyof CodeFiles) => void;
  disabled: boolean;
}

const EXTENSIONS = {
  html: [htmlLang()],
  css: [cssLang()],
  js: [jsLang()],
};

/** 代码工作区：三文件分栏编辑 + 文件锁定，改动可应用回预览并存为新版本 */
export default function CodeWorkspace({
  files,
  activeFile,
  onActiveFileChange,
  onFileChange,
  dirty,
  onApply,
  onReset,
  locks,
  onToggleLock,
  disabled,
}: CodeWorkspaceProps) {
  const lineCounts = useMemo(
    () =>
      FILE_ORDER.reduce<Record<string, number>>((acc, key) => {
        const value = files[key];
        acc[key] = value ? value.split('\n').length : 0;
        return acc;
      }, {}),
    [files],
  );

  const lockedCount = FILE_ORDER.filter((key) => locks[key]).length;
  const activeLocked = locks[activeFile];

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <FileCode2 className="h-3.5 w-3.5" />
          代码工作区
        </span>
        <div className="flex items-center gap-1">
          {FILE_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onActiveFileChange(key)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors duration-200 ${
                activeFile === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white/60 text-muted-foreground hover:bg-white/85'
              }`}
            >
              {locks[key] && <Lock className="h-2.5 w-2.5" />}
              {FILE_LABEL[key]}
              <span className="opacity-70">{lineCounts[key]}</span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {dirty && (
            <Badge className="h-5 bg-warm/18 px-1.5 text-[10px] text-warm-foreground hover:bg-warm/18">
              有未保存改动
            </Badge>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                onClick={() => onToggleLock(activeFile)}
              >
                {activeLocked ? (
                  <LockOpen className="mr-1 h-3 w-3" />
                ) : (
                  <Lock className="mr-1 h-3 w-3" />
                )}
                {activeLocked ? '解锁' : '锁定'}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-64 text-[11px] leading-relaxed">
              锁定后，后续 AI 迭代与自动修复都不会改动{FILE_LABEL[activeFile]}，模型只能读取它作为参考。
            </TooltipContent>
          </Tooltip>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            disabled={!dirty || disabled}
            onClick={onReset}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            还原
          </Button>
          <Button
            size="sm"
            className="h-7 px-2 text-[11px]"
            disabled={!dirty || disabled}
            onClick={onApply}
          >
            <Save className="mr-1 h-3 w-3" />
            应用并存为新版本
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-white/70 bg-white">
        <CodeMirror
          value={files[activeFile]}
          height="100%"
          className="h-full text-[12px]"
          extensions={EXTENSIONS[activeFile]}
          editable={!disabled}
          basicSetup={{ lineNumbers: true, highlightActiveLine: true, foldGutter: true }}
          onChange={(value) => onFileChange(activeFile, value)}
        />
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {lockedCount > 0
          ? `已锁定 ${lockedCount} 个文件，后续迭代不会被模型覆盖；手改过的文件会自动加锁，确认可以交给 AI 时再解锁。`
          : '直接改这三个文件，点「应用并存为新版本」后会重新跑一次质量校验；手改过的文件会自动加锁，避免下一轮迭代把改动冲掉。'}
      </p>
    </div>
  );
}