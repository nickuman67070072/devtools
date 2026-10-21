import { Bell, CheckCircle2 } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { MarkAllRead, NotificationLink } from '@/features/user/notification-actions';
import { requireUser } from '@/lib/auth-guards';
import type { Locale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';

export async function NotificationsPage({ locale }: { locale: Locale }) {
  const session = await requireUser(locale);
  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const isThai = locale === 'th';
  return (
    <PageShell locale={locale}>
      <main className="container-shell max-w-4xl py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Inbox</p>
            <h1 className="mt-2 text-4xl font-black">
              {isThai ? 'การแจ้งเตือน' : 'Notifications'}
            </h1>
          </div>
          <MarkAllRead locale={locale} />
        </div>
        <div className="mt-8 grid gap-3">
          {notifications.length === 0 ? (
            <div className="rounded-[28px] border border-dashed p-12 text-center">
              <Bell className="mx-auto size-10 text-[#758b82]" />
              <p className="mt-3 font-bold">
                {isThai ? 'ยังไม่มีการแจ้งเตือน' : 'No notifications'}
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <NotificationLink key={item.id} id={item.id} href={item.link ?? '#'}>
                <article
                  className={`surface flex gap-4 p-5 ${item.readAt ? 'opacity-65' : 'ring-2 ring-[#90c9b6]'}`}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e8f5ef] text-[#2d5a43]">
                    <CheckCircle2 className="size-5" />
                  </span>
                  <div>
                    <h2 className="font-black">{isThai ? item.titleTh : item.titleEn}</h2>
                    <p className="mt-1 text-sm text-[#5e6561]">
                      {isThai ? item.bodyTh : item.bodyEn}
                    </p>
                    <p className="mt-2 text-xs text-[#879399]">
                      {item.createdAt.toLocaleString(isThai ? 'th-TH' : 'en-GB')}
                    </p>
                  </div>
                </article>
              </NotificationLink>
            ))
          )}
        </div>
      </main>
    </PageShell>
  );
}
