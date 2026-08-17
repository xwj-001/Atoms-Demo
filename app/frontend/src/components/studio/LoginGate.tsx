import { useState } from 'react';
import {
  Atom,
  Cloud,
  Compass,
  Loader2,
  Lock,
  LogIn,
  Mail,
  Sparkles,
  UserPlus,
  UserRound,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { validateEmail, validatePassword } from '@/lib/studioAuth';

interface LoginGateProps {
  /** 邮箱密码登录 */
  onLogin: (email: string, password: string) => Promise<void>;
  /** 邮箱密码注册 */
  onRegister: (email: string, password: string, displayName: string) => Promise<void>;
  /** 建立本地游客会话 */
  onGuest: () => void;
}

const FEATURES = [
  {
    icon: Wand2,
    title: '一句话生成应用',
    desc: '描述需求并选择风格，直接产出可运行的单文件 HTML 应用',
  },
  {
    icon: Sparkles,
    title: '思维链可视化',
    desc: '需求理解、技术选型、组件设计、样式方案四阶段推理全程可见',
  },
  {
    icon: Cloud,
    title: '云端同步',
    desc: '注册账号可把作品同步到云端，换设备继续迭代不丢数据',
  },
  {
    icon: Compass,
    title: '灵感画廊',
    desc: '浏览其他用户公开分享的作品，一键预览与导出学习',
  },
];

/** 登录门：未建立任何会话前，全部功能都在这道门之后 */
export default function LoginGate({ onLogin, onRegister, onGuest }: LoginGateProps) {
  const [tab, setTab] = useState('login');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [registerEmail, setRegisterEmail] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirm, setRegisterConfirm] = useState('');

  /** 切换标签时清空错误，避免上一个表单的提示串到另一个表单 */
  const handleTabChange = (value: string) => {
    setTab(value);
    setError('');
  };

  const handleLogin = async () => {
    const emailError = validateEmail(loginEmail);
    if (emailError) {
      setError(emailError);
      return;
    }
    if (!loginPassword) {
      setError('请填写密码');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onLogin(loginEmail.trim(), loginPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async () => {
    const emailError = validateEmail(registerEmail);
    if (emailError) {
      setError(emailError);
      return;
    }
    const passwordError = validatePassword(registerPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (registerPassword !== registerConfirm) {
      setError('两次输入的密码不一致');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onRegister(registerEmail.trim(), registerPassword, registerName.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mesh-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-4xl gap-4 lg:grid-cols-[1.05fr_1fr]">
        <section className="glass animate-fade-up flex flex-col justify-center rounded-3xl p-7">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Atom className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold leading-tight tracking-tight">Atoms Studio</h1>
              <p className="text-[11px] text-muted-foreground">
                看得见的思考过程，可迭代的生成体验
              </p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={handleTabChange} className="mt-5">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" className="text-xs">
                登录
              </TabsTrigger>
              <TabsTrigger value="register" className="text-xs">
                注册
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-xs">
                  邮箱
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="bg-white/70 pl-8 text-sm"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-xs">
                  密码
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="请输入密码"
                    className="bg-white/70 pl-8 text-sm"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !submitting) void handleLogin();
                    }}
                  />
                </div>
              </div>
              <Button
                size="lg"
                className="w-full text-sm"
                disabled={submitting}
                onClick={() => void handleLogin()}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-4 w-4" />
                )}
                {submitting ? '登录中…' : '登录'}
              </Button>
            </TabsContent>

            <TabsContent value="register" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="register-email" className="text-xs">
                  邮箱
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="bg-white/70 pl-8 text-sm"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="register-name" className="text-xs">
                  昵称（可选）
                </Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="register-name"
                    placeholder="留空则使用邮箱前缀"
                    className="bg-white/70 pl-8 text-sm"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="register-password" className="text-xs">
                    密码
                  </Label>
                  <Input
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="至少 8 位含字母数字"
                    className="bg-white/70 text-sm"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="register-confirm" className="text-xs">
                    确认密码
                  </Label>
                  <Input
                    id="register-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="再次输入密码"
                    className="bg-white/70 text-sm"
                    value={registerConfirm}
                    onChange={(e) => setRegisterConfirm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !submitting) void handleRegister();
                    }}
                  />
                </div>
              </div>
              <Button
                size="lg"
                className="w-full text-sm"
                disabled={submitting}
                onClick={() => void handleRegister()}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                {submitting ? '注册中…' : '注册并进入'}
              </Button>
            </TabsContent>
          </Tabs>

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] leading-relaxed text-destructive"
            >
              {error}
            </p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/70" />
            <span className="text-[10px] text-muted-foreground">或</span>
            <span className="h-px flex-1 bg-white/70" />
          </div>

          <Button
            variant="outline"
            className="mt-3 w-full bg-white/60 text-sm"
            disabled={submitting}
            onClick={onGuest}
          >
            <UserRound className="mr-2 h-4 w-4" />
            游客登录（仅本地存储）
          </Button>

          <ul className="mt-5 space-y-1.5 border-t border-white/60 pt-4 text-[11px] leading-relaxed text-muted-foreground">
            <li>· 游客模式：可生成、迭代、版本历史、导出，数据存本地 IndexedDB</li>
            <li>· 注册账号：额外解锁云端同步与灵感画廊，可跨设备继续创作</li>
            <li>· 密码经加盐哈希后存储，服务端不保存明文</li>
          </ul>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {FEATURES.map((feature, index) => (
            <article
              key={feature.title}
              className="glass-soft animate-fade-up rounded-2xl p-4"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <feature.icon className="h-4 w-4 text-primary" />
              <h2 className="mt-2.5 text-sm font-semibold">{feature.title}</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {feature.desc}
              </p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}