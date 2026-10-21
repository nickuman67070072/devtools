'use client';

import { CheckCircle2, GitCompareArrows, MessageSquareWarning, XCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { useBrandLoading } from '@/components/brand-loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { moderateSubmission } from '@/features/admin/actions';

export function ModerationCard({
  submission,
}: {
  submission: {
    id: string;
    revision: number;
    kind: string;
    name: string;
    submitter: string;
    province: string;
    category: string;
    submittedAt: string;
    proposed: Record<string, unknown>;
    original?: Record<string, unknown> | null;
    imageKeys: string[];
  };
}) {
  const brandLoading = useBrandLoading();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'>('APPROVE');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const fields = ['nameTh', 'descriptionTh', 'addressTh', 'latitude', 'longitude'] as const;
  async function submit() {
    setPending(true);
    const loadingToken = brandLoading.begin('กำลังบันทึกผลการตรวจสอบ…', 'th');
    const result = await moderateSubmission({
      id: submission.id,
      revision: submission.revision,
      decision,
      reason,
    }).finally(() => {
      brandLoading.end(loadingToken);
      setPending(false);
    });
    if (!result.ok) toast.error(result.formError);
    else {
      toast.success('บันทึกผลการพิจารณาแล้ว');
      dialogRef.current?.close();
      window.location.reload();
    }
  }
  return (
    <article className="surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black">
              <a href={`/admin/submissions/${submission.id}`} className="hover:underline">
                {submission.name}
              </a>
            </h2>
            <Badge>{submission.kind}</Badge>
            <Badge tone="neutral">revision {submission.revision}</Badge>
          </div>
          <p className="mt-1 text-sm text-[#5e6561]">
            {submission.province} · {submission.category} · โดย {submission.submitter}
          </p>
          <p className="mt-1 text-xs text-[#819096]">ส่งเมื่อ {submission.submittedAt}</p>
        </div>
        <Button onClick={() => dialogRef.current?.showModal()}>
          <GitCompareArrows className="size-4" />
          ตรวจและตัดสินใจ
        </Button>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field} className="rounded-xl bg-[#f4f7f4] p-3">
            <p className="text-[11px] font-extrabold tracking-wide text-[#5e6561] uppercase">
              {field}
            </p>
            <p className="mt-1 line-clamp-3 text-sm">{String(submission.proposed[field] ?? '—')}</p>
            {submission.original && submission.original[field] !== submission.proposed[field] && (
              <p className="mt-2 border-t border-[#e7e5df] pt-2 text-xs text-[#9a5960] line-through">
                เดิม: {String(submission.original[field] ?? '—')}
              </p>
            )}
          </div>
        ))}
      </div>
      {submission.imageKeys.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {submission.imageKeys.map((key, index) => (
            <img
              key={key}
              src={`/api/media/${encodeURIComponent(key)}`}
              alt={`หลักฐาน ${index + 1}`}
              className="size-24 rounded-xl object-cover"
            />
          ))}
        </div>
      )}
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(560px,calc(100%-32px))] rounded-[28px] border-0 bg-white p-0 shadow-2xl backdrop:bg-[#181c1a]/50"
      >
        <div className="p-6">
          <h3 className="text-2xl font-black">ตัดสินใจรายการ</h3>
          <p className="mt-1 text-sm text-[#5e6561]">
            ระบบจะตรวจ revision อีกครั้งใน transaction ก่อนบันทึก
          </p>
          <fieldset className="mt-6 grid gap-2">
            <legend className="sr-only">ผลการพิจารณา</legend>
            {(
              [
                ['APPROVE', 'อนุมัติ', CheckCircle2],
                ['REQUEST_CHANGES', 'ขอแก้ไข', MessageSquareWarning],
                ['REJECT', 'ไม่อนุมัติ', XCircle],
              ] as const
            ).map(([value, label, Icon]) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#e7e5df] p-3 has-checked:border-[#2d5a43] has-checked:bg-[#e7efe9]"
              >
                <input
                  type="radio"
                  name={`decision-${submission.id}`}
                  checked={decision === value}
                  onChange={() => setDecision(value)}
                />
                <Icon className="size-5" /> <span className="font-bold">{label}</span>
              </label>
            ))}
          </fieldset>
          <label className="mt-5 grid gap-1.5 text-sm font-bold">
            เหตุผล / ข้อความถึงผู้ส่ง {decision !== 'APPROVE' && '*'}
            <Textarea
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={1000}
            />
          </label>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => dialogRef.current?.close()}>
              ยกเลิก
            </Button>
            <Button
              variant={decision === 'REJECT' ? 'danger' : 'primary'}
              onClick={() => void submit()}
              disabled={pending}
            >
              {pending ? 'กำลังบันทึก…' : 'ยืนยันผล'}
            </Button>
          </div>
        </div>
      </dialog>
    </article>
  );
}
