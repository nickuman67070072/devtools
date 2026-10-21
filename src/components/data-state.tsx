import { AlertCircle, Inbox, RotateCcw } from 'lucide-react';

import { BrandLoading } from '@/components/brand-loading';

export function LoadingState({ label = 'กำลังโหลดข้อมูล' }: { label?: string }) {
  return (
    <div className="relative min-h-64 overflow-hidden rounded-3xl border border-[var(--border)]">
      <BrandLoading label={label} />
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid min-h-48 place-items-center rounded-3xl border border-dashed border-[var(--border)] bg-white/70 p-6 text-center">
      <div className="max-w-sm space-y-2">
        <Inbox className="mx-auto size-8 text-[var(--forest-bright)]" aria-hidden="true" />
        <h2 className="font-extrabold">{title}</h2>
        <p className="text-sm leading-6 text-[var(--text-muted)]">{detail}</p>
      </div>
    </div>
  );
}

export function ErrorState({ title, retry }: { title: string; retry?: () => void }) {
  return (
    <div className="grid min-h-48 place-items-center rounded-3xl border border-[#ecc4be] bg-[var(--terracotta-soft)] p-6 text-center">
      <div className="space-y-3">
        <AlertCircle className="mx-auto size-8 text-[var(--terracotta)]" aria-hidden="true" />
        <p className="font-bold">{title}</p>
        {retry && (
          <button
            className="mx-auto inline-flex items-center gap-2 text-sm font-bold text-[var(--terracotta)]"
            onClick={retry}
          >
            <RotateCcw className="size-4" aria-hidden="true" /> ลองอีกครั้ง
          </button>
        )}
      </div>
    </div>
  );
}
