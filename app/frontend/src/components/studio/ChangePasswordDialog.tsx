import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changePassword, validatePassword } from '@/lib/studioAuth';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 修改密码弹窗：需要校验当前密码，成功后清空表单 */
export default function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError('');
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) reset();
    onOpenChange(value);
  };

  const handleSubmit = async () => {
    if (!current) {
      setError('请填写当前密码');
      return;
    }
    const passwordError = validatePassword(next);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (next !== confirm) {
      setError('两次输入的新密码不一致');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const message = await changePassword(current, next);
      toast.success(message);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改密码失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" />
            修改密码
          </DialogTitle>
          <DialogDescription className="text-xs">
            修改成功后当前登录仍然有效，下次登录请使用新密码。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="current-password" className="text-xs">
              当前密码
            </Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              className="text-sm"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-xs">
              新密码
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="至少 8 位含字母数字"
              className="text-sm"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-xs">
              确认新密码
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              className="text-sm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !submitting) void handleSubmit();
              }}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] leading-relaxed text-destructive"
            >
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={submitting}
            onClick={() => handleOpenChange(false)}
          >
            取消
          </Button>
          <Button size="sm" className="text-xs" disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {submitting ? '提交中…' : '确认修改'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}