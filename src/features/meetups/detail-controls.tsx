'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Select, Textarea } from '@/components/ui/field';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';
import { meetupActionError } from './action-errors';
import {
  cancelMeetup,
  cancelMeetupJoinRequest,
  decideMeetupJoinRequest,
  deleteMeetupAsAdmin,
  joinMeetup,
  leaveMeetup,
  moderateMeetupMember,
  reportMeetup,
  setMeetupClosed,
  setUserBlocked,
  transferMeetupHost,
} from './actions';

interface Member {
  userId: string;
  user: { name: string; role: string };
}

export function MeetupDetailControls({
  locale,
  id,
  status,
  viewerId,
  isHost,
  isAdmin,
  isMember,
  requestStatus,
  pendingRequests,
  members,
  coverObjectKey,
}: {
  locale: Locale;
  id: string;
  status: string;
  viewerId: string | null;
  isHost: boolean;
  isAdmin: boolean;
  isMember: boolean;
  requestStatus: string | null;
  pendingRequests: { id: string; name: string; createdAt: string }[];
  members: Member[];
  coverObjectKey: string | null;
}) {
  const th = locale === 'th';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [successor, setSuccessor] = useState('');
  const [reason, setReason] = useState('SPAM');
  const [details, setDetails] = useState('');
  const [reportTarget, setReportTarget] = useState<{
    target: 'MEETUP' | 'USER' | 'IMAGE';
    targetId: string;
  }>({ target: 'MEETUP', targetId: id });
  async function run(task: () => Promise<{ ok: boolean; formError?: string }>) {
    setPending(true);
    setError('');
    try {
      const result = await task();
      if (!result.ok) setError(meetupActionError(result.formError, locale));
      else window.location.reload();
    } catch {
      setError(th ? 'ทำรายการไม่สำเร็จ' : 'Action failed');
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {!viewerId && (
          <a
            href={`${withLocale(locale, '/login')}?next=${encodeURIComponent(withLocale(locale, `/meetups/${id}`))}`}
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--forest)] px-5 text-sm font-semibold text-white"
          >
            {th ? 'เข้าสู่ระบบเพื่อขอเข้าร่วม' : 'Sign in to request joining'}
          </a>
        )}
        {viewerId && !isAdmin && !isMember && requestStatus !== 'PENDING' && status === 'OPEN' && (
          <Button disabled={pending} onClick={() => void run(() => joinMeetup(id))}>
            {th ? 'ขอเข้าร่วม Meetup' : 'Request to join Meetup'}
          </Button>
        )}
        {viewerId && requestStatus === 'PENDING' && !isMember && (
          <Button
            disabled={pending}
            variant="secondary"
            onClick={() => void run(() => cancelMeetupJoinRequest(id))}
          >
            {th ? 'ยกเลิกคำขอเข้าร่วม' : 'Cancel join request'}
          </Button>
        )}
        {isMember && !isHost && (
          <Button
            disabled={pending}
            variant="secondary"
            onClick={() => {
              if (window.confirm(th ? 'ออกจาก Meetup นี้?' : 'Leave this Meetup?'))
                void run(() => leaveMeetup(id));
            }}
          >
            {th ? 'ออกจาก Meetup' : 'Leave Meetup'}
          </Button>
        )}
        {(isMember || isAdmin) && (
          <a
            href={withLocale(locale, `/meetups/${id}/chat`)}
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-5 text-sm font-semibold"
          >
            {th ? 'เปิดแชตกลุ่ม' : 'Open group chat'}
          </a>
        )}
        {(isHost || isAdmin) && status === 'OPEN' && (
          <Button
            disabled={pending}
            variant="secondary"
            onClick={() => void run(() => setMeetupClosed(id, true))}
          >
            {th ? 'ปิดรับสมาชิก' : 'Close joining'}
          </Button>
        )}
        {(isHost || isAdmin) && status === 'CLOSED' && (
          <Button
            disabled={pending}
            variant="secondary"
            onClick={() => void run(() => setMeetupClosed(id, false))}
          >
            {th ? 'เปิดรับสมาชิก' : 'Reopen joining'}
          </Button>
        )}
        {(isHost || isAdmin) && !['CANCELLED', 'COMPLETED'].includes(status) && (
          <Button
            disabled={pending}
            variant="danger"
            onClick={() => {
              if (window.confirm(th ? 'ยืนยันยกเลิก Meetup นี้?' : 'Cancel this Meetup?'))
                void run(() => cancelMeetup(id));
            }}
          >
            {th ? 'ยกเลิก Meetup' : 'Cancel Meetup'}
          </Button>
        )}
        {isAdmin && (
          <Button
            disabled={pending}
            variant="danger"
            onClick={() => {
              if (window.confirm(th ? 'ซ่อน Meetup นี้จากระบบ?' : 'Remove this Meetup?'))
                void run(() => deleteMeetupAsAdmin(id));
            }}
          >
            {th ? 'ลบแบบซ่อน' : 'Remove Meetup'}
          </Button>
        )}
      </div>
      {requestStatus === 'PENDING' && !isMember && (
        <p role="status" className="rounded-xl border border-[var(--border)] bg-white p-4 text-sm">
          {th
            ? 'คำขอของคุณกำลังรอ Host อนุมัติ จึงยังเข้าแชตไม่ได้'
            : 'Your request is awaiting host approval. Chat is not available yet.'}
        </p>
      )}
      {isHost && pendingRequests.length > 0 && (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <h2 className="text-lg font-semibold">
            {th ? 'คำขอเข้าร่วมที่รออนุมัติ' : 'Pending join requests'}
          </h2>
          <ul className="mt-3 space-y-2">
            {pendingRequests.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
              >
                <span className="text-sm font-semibold">{request.name}</span>
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      void run(() => decideMeetupJoinRequest(id, request.id, 'APPROVED'))
                    }
                  >
                    {th ? 'อนุมัติ' : 'Approve'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      void run(() => decideMeetupJoinRequest(id, request.id, 'DECLINED'))
                    }
                  >
                    {th ? 'ปฏิเสธ' : 'Decline'}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(isHost || isAdmin) && !['CANCELLED', 'COMPLETED', 'ONGOING'].includes(status) && (
        <a
          className="text-sm text-[var(--forest)] underline"
          href={withLocale(locale, `/meetups/${id}/edit`)}
        >
          {th ? 'แก้ไขรายละเอียด Meetup' : 'Edit Meetup'}
        </a>
      )}
      {(isHost || isAdmin) && members.length > 1 && (
        <div className="rounded-xl border p-4">
          <p className="text-sm font-semibold">
            {th ? 'โอนหัวกลุ่ม (ต้องโอนก่อน Host ออก)' : 'Transfer host before leaving'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Select
              className="max-w-xs"
              aria-label={th ? 'สมาชิกที่จะรับช่วง' : 'New host'}
              value={successor}
              onChange={(event) => setSuccessor(event.target.value)}
            >
              <option value="">{th ? 'เลือกสมาชิก' : 'Choose member'}</option>
              {members
                .filter((member) => member.userId !== viewerId)
                .map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user.name}
                  </option>
                ))}
            </Select>
            <Button
              disabled={!successor || pending}
              variant="secondary"
              onClick={() => {
                if (window.confirm(th ? 'ยืนยันการโอนหัวกลุ่ม?' : 'Transfer hosting?'))
                  void run(() => transferMeetupHost(id, successor));
              }}
            >
              {th ? 'โอนสิทธิ์' : 'Transfer'}
            </Button>
          </div>
        </div>
      )}
      {(isHost || isAdmin) && members.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">{th ? 'จัดการสมาชิก' : 'Manage members'}</h2>
          <div className="mt-3 grid gap-2">
            {members
              .filter((member) => member.userId !== viewerId)
              .map((member) => (
                <div
                  key={member.userId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <span>{member.user.name}</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending || member.user.role === 'ADMIN'}
                      onClick={() => {
                        if (window.confirm(th ? 'นำสมาชิกออก?' : 'Remove member?'))
                          void run(() =>
                            moderateMeetupMember(id, member.userId, 'KICK', successor || undefined),
                          );
                      }}
                    >
                      Kick
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={pending || member.user.role === 'ADMIN'}
                      onClick={() => {
                        if (
                          window.confirm(th ? 'แบนสมาชิกจากห้องนี้?' : 'Ban member from this room?')
                        )
                          void run(() =>
                            moderateMeetupMember(id, member.userId, 'BAN', successor || undefined),
                          );
                      }}
                    >
                      Ban
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}
      {isMember && (
        <section className="rounded-xl border p-4">
          <h2 className="text-lg font-semibold">{th ? 'รายชื่อสมาชิก' : 'Members'}</h2>
          <ul className="mt-2 space-y-2">
            {members.map((member) => (
              <li key={member.userId} className="flex items-center justify-between gap-3">
                <span>
                  {member.user.name}
                  {member.userId === viewerId ? (th ? ' (คุณ)' : ' (you)') : ''}
                </span>
                {member.userId !== viewerId && (
                  <span className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void run(() => setUserBlocked(member.userId, true))}
                    >
                      {th ? 'บล็อก' : 'Block'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReportTarget({ target: 'USER', targetId: member.userId })}
                    >
                      {th ? 'รายงาน' : 'Report'}
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {viewerId && (
        <form
          className="space-y-3 rounded-xl border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => reportMeetup(id, { ...reportTarget, reason, details }));
          }}
        >
          <h2 className="text-sm font-semibold">
            {th ? 'รายงาน' : 'Report'} {reportTarget.target}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setReportTarget({ target: 'MEETUP', targetId: id })}
            >
              {th ? 'กิจกรรม' : 'Meetup'}
            </Button>
            {coverObjectKey && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setReportTarget({ target: 'IMAGE', targetId: coverObjectKey })}
              >
                {th ? 'รูปปก' : 'Cover image'}
              </Button>
            )}
          </div>
          <Select
            aria-label={th ? 'เหตุผล' : 'Reason'}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            {[
              'SPAM',
              'HARASSMENT',
              'INAPPROPRIATE_CONTENT',
              'SCAM',
              'FAKE_MEETUP',
              'DANGEROUS_BEHAVIOR',
              'OTHER',
            ].map((value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
          <Textarea
            aria-label={th ? 'รายละเอียดรายงาน' : 'Report details'}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            maxLength={1000}
          />
          <Button type="submit" variant="secondary" disabled={pending}>
            {th ? 'ส่งรายงาน' : 'Send report'}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-[var(--terracotta)]">
          {error}
        </p>
      )}
      <span className="sr-only" aria-live="polite">
        {pending ? (th ? 'กำลังทำรายการ' : 'Working') : ''}
      </span>
    </div>
  );
}
