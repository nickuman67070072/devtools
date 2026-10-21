'use client';

import { ShieldOff, ShieldPlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { setUserSuspended } from '@/features/admin/actions';

export function UserAction({ id, suspended }: { id: string; suspended: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState('');
  async function submit() {
    const actionReason = suspended ? 'กู้คืนโดยผู้ดูแล' : reason.trim();
    if (!suspended && actionReason.length < 5) return;
    setPending(true);
    const result = await setUserSuspended(id, !suspended, actionReason);
    setPending(false);
    if (result.ok) {
      toast.success(suspended ? 'กู้คืนบัญชีแล้ว' : 'ระงับบัญชีและยกเลิก session แล้ว');
      dialogRef.current?.close();
      router.refresh();
    } else toast.error(result.formError);
  }
  return (
    <>
      <Button
        size="sm"
        variant={suspended ? 'secondary' : 'danger'}
        disabled={pending}
        onClick={() => dialogRef.current?.showModal()}
      >
        {suspended ? <ShieldPlus className="size-4" /> : <ShieldOff className="size-4" />}
        {suspended ? 'กู้คืน' : 'ระงับ'}
      </Button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(480px,calc(100%-32px))] rounded-[26px] border-0 p-0 shadow-2xl backdrop:bg-[#181c1a]/50"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-black">{suspended ? 'กู้คืนบัญชี' : 'ระงับบัญชี'}</h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="ปิด dialog"
            >
              <X className="size-5" />
            </button>
          </div>
          {!suspended && (
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
              variant={suspended ? 'primary' : 'danger'}
              disabled={pending || (!suspended && reason.trim().length < 5)}
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
