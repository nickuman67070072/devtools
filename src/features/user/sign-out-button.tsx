'use client';

import { LoaderCircle, LogOut } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';

export function SignOutButton({
  locale,
  variant = 'danger',
  className,
}: {
  locale: 'th' | 'en';
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      window.location.assign(locale === 'en' ? '/en' : '/');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : locale === 'th'
            ? 'ออกจากระบบไม่สำเร็จ กรุณาลองใหม่'
            : 'Could not sign out. Please try again.',
      );
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={pending}
      onClick={() => void signOut()}
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="size-4" aria-hidden="true" />
      )}
      {pending
        ? locale === 'th'
          ? 'กำลังออกจากระบบ…'
          : 'Signing out…'
        : locale === 'th'
          ? 'ออกจากระบบ'
          : 'Sign out'}
    </Button>
  );
}
