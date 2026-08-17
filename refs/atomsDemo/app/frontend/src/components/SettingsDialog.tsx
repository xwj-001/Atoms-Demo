import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/store/authStore';
import { DEFAULT_LLM_SETTINGS, type LLMMode, type LLMSettings } from '@/lib/llm/adapter';
import { toast } from 'sonner';
import { Bot, Key, Globe, Save } from 'lucide-react';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { settings, updateSettings } = useAuthStore();
  const [localSettings, setLocalSettings] = useState<LLMSettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, open]);

  const handleModeChange = (mode: string) => {
    setLocalSettings((prev) => ({ ...prev, mode: mode as LLMMode }));
  };

  const handleModelChange = (model: string) => {
    setLocalSettings((prev) => ({ ...prev, model }));
  };

  const handleSave = () => {
    updateSettings(localSettings);
    toast.success('设置已保存');
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalSettings({ ...DEFAULT_LLM_SETTINGS });
    toast.info('已恢复默认设置');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-800 text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-white">设置</DialogTitle>
          <DialogDescription className="text-slate-400">
            配置 LLM 模型与运行模式
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="llm" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-800">
            <TabsTrigger value="llm" className="data-[state=active]:bg-slate-700">
              <Bot className="w-4 h-4 mr-2" />
              模型设置
            </TabsTrigger>
            <TabsTrigger value="about" className="data-[state=active]:bg-slate-700">
              <Globe className="w-4 h-4 mr-2" />
              关于
            </TabsTrigger>
          </TabsList>

          <TabsContent value="llm" className="space-y-6 mt-4">
            {/* 运行模式 */}
            <div className="space-y-2">
              <Label className="text-slate-300">运行模式</Label>
              <Select value={localSettings.mode} onValueChange={handleModeChange}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                  <SelectValue placeholder="选择运行模式" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                  <SelectItem value="atoms" className="hover:bg-slate-700 focus:bg-slate-700">
                    <div className="flex flex-col">
                      <span>Atoms 代理（推荐）</span>
                      <span className="text-xs text-slate-400">走后端代理，Key 不出服务端</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="openai" className="hover:bg-slate-700 focus:bg-slate-700">
                    <div className="flex flex-col">
                      <span>OpenAI 兼容</span>
                      <span className="text-xs text-slate-400">自定义兼容端点，SSE 流式</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="mock" className="hover:bg-slate-700 focus:bg-slate-700">
                    <div className="flex flex-col">
                      <span>Mock 模板</span>
                      <span className="text-xs text-slate-400">预置模板，离线可用</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 模型名称 */}
            <div className="space-y-2">
              <Label className="text-slate-300">模型名称</Label>
              <Input
                value={localSettings.model}
                onChange={(e) => handleModelChange(e.target.value)}
                placeholder="claude-opus-5"
                className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
                disabled={localSettings.mode === 'mock'}
              />
              <p className="text-xs text-slate-500">
                {localSettings.mode === 'mock'
                  ? 'Mock 模式下模型名称不生效'
                  : '填写要使用的模型标识'}
              </p>
            </div>

            {/* Atoms 模式专属配置 */}
            {localSettings.mode === 'atoms' && (
              <div className="space-y-2">
                <Label className="text-slate-300">
                  <Globe className="w-3.5 h-3.5 inline mr-1" />
                  后端代理地址
                </Label>
                <Input
                  value={localSettings.apiBaseUrl}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({ ...prev, apiBaseUrl: e.target.value }))
                  }
                  placeholder="/api/v1"
                  className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
                />
                <p className="text-xs text-slate-500">
                  自定义后端代理地址，部署到其他平台时修改
                </p>
              </div>
            )}

            {/* OpenAI 模式专属配置 */}
            {localSettings.mode === 'openai' && (
              <>
                <div className="space-y-2">
                  <Label className="text-slate-300">
                    <Globe className="w-3.5 h-3.5 inline mr-1" />
                    API Base URL
                  </Label>
                  <Input
                    value={localSettings.baseUrl}
                    onChange={(e) =>
                      setLocalSettings((prev) => ({ ...prev, baseUrl: e.target.value }))
                    }
                    placeholder="https://api.openai.com/v1"
                    className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">
                    <Key className="w-3.5 h-3.5 inline mr-1" />
                    API Key
                  </Label>
                  <Input
                    type="password"
                    value={localSettings.apiKey}
                    onChange={(e) =>
                      setLocalSettings((prev) => ({ ...prev, apiKey: e.target.value }))
                    }
                    placeholder="sk-..."
                    className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
                  />
                  <p className="text-xs text-amber-400/80">
                    ⚠️ 浏览器侧存储 Key 存在安全风险，建议使用 Atoms 代理模式
                  </p>
                </div>
              </>
            )}

            {/* Mock 模式提示 */}
            {localSettings.mode === 'mock' && (
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <p className="text-sm text-slate-400">
                  Mock 模式使用预置模板生成应用，无需网络连接，适合演示和离线使用。
                  生成的应用为固定模板内容，不具备真实 AI 生成能力。
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="about" className="space-y-4 mt-4">
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">AtomsBuilder</h3>
                  <p className="text-xs text-slate-400">智能体驱动的 Web 应用生成平台</p>
                </div>
              </div>
              <div className="text-sm text-slate-400 space-y-2">
                <p>• 4 个智能体串行流水线协同工作</p>
                <p>• 一句话需求 → 可运行应用</p>
                <p>• 支持对话式迭代修改</p>
                <p>• 项目与版本本地持久化</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* 底部按钮 */}
        <div className="flex justify-between items-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            恢复默认
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="hover:bg-slate-800 text-slate-300"
            >
              取消
            </Button>
            <Button onClick={handleSave} className="bg-violet-600 hover:bg-violet-700 text-white">
              <Save className="w-4 h-4 mr-2" />
              保存设置
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
