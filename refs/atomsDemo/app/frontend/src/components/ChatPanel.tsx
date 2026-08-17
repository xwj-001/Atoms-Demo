import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { complete } from '@/lib/llm/adapter';
import { parseGeneratedFiles, mergeFiles, stripCodeBlocks } from '@/lib/parser';
import { AGENTS } from '@/lib/pipeline/agents';
import type { ChatMessageRecord, AgentRole, AppFiles } from '@/lib/db';
import { generateId } from '@/lib/crypto';
import {
  Send,
  Sparkles,
  User,
  Bot,
  ChevronUp,
  ChevronDown,
  Loader2,
} from 'lucide-react';

interface ChatPanelProps {
  initialMessage?: string;
}

export default function ChatPanel({ initialMessage }: ChatPanelProps) {
  const { settings } = useAuthStore();
  const {
    files,
    setFiles,
    chatMessages,
    setChatMessages,
    appendChatMessage,
    updateLastChatMessage,
    isChatting,
    setIsChatting,
    chatPanelOpen,
    toggleChatPanel,
    chatPanelHeight,
    setChatPanelHeight,
    blueprint,
  } = useWorkspaceStore();

  const [inputValue, setInputValue] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<AgentRole>('dev');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // 初始消息填充
  useEffect(() => {
    if (initialMessage) {
      setInputValue(initialMessage);
      textareaRef.current?.focus();
    }
  }, [initialMessage]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatting]);

  // 自动调整 textarea 高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

  // 拖拽调整高度
  const handleDragStart = (e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = chatPanelHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const diff = startY.current - e.clientY;
      const newHeight = Math.max(120, Math.min(600, startHeight.current + diff));
      setChatPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setChatPanelHeight]);

  const handleSend = async () => {
    if (!inputValue.trim() || isChatting) return;

    const userMessage: ChatMessageRecord = {
      id: generateId(),
      role: 'user',
      content: inputValue.trim(),
      createdAt: Date.now(),
    };

    appendChatMessage(userMessage);
    setInputValue('');
    setIsChatting(true);

    const assistantMessage: ChatMessageRecord = {
      id: generateId(),
      role: 'assistant',
      content: '',
      thinking: '',
      agent: selectedAgent,
      createdAt: Date.now(),
    };
    appendChatMessage(assistantMessage);

    try {
      // 构建对话历史（剥离代码块）
      const history = chatMessages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role,
          content: m.role === 'assistant' ? stripCodeBlocks(m.content) : m.content,
        }));

      // 构建当前文件摘要
      const filesSummary = `当前文件状态：
- index.html: ${files['index.html'].length} 字符
- style.css: ${files['style.css'].length} 字符
- app.js: ${files['app.js'].length} 字符

当前完整代码：
--index.html--
${files['index.html']}
--style.css--
${files['style.css']}
--app.js--
${files['app.js']}`;

      const agent = AGENTS[selectedAgent];
      const messages = [
        { role: 'system', content: agent.systemPrompt },
        ...history,
        {
          role: 'user',
          content: `${inputValue.trim()}\n\n${filesSummary}\n\n请修改代码，保留原有功能，只做最小化修改，输出完整的三个文件。`,
        },
      ];

      const result = await complete(messages, settings, {
        onDelta: (delta, accumulated) => {
          updateLastChatMessage({ content: accumulated });
        },
      });

      // 解析代码变更
      const parsed = parseGeneratedFiles(result.content);
      if (parsed.strategy !== 'none' && Object.keys(parsed.files).length > 0) {
        const merged = mergeFiles(files, parsed.files as Partial<AppFiles>);
        setFiles(merged);
        updateLastChatMessage({
          changedFiles: Object.keys(parsed.files) as (keyof AppFiles)[],
        });
      }
    } catch (error) {
      updateLastChatMessage({
        content: `\n\n❌ 出错了：${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setIsChatting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!chatPanelOpen) {
    return (
      <div className="border-t border-slate-800 bg-slate-900/50 shrink-0">
        <button
          className="w-full h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
          onClick={toggleChatPanel}
        >
          <ChevronUp className="w-4 h-4 mr-1" />
          <span className="text-xs">展开对话面板</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="border-t border-slate-800 bg-slate-900/50 flex flex-col shrink-0"
      style={{ height: chatPanelHeight }}
    >
      {/* 拖拽条 */}
      <div
        className="h-1 cursor-ns-resize hover:bg-violet-500/50 transition-colors group"
        onMouseDown={handleDragStart}
      >
        <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mt-0 group-hover:bg-violet-400 transition-colors" />
      </div>

      {/* 头部 */}
      <div className="h-9 flex items-center justify-between px-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium text-white">对话修改</span>
          {isChatting && (
            <Badge variant="outline" className="h-5 text-xs border-violet-500/30 text-violet-400 bg-violet-500/10">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              思考中
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedAgent} onValueChange={(v) => setSelectedAgent(v as AgentRole)}>
            <SelectTrigger className="h-7 w-32 text-xs bg-slate-800 border-slate-700 text-slate-200 px-2.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="dev" className="text-xs hover:bg-slate-800 focus:bg-slate-800">全栈开发工程师</SelectItem>
              <SelectItem value="pm" className="text-xs hover:bg-slate-800 focus:bg-slate-800">产品经理</SelectItem>
              <SelectItem value="qa" className="text-xs hover:bg-slate-800 focus:bg-slate-800">测试工程师</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={toggleChatPanel}
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 消息列表 */}
      <ScrollArea className="flex-1 min-h-0">
        <div ref={scrollRef} className="p-3 space-y-4">
          {chatMessages.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
              用自然语言描述你想修改的内容，智能体会帮你调整代码
            </div>
          )}

          {chatMessages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  message.role === 'user'
                    ? 'bg-slate-700'
                    : 'bg-gradient-to-br from-violet-500 to-indigo-600'
                }`}
              >
                {message.role === 'user' ? (
                  <User className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-white" />
                )}
              </div>

              <div className={`flex-1 min-w-0 ${message.role === 'user' ? 'text-right' : ''}`}>
                {message.agent && (
                  <div className={`text-xs text-slate-500 mb-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                    {AGENTS[message.agent].name}
                  </div>
                )}

                {/* 思考过程 */}
                {message.thinking && (
                  <div className="mb-2">
                    <div className="text-xs text-violet-400 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      思考过程
                    </div>
                    <div className="bg-violet-950/30 border border-violet-900/30 rounded-lg p-2 text-xs text-violet-200/80 font-mono whitespace-pre-wrap">
                      {message.thinking}
                    </div>
                  </div>
                )}

                {/* 消息内容 */}
                <div
                  className={`inline-block max-w-full text-sm rounded-lg px-3 py-2 whitespace-pre-wrap break-words ${
                    message.role === 'user'
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-800 text-slate-200'
                  }`}
                >
                  {message.content || (isChatting ? '...' : '')}
                </div>

                {/* 变更文件标记 */}
                {message.changedFiles && message.changedFiles.length > 0 && (
                  <div className={`mt-1.5 flex gap-1 flex-wrap ${message.role === 'user' ? 'justify-end' : ''}`}>
                    {message.changedFiles.map((file) => (
                      <Badge
                        key={file}
                        variant="outline"
                        className="text-xs h-5 border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                      >
                        已更新 {file}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* 输入框 */}
      <div className="p-3 border-t border-slate-800 shrink-0">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你想修改的内容，比如「把按钮改成蓝色」、「添加一个筛选功能」..."
            className="min-h-[40px] max-h-[120px] resize-none bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 pr-12 text-sm"
            disabled={isChatting}
          />
          <Button
            size="icon"
            className="absolute right-2 bottom-2 w-7 h-7 bg-violet-600 hover:bg-violet-500 text-white"
            onClick={handleSend}
            disabled={!inputValue.trim() || isChatting}
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="text-xs text-slate-500 mt-1.5 flex items-center justify-between">
          <span>Enter 发送，Shift+Enter 换行</span>
          <span>当前智能体：{AGENTS[selectedAgent].name}</span>
        </div>
      </div>
    </div>
  );
}
