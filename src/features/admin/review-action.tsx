'use client';

import { Eye, EyeOff, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { setReviewHidden } from '@/features/admin/actions';

export function ReviewAction({ id, hidden }: { id: string; hidden: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    const result = await setReviewHidden(id, !hidden, reason);
    setPending(false);
    if (!result.ok) return toast.error(result.formError);
    toast.success(hidden ? 'กู้คืนรีวิวแล้ว' : 'ซ่อนรีวิวและบันทึก AuditLog แล้ว');
    dialogRef.current?.close();
    router.refresh();
  }

  return (
    <>
      <Button
        size="sm"
        variant={hidden ? 'secondary' : 'danger'}
        onClick={() => dialogRef.current?.showModal()}
      >
        {hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        {hidden ? 'กู้คืน' : 'ซ่อน'}
      </Button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(480px,calc(100%-32px))] rounded-[26px] border-0 p-0 shadow-2xl backdrop:bg-[#181c1a]/50"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-black">{hidden ? 'กู้คืนรีวิว' : 'ซ่อนรีวิว'}</h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="ปิด dialog"
            >
              <X className="size-5" />
            </button>
          </div>
          {!hidden && (
            <label className="mt-5 grid gap-1.5 text-sm font-bold">
              เหตุผล *
              <Textarea
                rows={4}
                minLength={5}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => dialogRef.current?.close()}>
              ยกเลิก
            </Button>
            <Button
              variant={hidden ? 'primary' : 'danger'}
              disabled={pending || (!hidden && reason.trim().length < 5)}
              onClick={() => void submit()}
            >
              ยืนยัน
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
