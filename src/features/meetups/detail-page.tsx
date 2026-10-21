import { notFound } from 'next/navigation';
import Image from 'next/image';

import { getCurrentSession } from '@/lib/auth-guards';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { effectiveMeetupStatus } from './service';
import { MeetupDetailControls } from './detail-controls';

export async function MeetupDetailPage({ id, locale }: { id: string; locale: Locale }) {
  const th = locale === 'th';
  const meetup = await prisma.meetup.findFirst({
    where: { id, deletedAt: null },
    include: {
      place: { include: { province: true, category: true } },
      host: { select: { id: true, name: true } },
      _count: { select: { members: { where: { state: 'ACTIVE' } } } },
    },
  });
  if (!meetup) notFound();
  const session = await getCurrentSession();
  const viewer =
    session && !session.user.suspendedAt
      ? await prisma.user.findFirst({
          where: { id: session.user.id, suspendedAt: null, deletedAt: null },
          select: { id: true, role: true },
        })
      : null;
  const isAdmin = viewer?.role === 'ADMIN';
  const isMember = Boolean(
    viewer &&
      (await prisma.meetupMember.findFirst({
        where: { meetupId: id, userId: viewer.id, state: 'ACTIVE' },
      })),
  );
  const joinRequest = viewer
    ? await prisma.meetupJoinRequest.findUnique({
        where: { meetupId_userId: { meetupId: id, userId: viewer.id } },
        select: { status: true },
      })
    : null;
  const pendingRequests =
    viewer?.id === meetup.hostId
      ? await prisma.meetupJoinRequest.findMany({
          where: { meetupId: id, status: 'PENDING' },
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: 'asc' },
        })
      : [];
  const members =
    isMember || isAdmin
      ? await prisma.meetupMember.findMany({
          where: { meetupId: id, state: 'ACTIVE' },
          include: { user: { select: { id: true, name: true, role: true } } },
          orderBy: { joinedAt: 'asc' },
        })
      : [];
  const status = effectiveMeetupStatus(
    meetup.status,
    meetup.startsAt,
    meetup.endsAt,
    meetup._count.members,
    meetup.maxMembers,
  );
  const format = new Intl.DateTimeFormat(th ? 'th-TH' : 'en-GB', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'full',
    timeStyle: 'short',
  });
  return (
    <main className="container-shell max-w-4xl py-10">
      <a href={withLocale(locale, '/meetups')} className="text-sm text-[var(--forest)] underline">
        ← {th ? 'Meetup ทั้งหมด' : 'All meetups'}
      </a>
      <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        {meetup.coverObjectKey && (
          <Image
            unoptimized
            width={1200}
            height={400}
            src={`/api/meetups/media/${meetup.coverObjectKey}`}
            alt=""
            className="max-h-72 w-full object-cover"
          />
        )}
        <div className="p-6">
          <p className="eyebrow">PawMap Social · {status}</p>
          <h1 className="mt-2 text-3xl font-semibold">{meetup.title}</h1>
          <p className="mt-3 whitespace-pre-wrap text-[var(--text-muted)]">{meetup.description}</p>
          <dl className="mt-6 grid gap-4 border-t border-[var(--border)] pt-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Host</dt>
              <dd className="font-semibold">{meetup.host.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">{th ? 'สมาชิก' : 'Members'}</dt>
              <dd className="font-semibold">
                {meetup._count.members} / {meetup.maxMembers}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">{th ? 'เริ่ม' : 'Starts'}</dt>
              <dd>{format.format(meetup.startsAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">{th ? 'สิ้นสุด' : 'Ends'}</dt>
              <dd>{format.format(meetup.endsAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-[var(--text-muted)]">{th ? 'สถานที่' : 'Place'}</dt>
              <dd>
                <a
                  className="font-semibold text-[var(--forest)] underline"
                  href={withLocale(locale, `/places/${meetup.place.slug}`)}
                >
                  {th ? meetup.place.nameTh : meetup.place.nameEn || meetup.place.nameTh}
                </a>
                <span className="block text-sm text-[var(--text-muted)]">
                  {meetup.place.addressTh} ·{' '}
                  {th ? meetup.place.province.nameTh : meetup.place.province.nameEn}
                </span>
              </dd>
            </div>
          </dl>
          {meetup.rules && (
            <section className="mt-6 rounded-xl bg-[var(--surface-soft)] p-4">
              <h2 className="font-semibold">{th ? 'กฎของ Meetup' : 'Meetup rules'}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm">{meetup.rules}</p>
            </section>
          )}
          <p className="mt-5 text-xs text-[var(--text-muted)]">
            {th
              ? 'PawMap ไม่แสดงตำแหน่งจริงของสมาชิก โปรดพบกันในที่สาธารณะและใช้ความระมัดระวัง'
              : 'PawMap does not reveal members’ live locations. Meet in a public place and stay safe.'}
          </p>
        </div>
      </div>
      <div className="mt-6">
        <MeetupDetailControls
          locale={locale}
          id={id}
          status={status}
          viewerId={viewer?.id ?? null}
          isHost={viewer?.id === meetup.hostId}
          isAdmin={isAdmin}
          isMember={isMember}
          requestStatus={meetup.startsAt <= new Date() ? null : (joinRequest?.status ?? null)}
          pendingRequests={pendingRequests.map((request) => ({
            id: request.id,
            name: request.user.name,
            createdAt: request.createdAt.toISOString(),
          }))}
          members={members.map((member) => ({
            userId: member.userId,
            user: { name: member.user.name, role: member.user.role },
          }))}
          coverObjectKey={meetup.coverObjectKey}
        />
      </div>
    </main>
  );
}
