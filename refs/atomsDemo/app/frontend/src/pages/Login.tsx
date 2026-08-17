import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { Sparkles, User, Lock, Wand2 } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register, enterGuest } = useAuthStore();

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirm, setRegisterConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword) {
      toast.error('请输入用户名和密码');
      return;
    }
    setLoading(true);
    try {
      await login(loginUsername, loginPassword);
      toast.success('登录成功');
      navigate('/workspace');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerUsername.trim() || !registerPassword) {
      toast.error('请输入用户名和密码');
      return;
    }
    if (registerPassword !== registerConfirm) {
      toast.error('两次密码不一致');
      return;
    }
    if (registerPassword.length < 6) {
      toast.error('密码至少 6 个字符');
      return;
    }
    setLoading(true);
    try {
      await register(registerUsername, registerPassword);
      toast.success('注册成功');
      navigate('/workspace');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = () => {
    enterGuest();
    toast.info('已进入访客模式，项目不会被保存');
    navigate('/workspace');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              atomsDemo
            </h1>
          </div>
          <p className="text-slate-400 text-sm">
            智能体驱动的 Web 应用生成平台
          </p>
        </div>

        <Card className="bg-slate-900/80 backdrop-blur-xl border-slate-800 shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-white">欢迎回来</CardTitle>
            <CardDescription className="text-slate-400">
              登录后开始创建你的应用
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-800">
                <TabsTrigger value="login" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                  登录
                </TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                  注册
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        type="text"
                        placeholder="用户名"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        type="password"
                        placeholder="密码"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/25"
                    disabled={loading}
                  >
                    {loading ? '登录中...' : '登录'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        type="text"
                        placeholder="用户名（至少 2 个字符）"
                        value={registerUsername}
                        onChange={(e) => setRegisterUsername(e.target.value)}
                        className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        type="password"
                        placeholder="密码（至少 6 个字符）"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        type="password"
                        placeholder="确认密码"
                        value={registerConfirm}
                        onChange={(e) => setRegisterConfirm(e.target.value)}
                        className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/25"
                    disabled={loading}
                  >
                    {loading ? '注册中...' : '注册账号'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* 分隔线 */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-slate-900/80 text-slate-500">或者</span>
              </div>
            </div>

            {/* 访客模式 */}
            <Button
              variant="outline"
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={handleGuest}
            >
              <Wand2 className="w-4 h-4 mr-2" />
              以访客身份体验
            </Button>

            <p className="text-xs text-slate-500 text-center mt-4">
              访客模式可体验完整功能，但项目不会被保存
            </p>
          </CardContent>
        </Card>

        {/* 底部说明 */}
        <div className="mt-6 text-center">
          <Badge variant="outline" className="border-slate-700 text-slate-400 bg-slate-900/50">
            <Sparkles className="w-3 h-3 mr-1 text-violet-400" />
            4 智能体协同 · 一句话生成可运行应用
          </Badge>
        </div>
      </div>
    </div>
  );
}
