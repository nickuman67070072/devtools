import 'server-only';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth-guards';
import { prisma } from '@/lib/prisma';

export async function requireImportAdmin() {
  const session = await requireAdmin();
  const active = await prisma.user.findFirst({
    where: { id: session.user.id, role: 'ADMIN', deletedAt: null, suspendedAt: null },
    select: { id: true },
  });
  if (!active) redirect('/unauthorized');
  return session;
}
