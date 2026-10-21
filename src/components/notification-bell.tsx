'use client';

import { Bell, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { markNotificationRead } from '@/features/user/actions';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';

interface UnreadItem {
  id: string;
  titleTh: string;
  titleEn: string;
  bodyTh: string;
  bodyEn: string;
  link: string | null;
  kind: 'CHAT' | 'GENERAL';
}

export function NotificationBell({ locale, enabled }: { locale: Locale; enabled: boolean }) {
  const [count, setCount] = useState(0);
  const [popup, setPopup] = useState<UnreadItem | null>(null);
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!enabled) {
      known.current = null;
      return;
    }
    let alive = true;
    let busy = false;
    async function refresh() {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      try {
        const response = await fetch('/api/notifications/unread', { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { count: number; items: UnreadItem[] };
        if (!alive) return;
        const previous = known.current;
        const current = new Set(data.items.map((item) => item.id));
        known.current = current;
        setCount(data.count);
        if (previous) {
          const path = window.location.pathname.replace(/^\/en(?=\/)/u, '');
          const newest = data.items.find(
            (item) => item.kind === 'CHAT' && !previous.has(item.id) && item.link !== path,
          );
          if (newest) setPopup(newest);
        }
      } catch {
        // The next poll or tab focus retries without disrupting navigation.
      } finally {
        busy = false;
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    const focused = () => void refresh();
    window.addEventListener('focus', focused);
    document.addEventListener('visibilitychange', focused);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('focus', focused);
      document.removeEventListener('visibilitychange', focused);
    };
  }, [enabled]);

  useEffect(() => {
    if (!popup) return;
    const timer = window.setTimeout(() => setPopup(null), 7000);
    return () => clearTimeout(timer);
  }, [popup]);

  if (!enabled) return null;
  const href =
    popup?.link?.startsWith('/') && !popup.link.startsWith('//')
      ? withLocale(locale, popup.link)
      : withLocale(locale, '/notifications');
  return (
    <>
      <a
        className="relative inline-flex rounded-md p-2.5 text-[var(--forest)] transition hover:bg-[var(--surface-soft)]"
        href={withLocale(locale, '/notifications')}
        aria-label={
          locale === 'th'
            ? `การแจ้งเตือนที่ยังไม่อ่าน ${count} รายการ`
            : `${count} unread notifications`
        }
      >
        <Bell className="size-5" aria-hidden="true" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-[var(--terracotta)] px-1 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </a>
      {popup && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 right-4 z-[80] flex w-[min(22rem,calc(100vw-2rem))] items-start gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-lg"
        >
          <Bell className="mt-0.5 size-5 shrink-0 text-[var(--forest)]" aria-hidden="true" />
          <a
            className="min-w-0 flex-1 text-sm"
            href={href}
            onClick={(event) => {
              event.preventDefault();
              const next = href;
              void markNotificationRead(popup.id).finally(() => {
                window.location.href = next;
              });
            }}
          >
            <strong className="block">{locale === 'th' ? popup.titleTh : popup.titleEn}</strong>
            <span className="mt-1 block text-[var(--text-muted)]">
              {locale === 'th' ? popup.bodyTh : popup.bodyEn}
            </span>
          </a>
          <button
            type="button"
            onClick={() => setPopup(null)}
            aria-label={locale === 'th' ? 'ปิดแจ้งเตือน' : 'Dismiss notification'}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
