import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import TopBar from '@/components/TopBar';
import ProjectList from '@/components/ProjectList';
import GeneratingView from '@/components/GeneratingView';
import ResultView from '@/components/ResultView';
import ChatPanel from '@/components/ChatPanel';
import { runPipeline } from '@/lib/pipeline';
import { createProject, updateProject } from '@/lib/db';
import { Sparkles, Wand2, Loader2, Lightbulb, Zap, BookOpen, ShoppingCart, Calculator, PanelLeft } from 'lucide-react';
import { toast } from 'sonner';

const EXAMPLE_CHIPS = [
  { icon: <Calculator className="w-3.5 h-3.5" />, text: '做一个个人记账本，支持增删记录和月度统计', label: '记账本' },
  { icon: <Zap className="w-3.5 h-3.5" />, text: '做一个待办事项管理，支持分类和优先级', label: '待办清单' },
  { icon: <ShoppingCart className="w-3.5 h-3.5" />, text: '做一个商品详情页，展示商品信息和购买按钮', label: '商品详情' },
  { icon: <BookOpen className="w-3.5 h-3.5" />, text: '做一个读书笔记应用，支持添加和搜索笔记', label: '读书笔记' },
  { icon: <Lightbulb className="w-3.5 h-3.5" />, text: '做一个番茄钟计时器，支持专注和休息计时', label: '番茄钟' },
];

export default function WorkspacePage() {
  const navigate = useNavigate();
  const { user, isGuest, settings, hydrated } = useAuthStore();
  const {
    phase,
    setPhase,
    sidebarOpen,
    files,
    setFiles,
    logs,
    setLogs,
    blueprint,
    setBlueprint,
    blueprintText,
    report,
    setReport,
    statusNote,
    setStatusNote,
    currentProjectId,
    setCurrentProject,
    resetToInput,
    refreshProjectList,
    toggleSidebar,
  } = useWorkspaceStore();

  const [requirement, setRequirement] = useState('');
  const [generating, setGenerating] = useState(false);
  const [chatInitialMessage, setChatInitialMessage] = useState('');

  // 检查登录状态
  useEffect(() => {
    if (hydrated && !user) {
      navigate('/');
    }
  }, [hydrated, user, navigate]);

  const handleGenerate = async () => {
    if (!requirement.trim() || generating) return;

    setGenerating(true);
    setPhase('generating');
    setLogs([]);
    setFiles({ 'index.html': '', 'style.css': '', 'app.js': '' });
    setBlueprint(null, '');
    setReport(null);
    setStatusNote('');

    try {
      const result = await runPipeline({
        requirement: requirement.trim(),
        settings,
        onEvent: (event) => {
          setLogs(event.logs);
        },
      });

      setFiles(result.files);
      setBlueprint(result.blueprint, result.blueprintText);
      setReport(result.report);
      setStatusNote(result.statusNote);
      setLogs(result.logs);

      // 保存项目
      if (!isGuest) {
        try {
          const project = await createProject({
            userId: user!.id,
            name: result.blueprint?.appName || requirement.trim().slice(0, 20),
            requirement: requirement.trim(),
            blueprint: result.blueprintText,
            files: result.files,
            logs: result.logs,
            status: result.status,
            statusNote: result.statusNote,
          });
          setCurrentProject(project);
          refreshProjectList();
        } catch (saveError) {
          console.error('保存项目失败:', saveError);
        }
      }

      if (result.outcome === 'success') {
        toast.success('应用生成成功！');
      } else if (result.outcome === 'partial') {
        toast.warning('生成完成，但未完全通过测试');
      } else if (result.outcome === 'aborted') {
        toast.error('需求过于模糊，请补充信息后重试');
      } else {
        toast.error('生成失败');
      }

      setPhase('result');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '生成失败');
      setPhase('input');
    } finally {
      setGenerating(false);
    }
  };

  const handleFixError = (errorMessage: string) => {
    setChatInitialMessage(`帮我修复以下运行时错误：\n${errorMessage}`);
    // 打开对话面板
    useWorkspaceStore.getState().setChatPanelOpen(true);
  };

  const handleNewProject = () => {
    resetToInput();
    setRequirement('');
    setCurrentProject(null);
  };

  if (!hydrated || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      <TopBar />

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧项目列表 */}
        {sidebarOpen ? (
          <div className="w-64 border-r border-slate-800 shrink-0 overflow-hidden">
            <ProjectList />
          </div>
        ) : (
          <div className="w-12 border-r border-slate-800 shrink-0 bg-slate-900/50 flex flex-col items-center pt-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white hover:bg-slate-800"
              onClick={toggleSidebar}
              title="展开侧栏"
            >
              <PanelLeft className="w-5 h-5" />
            </Button>
          </div>
        )}

        {/* 主工作区 */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">

          {/* 需求输入页 */}
          {phase === 'input' && (
            <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
              <div className="w-full max-w-2xl">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30 mb-4">
                    <Wand2 className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-2">
                    描述你想要的应用
                  </h1>
                  <p className="text-slate-400">
                    用一句话描述你的需求，4 个智能体将协同为你生成可运行的 Web 应用
                  </p>
                </div>

                <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl">
                  <Textarea
                    value={requirement}
                    onChange={(e) => setRequirement(e.target.value)}
                    placeholder="例如：做一个个人记账本网页，支持增删记账记录，统计月度总开销..."
                    className="min-h-[140px] bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 text-base resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleGenerate();
                      }
                    }}
                  />

                  <div className="flex items-center justify-between mt-4">
                    <div className="text-xs text-slate-500">
                      Ctrl/⌘ + Enter 快速生成
                    </div>
                    <Button
                      size="lg"
                      className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/25 px-8"
                      onClick={handleGenerate}
                      disabled={!requirement.trim() || generating}
                    >
                      {generating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          启动多 Agent 流水线生成
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* 示例 chips */}
                <div className="mt-6">
                  <div className="text-sm text-slate-400 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" />
                    试试这些示例：
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {EXAMPLE_CHIPS.map((chip, index) => (
                      <button
                        key={index}
                        onClick={() => setRequirement(chip.text)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 hover:border-violet-500/50 hover:text-white transition-all"
                      >
                        {chip.icon}
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 智能体介绍 */}
                <div className="mt-8 grid grid-cols-4 gap-3">
                  {[
                    { name: '团队领导', color: 'amber', desc: '任务调度与终审' },
                    { name: '产品经理', color: 'sky', desc: '需求解析与蓝图' },
                    { name: '全栈开发', color: 'violet', desc: '代码生成与修复' },
                    { name: '测试工程师', color: 'emerald', desc: '确定性校验' },
                  ].map((agent, i) => (
                    <div
                      key={i}
                      className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 text-center"
                    >
                      <div className={`text-xs font-medium text-${agent.color}-400 mb-1`}>
                        {agent.name}
                      </div>
                      <div className="text-xs text-slate-500">{agent.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 生成中页 */}
          {phase === 'generating' && (
            <div className="flex-1 overflow-hidden">
              <GeneratingView />
            </div>
          )}

          {/* 结果页 */}
          {phase === 'result' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-hidden">
                <ResultView onFixError={handleFixError} />
              </div>
              <ChatPanel initialMessage={chatInitialMessage} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
