'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { resolveMeetupReport } from './actions';

export function AdminMeetupReportAction({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function run(dismissed: boolean) {
    setPending(true);
    const result = await resolveMeetupReport(id, dismissed);
    setPending(false);
    if (!result.ok) setError(result.formError ?? 'ไม่สำเร็จ');
    else window.location.reload();
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={pending} onClick={() => void run(false)}>
        จัดการแล้ว
      </Button>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => void run(true)}>
        ยกเลิกรายงาน
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
