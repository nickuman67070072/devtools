'use client';

import {
  ChartNoAxesCombined,
  Flag,
  History,
  MessageSquareText,
  FolderCheck,
  MapPinned,
  Shapes,
  UsersRound,
} from 'lucide-react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

export function AdminNav() {
  const pathname = usePathname();
  const links = [
    ['/admin', 'ภาพรวม', ChartNoAxesCombined],
    ['/admin/submissions', 'คิวตรวจข้อมูล', FolderCheck],
    ['/admin/imports', 'ข้อมูลนำเข้า', FolderCheck],
    ['/admin/places', 'สถานที่', MapPinned],
    ['/admin/provinces', 'จังหวัด', MapPinned],
    ['/admin/categories', 'หมวดหมู่', Shapes],
    ['/admin/reports', 'รายงาน', Flag],
    ['/admin/meetups', 'Meetup', UsersRound],
    ['/admin/meetup-reports', 'รายงาน Meetup', Flag],
    ['/admin/reviews', 'รีวิว', MessageSquareText],
    ['/admin/users', 'ผู้ใช้', UsersRound],
    ['/admin/audit-logs', 'AuditLog', History],
  ] as const;
  return (
    <nav
      aria-label="Admin navigation"
      className="mb-6 flex gap-1 overflow-x-auto border-b border-[var(--border)] pb-2"
    >
      {links.map(([href, label, Icon]) => (
        <a
          key={href}
          href={href}
          aria-current={pathname === href ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-semibold transition',
            pathname === href
              ? 'bg-[var(--forest)] text-white'
              : 'text-[var(--text-muted)] hover:bg-[var(--forest-soft)] hover:text-[var(--forest)]',
          )}
        >
          <Icon className="size-4" />
          {label}
        </a>
      ))}
    </nav>
  );
}
