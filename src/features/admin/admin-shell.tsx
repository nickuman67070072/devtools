import type { ReactNode } from 'react';

import { AdminNav } from '@/components/admin-nav';
import { PageShell } from '@/components/page-shell';
import { Badge } from '@/components/ui/badge';
import { requireAdmin } from '@/lib/auth-guards';

export async function AdminShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const session = await requireAdmin();
  return (
    <PageShell locale="th">
      <div className="min-h-[calc(100vh-80px)] bg-[var(--surface-soft)] py-8 sm:py-10">
        <div className="container-shell">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-6">
            <div>
              <div className="flex items-center gap-2">
                <p className="eyebrow">PawMap</p>
                <Badge tone="neutral">ผู้ดูแลระบบ</Badge>
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--forest)] sm:text-4xl">
                {title}
              </h1>
              <p className="mt-2 text-[var(--text-muted)]">{description}</p>
            </div>
            <p className="text-sm font-bold text-[#5e6561]">{session.user.name}</p>
          </div>
          <AdminNav />
          <div className="admin-workspace">{children}</div>
        </div>
      </div>
    </PageShell>
  );
}
