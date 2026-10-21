import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser(locale: 'th' | 'en' = 'th') {
  const session = await getCurrentSession();
  const prefix = locale === 'en' ? '/en' : '';
  if (!session) redirect(`${prefix}/login`);
  if (session.user.suspendedAt) redirect(`${prefix}/unauthorized?reason=suspended`);
  return session;
}

export async function requireAdmin(locale: 'th' | 'en' = 'th') {
  const session = await requireUser(locale);
  if (session.user.role !== 'ADMIN') {
    redirect(`${locale === 'en' ? '/en' : ''}/unauthorized?reason=role`);
  }
  return session;
}
