import { Atom, Cloud, Compass, LogIn, Sparkles, UserRound, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LoginGateProps {
  /** 跳转 Atoms Cloud 登录 / 注册 */
  onLogin: () => void;
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
    desc: '正式账号可把作品同步到云端，换设备继续迭代不丢数据',
  },
  {
    icon: Compass,
    title: '灵感画廊',
    desc: '浏览其他用户公开分享的作品，一键预览与导出学习',
  },
];

/** 登录门：未建立任何会话前，Demo 的全部功能都在这道门之后 */
export default function LoginGate({ onLogin, onGuest }: LoginGateProps) {
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

          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            登录后即可使用完整的生成工作台。想先体验可以直接进入游客模式，作品会保存在这台设备的本地库中；
            之后随时登录正式账号，把本地作品同步到云端。
          </p>

          <div className="mt-6 space-y-2.5">
            <Button size="lg" className="w-full text-sm" onClick={onLogin}>
              <LogIn className="mr-2 h-4 w-4" />
              登录 / 注册（含云端同步）
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full bg-white/60 text-sm"
              onClick={onGuest}
            >
              <UserRound className="mr-2 h-4 w-4" />
              游客登录（仅本地存储）
            </Button>
          </div>

          <ul className="mt-5 space-y-1.5 border-t border-white/60 pt-4 text-[11px] leading-relaxed text-muted-foreground">
            <li>· 游客模式：可生成、迭代、版本历史、导出，数据存本地 IndexedDB</li>
            <li>· 正式账号：额外解锁云端同步与灵感画廊，可跨设备继续创作</li>
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