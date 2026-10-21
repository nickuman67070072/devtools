'use client';

import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { authClient } from '@/lib/auth-client';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

export function AuthForm({ mode, locale }: { mode: AuthMode; locale: Locale }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>();
  const isThai = locale === 'th';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '')
      .trim()
      .toLowerCase();
    const password = String(form.get('password') ?? '');
    const name = String(form.get('name') ?? '').trim();

    try {
      if (mode === 'login') {
        const result = await authClient.signIn.email({
          email,
          password,
          rememberMe: form.get('remember') === 'on',
        });
        if (result.error) throw new Error(result.error.message);
        const next = searchParams.get('next');
        router.push(
          next?.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
            ? next
            : withLocale(locale, '/explore'),
        );
        router.refresh();
      } else if (mode === 'register') {
        const result = await authClient.signUp.email({ email, password, name });
        if (result.error) throw new Error(result.error.message);
        toast.success(isThai ? 'สร้างบัญชีสำเร็จ' : 'Account created');
        router.push(withLocale(locale, '/profile'));
        router.refresh();
      } else if (mode === 'forgot') {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}${withLocale(locale, '/reset-password')}`,
        });
        if (result.error) throw new Error(result.error.message);
        toast.success(
          isThai
            ? 'หากอีเมลนี้มีบัญชี เราได้ส่งลิงก์รีเซ็ตแล้ว'
            : 'If the account exists, a reset link has been sent.',
        );
        event.currentTarget.reset();
      } else {
        const token = searchParams.get('token');
        if (!token) throw new Error(isThai ? 'ลิงก์รีเซ็ตไม่สมบูรณ์' : 'The reset link is invalid');
        const confirm = String(form.get('confirmPassword') ?? '');
        if (password !== confirm) {
          throw new Error(isThai ? 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' : 'Passwords do not match');
        }
        const result = await authClient.resetPassword({ newPassword: password, token });
        if (result.error) throw new Error(result.error.message);
        toast.success(
          isThai ? 'ตั้งรหัสผ่านใหม่แล้ว กรุณาเข้าสู่ระบบ' : 'Password reset. Please sign in.',
        );
        router.push(withLocale(locale, '/login'));
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : isThai
            ? 'เกิดข้อผิดพลาด'
            : 'Something went wrong',
      );
    } finally {
      setPending(false);
    }
  }

  const titles: Record<AuthMode, [string, string]> = {
    login: ['ยินดีต้อนรับกลับมา', 'Welcome back'],
    register: ['เริ่มสำรวจไปด้วยกัน', 'Start exploring together'],
    forgot: ['ลืมรหัสผ่าน', 'Forgot password'],
    reset: ['ตั้งรหัสผ่านใหม่', 'Set a new password'],
  };
  const descriptions: Record<AuthMode, [string, string]> = {
    login: ['เข้าสู่ระบบเพื่อบันทึกและส่งข้อมูลสถานที่', 'Sign in to save and contribute places.'],
    register: ['สร้างบัญชีผู้ใช้ทั่วไปอย่างปลอดภัย', 'Create a secure community account.'],
    forgot: ['เราจะส่งลิงก์ทดสอบไปยัง Mailpit', 'We will send a test link to Mailpit.'],
    reset: ['การรีเซ็ตจะยกเลิก session เดิมทั้งหมด', 'Resetting revokes all previous sessions.'],
  };

  return (
    <main
      lang={locale}
      className="grid min-h-screen bg-[var(--background)] lg:grid-cols-[0.9fr_1.1fr]"
    >
      <aside className="relative hidden overflow-hidden border-r border-[var(--border)] bg-[var(--surface-soft)] p-12 text-[var(--forest)] lg:flex lg:flex-col lg:justify-between">
        <a
          href={withLocale(locale, '/')}
          className="inline-flex w-fit"
          aria-label="PawMap Thailand"
        >
          <BrandLogo />
        </a>
        <div className="relative z-10 max-w-lg">
          <p className="text-xs font-semibold tracking-[0.1em] text-[var(--text-muted)] uppercase">
            PawMap Thailand
          </p>
          <p className="mt-5 text-4xl leading-[1.18] font-bold tracking-[-0.03em]">
            {isThai
              ? 'ทุกการเดินทาง เริ่มจากข้อมูลที่ไว้ใจได้'
              : 'Every journey starts with information you can trust.'}
          </p>
          <p className="mt-6 max-w-md leading-8 text-[var(--text-muted)]">
            {isThai
              ? 'บันทึกสถานที่ ช่วยยืนยันข้อมูล และสร้างแผนที่ที่ดีกว่าไปด้วยกัน'
              : 'Save places, verify details, and build a better map together.'}
          </p>
        </div>
      </aside>
      <section className="grid place-items-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-7 sm:p-9">
          <a
            href={withLocale(locale, '/')}
            className="inline-flex lg:hidden"
            aria-label="PawMap Thailand"
          >
            <BrandLogo />
          </a>
          <h1 className="mt-8 text-3xl font-bold tracking-[-0.025em] text-[var(--forest)]">
            {titles[mode][isThai ? 0 : 1]}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            {descriptions[mode][isThai ? 0 : 1]}
          </p>
          <form className="mt-7 grid gap-4" onSubmit={submit}>
            {mode === 'register' && (
              <label className="grid gap-1.5 text-sm font-bold">
                {isThai ? 'ชื่อที่แสดง' : 'Display name'}
                <span className="relative">
                  <UserRound className="absolute top-3.5 left-3.5 size-4 text-[var(--text-muted)]" />
                  <Input
                    name="name"
                    required
                    minLength={2}
                    maxLength={80}
                    className="pl-10"
                    autoComplete="name"
                  />
                </span>
              </label>
            )}
            {mode !== 'reset' && (
              <label className="grid gap-1.5 text-sm font-bold">
                {isThai ? 'อีเมล' : 'Email'}
                <span className="relative">
                  <Mail className="absolute top-3.5 left-3.5 size-4 text-[var(--text-muted)]" />
                  <Input
                    name="email"
                    type="email"
                    required
                    className="pl-10"
                    autoComplete="email"
                  />
                </span>
              </label>
            )}
            {(mode === 'login' || mode === 'register' || mode === 'reset') && (
              <div className="grid gap-1.5 text-sm font-bold">
                <label htmlFor={`${mode}-password`}>{isThai ? 'รหัสผ่าน' : 'Password'}</label>
                <div className="relative">
                  <LockKeyhole className="absolute top-3.5 left-3.5 size-4 text-[var(--text-muted)]" />
                  <Input
                    id={`${mode}-password`}
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={10}
                    maxLength={128}
                    className="px-10"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    className="absolute top-2 right-2 grid size-9 place-items-center rounded-full hover:bg-[var(--forest-soft)]"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={isThai ? 'แสดงหรือซ่อนรหัสผ่าน' : 'Show or hide password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            )}
            {mode === 'reset' && (
              <label className="grid gap-1.5 text-sm font-bold">
                {isThai ? 'ยืนยันรหัสผ่าน' : 'Confirm password'}
                <Input
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
            )}
            {mode === 'login' && (
              <div className="flex items-center justify-between gap-4 text-sm">
                <label className="flex items-center gap-2 font-semibold">
                  <input
                    name="remember"
                    type="checkbox"
                    className="size-4 accent-[var(--forest-bright)]"
                  />
                  {isThai ? 'จดจำฉัน' : 'Remember me'}
                </label>
                <a
                  className="font-bold text-[var(--forest-bright)] hover:underline"
                  href={withLocale(locale, '/forgot-password')}
                >
                  {isThai ? 'ลืมรหัสผ่าน?' : 'Forgot password?'}
                </a>
              </div>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-2xl border border-[#ecc4be] bg-[var(--terracotta-soft)] px-4 py-3 text-sm font-semibold text-[var(--terracotta)]"
              >
                {error}
              </p>
            )}
            <Button type="submit" className="mt-1 w-full" disabled={pending}>
              {pending
                ? isThai
                  ? 'กำลังดำเนินการ…'
                  : 'Working…'
                : mode === 'login'
                  ? isThai
                    ? 'เข้าสู่ระบบ'
                    : 'Sign in'
                  : mode === 'register'
                    ? isThai
                      ? 'สร้างบัญชี'
                      : 'Create account'
                    : mode === 'forgot'
                      ? isThai
                        ? 'ส่งลิงก์รีเซ็ต'
                        : 'Send reset link'
                      : isThai
                        ? 'บันทึกรหัสผ่านใหม่'
                        : 'Save new password'}
              {!pending && <ArrowRight className="size-4" />}
            </Button>
          </form>
          {(mode === 'login' || mode === 'register') && (
            <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
              {mode === 'login'
                ? isThai
                  ? 'ยังไม่มีบัญชี? '
                  : 'New here? '
                : isThai
                  ? 'มีบัญชีแล้ว? '
                  : 'Already registered? '}
              <a
                className="font-extrabold text-[var(--forest-bright)] hover:underline"
                href={withLocale(locale, mode === 'login' ? '/register' : '/login')}
              >
                {mode === 'login'
                  ? isThai
                    ? 'สมัครสมาชิก'
                    : 'Create an account'
                  : isThai
                    ? 'เข้าสู่ระบบ'
                    : 'Sign in'}
              </a>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
