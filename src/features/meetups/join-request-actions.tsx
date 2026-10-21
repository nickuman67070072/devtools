'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/i18n';
import { meetupActionError } from './action-errors';
import { decideMeetupJoinRequest } from './actions';

export function JoinRequestActions({
  meetupId,
  requestId,
  locale,
}: {
  meetupId: string;
  requestId: string;
  locale: Locale;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function decide(decision: 'APPROVED' | 'DECLINED') {
    setBusy(true);
    setError('');
    try {
      const result = await decideMeetupJoinRequest(meetupId, requestId, decision);
      if (!result.ok) setError(meetupActionError(result.formError, locale));
      else router.refresh();
    } catch {
      setError(locale === 'th' ? 'ทำรายการไม่สำเร็จ' : 'Action failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" disabled={busy} onClick={() => void decide('APPROVED')}>
        {locale === 'th' ? 'อนุมัติ' : 'Approve'}
      </Button>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void decide('DECLINED')}>
        {locale === 'th' ? 'ปฏิเสธ' : 'Decline'}
      </Button>
      {error && (
        <span role="alert" className="w-full text-xs text-[var(--terracotta)]">
          {error}
        </span>
      )}
    </div>
  );
}
