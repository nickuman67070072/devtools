'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { resolveReport } from '@/features/admin/actions';

export function ReportAction({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function run(dismissed: boolean) {
    const reason = prompt(dismissed ? 'เหตุผลที่ยกเลิก' : 'ผลการพิจารณา') ?? '';
    if (reason.length < 5) return;
    setPending(true);
    const result = await resolveReport(id, reason, dismissed);
    setPending(false);
    if (result.ok) {
      toast.success('ปิดรายงานแล้ว');
      router.refresh();
    } else toast.error(result.formError);
  }
  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => void run(false)} disabled={pending}>
        แก้ไขแล้ว
      </Button>
      <Button size="sm" variant="ghost" onClick={() => void run(true)} disabled={pending}>
        ยกเลิก
      </Button>
    </div>
  );
}
