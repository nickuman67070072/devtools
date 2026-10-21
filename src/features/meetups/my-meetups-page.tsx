import { requireUser } from '@/lib/auth-guards';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { effectiveMeetupStatus } from './service';
import { JoinRequestActions } from './join-request-actions';

type Tab = 'hosting' | 'requests' | 'pending' | 'joined' | 'history';
const validTabs: Tab[] = ['hosting', 'requests', 'pending', 'joined', 'history'];

export async function MyMeetupsPage({ locale, tab }: { locale: Locale; tab?: string }) {
  const session = await requireUser(locale);
  const th = locale === 'th';
  const selected: Tab = validTabs.includes(tab as Tab) ? (tab as Tab) : 'hosting';
  const now = new Date();
  const [meetups, hostRequests, myRequests] = await Promise.all([
    prisma.meetup.findMany({
      where: {
        deletedAt: null,
        OR: [{ hostId: session.user.id }, { members: { some: { userId: session.user.id } } }],
      },
      include: {
        place: true,
        members: { where: { userId: session.user.id }, select: { state: true } },
        _count: { select: { members: { where: { state: 'ACTIVE' } } } },
      },
      orderBy: { startsAt: 'asc' },
    }),
    prisma.meetupJoinRequest.findMany({
      where: {
        status: 'PENDING',
        meetup: {
          hostId: session.user.id,
          deletedAt: null,
          startsAt: { gt: now },
          status: { in: ['OPEN', 'CLOSED'] },
        },
      },
      include: { user: { select: { name: true } }, meetup: { include: { place: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.meetupJoinRequest.findMany({
      where: {
        userId: session.user.id,
        status: 'PENDING',
        meetup: { deletedAt: null, startsAt: { gt: now }, status: { in: ['OPEN', 'CLOSED'] } },
      },
      include: { meetup: { include: { place: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const history = meetups.filter(
    (meetup) =>
      meetup.endsAt <= now ||
      meetup.status === 'CANCELLED' ||
      (meetup.hostId !== session.user.id && meetup.members[0]?.state !== 'ACTIVE'),
  );
  const hosting = meetups.filter(
    (meetup) => meetup.hostId === session.user.id && !history.includes(meetup),
  );
  const joined = meetups.filter(
    (meetup) =>
      meetup.hostId !== session.user.id &&
      meetup.members[0]?.state === 'ACTIVE' &&
      !history.includes(meetup),
  );
  const tabs: { id: Tab; th: string; en: string; count: number }[] = [
    { id: 'hosting', th: 'ที่ฉันจัด', en: 'Hosting', count: hosting.length },
    { id: 'requests', th: 'รอฉันอนุมัติ', en: 'To review', count: hostRequests.length },
    { id: 'pending', th: 'รออนุมัติ', en: 'Awaiting approval', count: myRequests.length },
    { id: 'joined', th: 'เข้าร่วมแล้ว', en: 'Joined', count: joined.length },
    { id: 'history', th: 'ประวัติ', en: 'History', count: history.length },
  ];
  const visible = selected === 'hosting' ? hosting : selected === 'joined' ? joined : history;
  const format = new Intl.DateTimeFormat(th ? 'th-TH' : 'en-GB', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <main className="container-shell py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">PawMap Social</p>
          <h1 className="mt-2 text-3xl font-semibold">{th ? 'Meetup ของฉัน' : 'My Meetups'}</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {th
              ? 'ติดตามกิจกรรมและคำขอเข้าร่วมในที่เดียว'
              : 'Your activities and join requests in one place.'}
          </p>
        </div>
        <a
          href={withLocale(locale, '/meetups/new')}
          className="inline-flex min-h-11 items-center rounded-md bg-[var(--forest)] px-4 text-sm font-semibold text-white"
        >
          {th ? 'สร้าง Meetup' : 'Create Meetup'}
        </a>
      </div>
      <nav
        className="mt-7 flex gap-2 overflow-x-auto border-b border-[var(--border)] pb-3"
        aria-label={th ? 'หมวด Meetup ของฉัน' : 'My Meetup sections'}
      >
        {tabs.map((item) => (
          <a
            key={item.id}
            href={
              item.id === 'hosting'
                ? withLocale(locale, '/my-meetups')
                : `${withLocale(locale, '/my-meetups')}?tab=${item.id}`
            }
            aria-current={selected === item.id ? 'page' : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${selected === item.id ? 'bg-[var(--forest)] text-white' : 'bg-white text-[var(--forest)] hover:bg-[var(--surface-soft)]'}`}
          >
            {th ? item.th : item.en} <span className="ml-1 opacity-75">{item.count}</span>
          </a>
        ))}
      </nav>
      <section className="mt-5 space-y-3" aria-live="polite">
        {selected === 'requests' &&
          hostRequests.map((request) => (
            <article
              key={request.id}
              className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--forest)]">
                  {th ? 'คำขอใหม่' : 'Join request'}
                </p>
                <h2 className="mt-1 font-semibold">
                  {request.user.name} → {request.meetup.title}
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {th
                    ? request.meetup.place.nameTh
                    : request.meetup.place.nameEn || request.meetup.place.nameTh}{' '}
                  · {format.format(request.meetup.startsAt)}
                </p>
              </div>
              <JoinRequestActions
                meetupId={request.meetupId}
                requestId={request.id}
                locale={locale}
              />
            </article>
          ))}
        {selected === 'pending' &&
          myRequests.map((request) => (
            <a
              key={request.id}
              href={withLocale(locale, `/meetups/${request.meetupId}`)}
              className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-white p-4 hover:border-[var(--forest)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-xs font-semibold text-[var(--terracotta)]">
                  {th ? 'รอ Host อนุมัติ' : 'Awaiting host approval'}
                </p>
                <h2 className="mt-1 font-semibold">{request.meetup.title}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {th
                    ? request.meetup.place.nameTh
                    : request.meetup.place.nameEn || request.meetup.place.nameTh}
                </p>
              </div>
              <span className="text-sm">{format.format(request.meetup.startsAt)}</span>
            </a>
          ))}
        {!['requests', 'pending'].includes(selected) &&
          visible.map((meetup) => (
            <a
              key={meetup.id}
              href={withLocale(locale, `/meetups/${meetup.id}`)}
              className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-white p-4 hover:border-[var(--forest)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--forest)]">
                  {effectiveMeetupStatus(
                    meetup.status,
                    meetup.startsAt,
                    meetup.endsAt,
                    meetup._count.members,
                    meetup.maxMembers,
                  )}
                </p>
                <h2 className="mt-1 text-lg font-semibold">{meetup.title}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {th ? meetup.place.nameTh : meetup.place.nameEn || meetup.place.nameTh}
                </p>
              </div>
              <div className="shrink-0 text-sm">
                <p>{format.format(meetup.startsAt)}</p>
                <p className="mt-1 text-[var(--text-muted)]">
                  {meetup._count.members}/{meetup.maxMembers} {th ? 'คน' : 'members'}
                </p>
              </div>
            </a>
          ))}
        {((selected === 'requests' && !hostRequests.length) ||
          (selected === 'pending' && !myRequests.length) ||
          (!['requests', 'pending'].includes(selected) && !visible.length)) && (
          <p className="rounded-2xl border border-dashed border-[var(--border)] bg-white p-8 text-sm text-[var(--text-muted)]">
            {th ? 'ยังไม่มีรายการในหมวดนี้' : 'Nothing in this section yet.'}
          </p>
        )}
      </section>
    </main>
  );
}
