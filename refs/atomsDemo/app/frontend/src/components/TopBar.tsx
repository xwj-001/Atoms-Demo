import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import SettingsDialog from '@/components/SettingsDialog';
import { Sparkles, User, LogOut, Settings, PanelLeft, PanelLeftClose } from 'lucide-react';
import { toast } from 'sonner';

export default function TopBar() {
  const navigate = useNavigate();
  const { user, isGuest, logout } = useAuthStore();
  const { sidebarOpen } = useWorkspaceStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.info('已退出登录');
    navigate('/');
  };

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl flex items-center justify-between px-4 shrink-0 z-20">
      {/* 左侧：Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-white text-lg">atomsDemo</span>
        </div>
      </div>

      {/* 右侧：用户信息 + 设置 + 登出 */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800">
              <Settings className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-slate-900 border-slate-800 text-slate-200">
            <DropdownMenuLabel className="text-slate-400 text-xs font-normal">设置</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem
              className="hover:bg-slate-800 cursor-pointer focus:bg-slate-800"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="w-4 h-4 mr-2" />
              模型设置
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 hover:bg-slate-800 text-slate-300">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium">{user?.username || '访客'}</span>
              {isGuest && (
                <Badge variant="outline" className="text-xs h-5 px-1.5 border-amber-500/30 text-amber-400 bg-amber-500/10">
                  访客
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-slate-900 border-slate-800 text-slate-200">
            <DropdownMenuLabel className="text-slate-400 text-xs font-normal">账号</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem className="hover:bg-slate-800 cursor-pointer focus:bg-slate-800" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  );
}
