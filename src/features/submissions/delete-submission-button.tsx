'use client';

import { Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { deleteSubmission } from '@/features/submissions/actions';

export function DeleteSubmissionButton({ id, locale }: { id: string; locale: 'th' | 'en' }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  async function remove() {
    setPending(true);
    const result = await deleteSubmission(id);
    setPending(false);
    if (!result.ok) toast.error(result.formError);
    else {
      toast.success(locale === 'th' ? 'ลบรายการแล้ว' : 'Submission removed');
      dialogRef.current?.close();
      router.refresh();
    }
  }
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => dialogRef.current?.showModal()}
      >
        <Trash2 className="size-4" />
        {locale === 'th' ? 'ลบ' : 'Delete'}
      </Button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(440px,calc(100%-32px))] rounded-[26px] border-0 p-0 shadow-2xl backdrop:bg-[#181c1a]/50"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-black">
              {locale === 'th' ? 'ลบรายการนี้หรือไม่?' : 'Delete this submission?'}
            </h2>
            <button type="button" aria-label="Close" onClick={() => dialogRef.current?.close()}>
              <X className="size-5" />
            </button>
          </div>
          <p className="mt-3 text-sm text-[#5e6561]">
            {locale === 'th'
              ? 'รายการจะถูก soft delete และถอนออกจากคิวผู้ดูแลทันที'
              : 'The submission will be soft-deleted and removed from the moderation queue.'}
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => dialogRef.current?.close()}>
              {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
            </Button>
            <Button variant="danger" disabled={pending} onClick={() => void remove()}>
              {locale === 'th' ? 'ยืนยันการลบ' : 'Delete'}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
