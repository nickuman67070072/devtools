'use client';

import { CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { markAllNotificationsRead, markNotificationRead } from '@/features/user/actions';

export function MarkAllRead({ locale }: { locale: 'th' | 'en' }) {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await markAllNotificationsRead();
        router.refresh();
      }}
    >
      <CheckCheck className="size-4" />
      {locale === 'th' ? 'อ่านทั้งหมด' : 'Mark all read'}
    </Button>
  );
}
export function NotificationLink({
  id,
  href,
  children,
}: {
  id: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} onClick={() => void markNotificationRead(id)}>
      {children}
    </a>
  );
}
