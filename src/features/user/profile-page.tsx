import { CalendarDays, Mail, ShieldCheck, UserRound } from 'lucide-react';

import { PageShell } from '@/components/page-shell';
import { Badge } from '@/components/ui/badge';
import { ProfileForm } from '@/features/user/profile-form';
import { SignOutButton } from '@/features/user/sign-out-button';
import { requireUser } from '@/lib/auth-guards';
import type { Locale } from '@/lib/i18n';

export async function ProfilePage({ locale }: { locale: Locale }) {
  const session = await requireUser(locale);
  const isThai = locale === 'th';
  return (
    <PageShell locale={locale}>
      <main className="container-shell py-12">
        <div className="mx-auto max-w-3xl">
          <p className="eyebrow">{isThai ? 'บัญชีของฉัน' : 'My account'}</p>
          <h1 className="mt-2 text-4xl font-black">{isThai ? 'โปรไฟล์' : 'Profile'}</h1>
          <section className="mt-8 surface p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <span className="grid size-16 place-items-center rounded-md bg-[var(--forest-soft)] text-[var(--forest)]">
                  <UserRound className="size-8" />
                </span>
                <div>
                  <h2 className="text-2xl font-black">{session.user.name}</h2>
                  <div className="mt-2 flex gap-2">
                    <Badge tone="emerald">{session.user.role}</Badge>
                    {session.user.emailVerified && (
                      <Badge tone="blue">
                        <ShieldCheck className="mr-1 size-3" />
                        Verified email
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <SignOutButton locale={locale} />
            </div>
            <dl className="mt-8 grid gap-4 border-t border-[#e7e5df] pt-6 sm:grid-cols-2">
              <div className="rounded-md border border-[var(--border)] p-4">
                <dt className="flex items-center gap-2 text-xs font-bold text-[#5e6561]">
                  <Mail className="size-4" />
                  {isThai ? 'อีเมล' : 'Email'}
                </dt>
                <dd className="mt-2 font-bold">{session.user.email}</dd>
              </div>
              <div className="rounded-md border border-[var(--border)] p-4">
                <dt className="flex items-center gap-2 text-xs font-bold text-[#5e6561]">
                  <CalendarDays className="size-4" />
                  {isThai ? 'สร้างบัญชี' : 'Member since'}
                </dt>
                <dd className="mt-2 font-bold">
                  {new Date(session.user.createdAt).toLocaleDateString(isThai ? 'th-TH' : 'en-GB')}
                </dd>
              </div>
            </dl>
            <ProfileForm
              name={session.user.name}
              email={session.user.email}
              locale={session.user.locale === 'en' ? 'en' : 'th'}
            />
          </section>
        </div>
      </main>
    </PageShell>
  );
}
