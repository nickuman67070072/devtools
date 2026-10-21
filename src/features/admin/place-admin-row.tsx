'use client';

import { ArchiveRestore, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { setPlaceDeleted } from '@/features/admin/actions';

export function PlaceAdminAction({ id, deleted }: { id: string; deleted: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  async function submit() {
    setPending(true);
    const result = await setPlaceDeleted(id, !deleted);
    setPending(false);
    if (!result.ok) toast.error(result.formError);
    else {
      toast.success(deleted ? 'กู้คืนแล้ว' : 'ลบแบบ soft delete แล้ว');
      dialogRef.current?.close();
      router.refresh();
    }
  }
  return (
    <>
      <Button
        size="sm"
        variant={deleted ? 'secondary' : 'danger'}
        disabled={pending}
        onClick={() => dialogRef.current?.showModal()}
      >
        {deleted ? <ArchiveRestore className="size-4" /> : <Trash2 className="size-4" />}
        {deleted ? 'กู้คืน' : 'ลบ'}
      </Button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(440px,calc(100%-32px))] rounded-[26px] border-0 p-0 shadow-2xl backdrop:bg-[#181c1a]/50"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-black">
              {deleted ? 'กู้คืนสถานที่นี้หรือไม่?' : 'Soft-delete สถานที่นี้หรือไม่?'}
            </h2>
            <button
              type="button"
              aria-label="ปิด dialog"
              onClick={() => dialogRef.current?.close()}
            >
              <X className="size-5" />
            </button>
          </div>
          <p className="mt-3 text-sm text-[#5e6561]">
            การเปลี่ยนแปลงจะเพิ่ม version และบันทึกลง AuditLog
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => dialogRef.current?.close()}>
              ยกเลิก
            </Button>
            <Button
              variant={deleted ? 'primary' : 'danger'}
              disabled={pending}
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
