import { CloudUpload, KeyRound, LogIn, LogOut, RefreshCw, User2, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { StudioUser } from '@/lib/cloud';

export type AuthState = 'loading' | 'authenticated' | 'anonymous';

interface AccountMenuProps {
  authState: AuthState;
  user: StudioUser | null;
  /** 游客模式下的显示名，正式账号为 null */
  guestName: string | null;
  syncing: boolean;
  lastSyncText: string;
  onLogin: () => void;
  onLogout: () => void;
  onSync: () => void;
  /** 打开修改密码弹窗（仅自建账号可用） */
  onChangePassword: () => void;
}

/** 右上角账户入口：区分自建账号与游客会话，分别提供同步、改密与升级登录 */
export default function AccountMenu({
  authState,
  user,
  guestName,
  syncing,
  lastSyncText,
  onLogin,
  onLogout,
  onSync,
  onChangePassword,
}: AccountMenuProps) {
  if (authState === 'loading') {
    return (
      <Button variant="outline" size="sm" disabled className="bg-white/60">
        <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        检查登录
      </Button>
    );
  }

  if (authState === 'anonymous' || !user) {
    if (!guestName) {
      return (
        <Button size="sm" onClick={onLogin}>
          <LogIn className="mr-1.5 h-3.5 w-3.5" />
          登录 / 注册
        </Button>
      );
    }
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="bg-white/60">
            <UserRound className="mr-1.5 h-3.5 w-3.5" />
            {guestName}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="space-y-1">
            <p className="text-xs font-semibold">游客模式</p>
            <p className="text-[11px] font-normal leading-relaxed text-muted-foreground">
              作品仅保存在这台设备的本地库，注册账号后可同步到云端并公开分享。
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onLogin} className="gap-2 text-xs">
            <LogIn className="h-3.5 w-3.5" />
            登录 / 注册账号
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onLogout} className="gap-2 text-xs">
            <LogOut className="h-3.5 w-3.5" />
            退出游客模式
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="bg-white/60" aria-label="账户菜单">
          <User2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-1">
          <p className="text-xs font-semibold">{user.name || '已登录'}</p>
          <p className="text-[11px] font-normal leading-relaxed text-muted-foreground">
            {lastSyncText}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            if (!syncing) onSync();
          }}
          className="gap-2 text-xs"
        >
          {syncing ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CloudUpload className="h-3.5 w-3.5" />
          )}
          {syncing ? '正在同步…' : '立即同步到云端'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onChangePassword} className="gap-2 text-xs">
          <KeyRound className="h-3.5 w-3.5" />
          修改密码
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout} className="gap-2 text-xs">
          <LogOut className="h-3.5 w-3.5" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface CloudBadgeProps {
  authState: AuthState;
  isGuest: boolean;
  syncing: boolean;
}

/** 顶部状态徽标：自建账号显示云端状态，游客显示本地存储提示 */
export function CloudBadge({ authState, isGuest, syncing }: CloudBadgeProps) {
  if (authState === 'loading') return null;
  if (authState === 'anonymous') {
    if (!isGuest) return null;
    return (
      <Badge variant="outline" className="hidden gap-1 bg-white/50 text-[11px] sm:flex">
        <UserRound className="h-3 w-3 text-muted-foreground" />
        本地存储
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="hidden gap-1 bg-white/50 text-[11px] sm:flex">
      {syncing ? (
        <RefreshCw className="h-3 w-3 animate-spin text-primary" />
      ) : (
        <CloudUpload className="h-3 w-3 text-primary" />
      )}
      {syncing ? '同步中' : '云端已连接'}
    </Badge>
  );
}