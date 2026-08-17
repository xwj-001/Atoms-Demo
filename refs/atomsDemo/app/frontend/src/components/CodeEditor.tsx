import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useWorkspaceStore } from '@/store/workspaceStore';
import type { AppFiles, FileName } from '@/lib/db';
import { FileCode, FileText, Braces } from 'lucide-react';

interface CodeEditorProps {
  files: AppFiles;
  onChange?: (name: FileName, content: string) => void;
}

const FILE_CONFIG: { name: FileName; label: string; icon: React.ReactNode; lang: string }[] = [
  { name: 'index.html', label: 'index.html', icon: <FileCode className="w-3.5 h-3.5" />, lang: 'html' },
  { name: 'style.css', label: 'style.css', icon: <FileText className="w-3.5 h-3.5" />, lang: 'css' },
  { name: 'app.js', label: 'app.js', icon: <Braces className="w-3.5 h-3.5" />, lang: 'js' },
];

export default function CodeEditor({ files, onChange }: CodeEditorProps) {
  const updateFile = useWorkspaceStore((state) => state.updateFile);

  const handleChange = (name: FileName, value: string) => {
    updateFile(name, value);
    onChange?.(name, value);
  };

  const extensions = useMemo(() => ({
    html: [html()],
    css: [css()],
    js: [javascript()],
  }), []);

  return (
    <div className="h-full flex flex-col bg-slate-950">
      <Tabs defaultValue="index.html" className="h-full flex flex-col">
        <div className="border-b border-slate-800 bg-slate-900/50 shrink-0">
          <TabsList className="h-10 bg-transparent p-0 gap-0">
            {FILE_CONFIG.map((file) => (
              <TabsTrigger
                key={file.name}
                value={file.name}
                className="h-10 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-500 data-[state=active]:bg-slate-800/50 data-[state=active]:shadow-none text-slate-400 data-[state=active]:text-white text-xs font-mono gap-1.5"
              >
                {file.icon}
                {file.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {FILE_CONFIG.map((file) => (
          <TabsContent
            key={file.name}
            value={file.name}
            className="flex-1 m-0 p-0 h-0 min-h-0"
          >
            <div className="h-full">
              <CodeMirror
                value={files[file.name]}
                height="100%"
                theme={oneDark}
                extensions={extensions[file.lang as keyof typeof extensions]}
                onChange={(value) => handleChange(file.name, value)}
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLineGutter: true,
                  highlightActiveLine: true,
                  foldGutter: true,
                  autocompletion: true,
                  bracketMatching: true,
                  closeBrackets: true,
                  indentOnInput: true,
                  syntaxHighlighting: true,
                  searchKeymap: true,
                  historyKeymap: true,
                  tabSize: 2,
                }}
                className="h-full text-sm [&_.cm-editor]:h-full [&_.cm-scroller]:font-mono"
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
