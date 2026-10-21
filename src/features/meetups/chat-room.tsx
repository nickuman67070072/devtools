'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Select, Textarea } from '@/components/ui/field';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';
import {
  deleteMeetupMessage,
  markMeetupChatRead,
  pinMeetupMessage,
  reportMeetup,
  sendMeetupMessage,
  setUserBlocked,
} from './actions';

interface Message {
  id: string;
  kind: string;
  text: string | null;
  mediaUrl: string | null;
  author: { id: string; name: string } | null;
  authorId: string | null;
  blocked: boolean;
  deleted: boolean;
  pinned: boolean;
  createdAt: string;
  replyTo: { id: string; text: string | null } | null;
}

export function MeetupChatRoom({
  locale,
  id,
  viewerId,
  canModerate,
  writable,
}: {
  locale: Locale;
  id: string;
  viewerId: string;
  canModerate: boolean;
  writable: boolean;
}) {
  const th = locale === 'th';
  const [messages, setMessages] = useState<Message[]>([]);
  const [before, setBefore] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [reportId, setReportId] = useState('');
  const [reportKind, setReportKind] = useState<'MESSAGE' | 'IMAGE'>('MESSAGE');
  const [reportReason, setReportReason] = useState('SPAM');
  const scrollArea = useRef<HTMLElement>(null);
  const nearBottom = useRef(true);
  const preservedHeight = useRef<number | null>(null);
  const previousLength = useRef(0);
  const initialPageLoaded = useRef(false);
  const [hasNew, setHasNew] = useState(false);

  const reload = useCallback(async () => {
    const response = await fetch(`/api/meetups/${id}/messages`, { cache: 'no-store' });
    if (response.status === 401 || response.status === 404) {
      window.location.href = withLocale(locale, `/meetups/${id}`);
      return;
    }
    if (!response.ok) {
      setError(th ? 'โหลดแชตไม่สำเร็จ' : 'Could not load chat');
      return;
    }
    const data = (await response.json()) as { items: Message[]; before: string | null };
    setMessages((current) => {
      if (!current.length) return data.items;
      const merged = new Map(current.map((message) => [message.id, message]));
      for (const message of data.items) merged.set(message.id, message);
      return [...merged.values()].sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      );
    });
    if (!initialPageLoaded.current) {
      setBefore(data.before);
      initialPageLoaded.current = true;
    }
    void markMeetupChatRead(id);
    setError('');
  }, [id, locale, th]);

  useEffect(() => {
    queueMicrotask(() => void reload());
    const events = new EventSource(`/api/meetups/${id}/events`);
    events.addEventListener('refresh', () => void reload());
    events.addEventListener('revoked', () => {
      events.close();
      window.location.href = withLocale(locale, `/meetups/${id}`);
    });
    events.onerror = () =>
      setError(th ? 'การเชื่อมต่อขัดข้อง กำลังเชื่อมต่อใหม่…' : 'Connection lost; reconnecting…');
    return () => events.close();
  }, [id, locale, reload, th]);

  async function older() {
    if (!before) return;
    const response = await fetch(
      `/api/meetups/${id}/messages?before=${encodeURIComponent(before)}`,
    );
    if (!response.ok) return;
    const data = (await response.json()) as { items: Message[]; before: string | null };
    preservedHeight.current = scrollArea.current?.scrollHeight ?? null;
    setMessages((current) => [...data.items, ...current]);
    setBefore(data.before);
  }

  useLayoutEffect(() => {
    const area = scrollArea.current;
    if (!area) return;
    if (preservedHeight.current !== null) {
      area.scrollTop += area.scrollHeight - preservedHeight.current;
      preservedHeight.current = null;
    } else if (nearBottom.current) {
      area.scrollTop = area.scrollHeight;
      setHasNew(false);
    } else if (messages.length > previousLength.current) {
      setHasNew(true);
    }
    previousLength.current = messages.length;
  }, [messages]);

  async function send() {
    if (!text.trim()) return;
    setPending(true);
    setError('');
    const result = await sendMeetupMessage(id, text, replyTo?.id);
    setPending(false);
    if (!result.ok) {
      setError(result.formError ?? 'Could not send');
      return;
    }
    setText('');
    setReplyTo(null);
    await reload();
  }

  async function upload(file: File) {
    setPending(true);
    setError('');
    const form = new FormData();
    form.set('scope', 'chat');
    form.set('file', file);
    const response = await fetch(`/api/meetups/${id}/upload`, { method: 'POST', body: form });
    setPending(false);
    if (!response.ok) {
      setError(
        th
          ? 'ส่งรูปไม่สำเร็จ (JPEG/PNG/WebP ไม่เกิน 5 MB)'
          : 'Image failed (JPEG/PNG/WebP, up to 5 MB)',
      );
      return;
    }
    await reload();
  }

  async function act(task: () => Promise<{ ok: boolean; formError?: string }>) {
    setPending(true);
    const result = await task();
    setPending(false);
    if (!result.ok) setError(result.formError ?? 'Action failed');
    else await reload();
  }

  return (
    <main className="container-shell max-w-3xl py-8">
      <a
        href={withLocale(locale, `/meetups/${id}`)}
        className="text-sm text-[var(--forest)] underline"
      >
        ← {th ? 'รายละเอียด Meetup' : 'Meetup details'}
      </a>
      <h1 className="mt-3 text-2xl font-semibold">{th ? 'แชตกลุ่ม' : 'Group chat'}</h1>
      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--terracotta)]">
          {error}
        </p>
      )}
      <section
        ref={scrollArea}
        role="log"
        aria-live="polite"
        onScroll={(event) => {
          const area = event.currentTarget;
          nearBottom.current = area.scrollHeight - area.scrollTop - area.clientHeight < 100;
          if (nearBottom.current) setHasNew(false);
        }}
        className="mt-5 h-[min(62dvh,680px)] min-h-80 space-y-3 overflow-y-auto overscroll-contain rounded-2xl border border-[var(--border)] bg-white p-4"
        aria-label={th ? 'ข้อความในแชต' : 'Chat messages'}
      >
        {before && (
          <Button variant="ghost" onClick={() => void older()}>
            {th ? 'ข้อความก่อนหน้า' : 'Earlier messages'}
          </Button>
        )}
        {messages.map((message) => (
          <article
            key={message.id}
            data-message-side={
              message.kind === 'SYSTEM'
                ? 'center'
                : message.authorId === viewerId
                  ? 'right'
                  : 'left'
            }
            className={`w-fit max-w-[85%] rounded-2xl p-3 text-sm sm:max-w-[70%] ${message.kind === 'SYSTEM' ? 'mx-auto bg-[var(--surface-soft)] text-center text-xs text-[var(--text-muted)]' : message.authorId === viewerId ? 'ml-auto bg-[var(--forest-soft)]' : 'mr-auto border border-[var(--border)] bg-white'} ${message.pinned ? 'ring-2 ring-[var(--forest)]' : ''}`}
          >
            {message.kind !== 'SYSTEM' && (
              <p className="text-xs font-semibold text-[var(--forest)]">
                {message.blocked
                  ? th
                    ? 'ข้อความที่ซ่อน'
                    : 'Hidden message'
                  : (message.author?.name ?? (th ? 'สมาชิก' : 'Member'))}{' '}
                ·{' '}
                {new Intl.DateTimeFormat(th ? 'th-TH' : 'en-GB', {
                  timeZone: 'Asia/Bangkok',
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(message.createdAt))}
              </p>
            )}
            {message.pinned && (
              <p className="text-xs text-[var(--forest)]">📌 {th ? 'ปักหมุด' : 'Pinned'}</p>
            )}
            {message.replyTo && (
              <p className="mt-1 border-l-2 pl-2 text-xs text-[var(--text-muted)]">
                ↪ {message.replyTo.text?.slice(0, 100) ?? '…'}
              </p>
            )}
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">
              {message.deleted
                ? th
                  ? 'ข้อความถูกลบแล้ว'
                  : 'Message deleted'
                : message.blocked
                  ? th
                    ? 'คุณบล็อกผู้ส่งข้อความนี้'
                    : 'You blocked this sender'
                  : message.text}
            </p>
            {message.mediaUrl && (
              <Image
                unoptimized
                width={600}
                height={400}
                src={message.mediaUrl}
                alt={th ? 'รูปในแชต Meetup' : 'Meetup chat image'}
                className="mt-2 max-h-80 max-w-full rounded-lg object-contain"
              />
            )}
            {message.blocked && message.authorId && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void act(() => setUserBlocked(message.authorId!, false))}
              >
                {th ? 'เลิกบล็อก' : 'Unblock'}
              </Button>
            )}
            {!message.deleted && message.kind !== 'SYSTEM' && !message.blocked && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button type="button" className="underline" onClick={() => setReplyTo(message)}>
                  {th ? 'ตอบกลับ' : 'Reply'}
                </button>
                {(message.author?.id === viewerId || canModerate) && (
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      if (window.confirm(th ? 'ลบข้อความ?' : 'Delete message?'))
                        void act(() => deleteMeetupMessage(id, message.id));
                    }}
                  >
                    {th ? 'ลบ' : 'Delete'}
                  </button>
                )}
                {canModerate && (
                  <button
                    type="button"
                    className="underline"
                    onClick={() =>
                      void act(() => pinMeetupMessage(id, message.id, !message.pinned))
                    }
                  >
                    {message.pinned ? (th ? 'เลิกปักหมุด' : 'Unpin') : th ? 'ปักหมุด' : 'Pin'}
                  </button>
                )}
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    setReportKind('MESSAGE');
                    setReportId(message.id);
                  }}
                >
                  {th ? 'รายงาน' : 'Report'}
                </button>
                {message.mediaUrl && (
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      setReportKind('IMAGE');
                      setReportId(message.mediaUrl!.split('/').at(-1) ?? '');
                    }}
                  >
                    {th ? 'รายงานรูป' : 'Report image'}
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
      </section>
      {hasNew && (
        <Button
          variant="secondary"
          className="mt-2"
          onClick={() => {
            if (scrollArea.current) scrollArea.current.scrollTop = scrollArea.current.scrollHeight;
            nearBottom.current = true;
            setHasNew(false);
          }}
        >
          {th ? 'ไปยังข้อความใหม่' : 'Jump to new messages'}
        </Button>
      )}
      {reportId && (
        <form
          className="mt-3 flex flex-wrap gap-2 rounded-xl border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void act(() =>
              reportMeetup(id, { target: reportKind, targetId: reportId, reason: reportReason }),
            ).then(() => setReportId(''));
          }}
        >
          <Select
            aria-label={th ? 'เหตุผลรายงานข้อความ' : 'Report reason'}
            value={reportReason}
            onChange={(event) => setReportReason(event.target.value)}
          >
            {[
              'SPAM',
              'HARASSMENT',
              'INAPPROPRIATE_CONTENT',
              'SCAM',
              'DANGEROUS_BEHAVIOR',
              'OTHER',
            ].map((reason) => (
              <option key={reason}>{reason}</option>
            ))}
          </Select>
          <Button type="submit">{th ? 'ส่งรายงาน' : 'Report'}</Button>
          <Button variant="ghost" onClick={() => setReportId('')}>
            {th ? 'ยกเลิก' : 'Cancel'}
          </Button>
        </form>
      )}
      {!writable ? (
        <p className="mt-4 rounded-xl border bg-white p-4 text-sm" role="status">
          {th ? 'แชตนี้อยู่ในโหมดอ่านอย่างเดียว' : 'This chat is read-only.'}
        </p>
      ) : (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-white p-4">
          {replyTo && (
            <p className="mb-2 text-xs">
              {th ? 'ตอบกลับ' : 'Replying to'}: {replyTo.text?.slice(0, 80)}{' '}
              <button className="underline" onClick={() => setReplyTo(null)}>
                ×
              </button>
            </p>
          )}
          <label htmlFor="meetup-chat-input" className="sr-only">
            {th ? 'ข้อความ' : 'Message'}
          </label>
          <Textarea
            id="meetup-chat-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={2000}
            placeholder={th ? 'พิมพ์ข้อความ…' : 'Write a message…'}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button disabled={pending || !text.trim()} onClick={() => void send()}>
              {th ? 'ส่งข้อความ' : 'Send'}
            </Button>
            <label className="cursor-pointer rounded-md border px-4 py-2 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-[var(--focus)]">
              {th ? 'ส่งรูป' : 'Send image'}
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                  event.target.value = '';
                }}
              />
            </label>
            {['🙂', '🐕', '🐈', '❤️'].map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`${th ? 'เพิ่มอีโมจิ' : 'Add emoji'} ${emoji}`}
                onClick={() => setText((current) => current + emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
