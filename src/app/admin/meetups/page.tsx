import { prisma } from '@/lib/prisma';

export default async function AdminMeetupsPage() {
  const meetups = await prisma.meetup.findMany({
    include: {
      host: { select: { name: true } },
      place: { select: { nameTh: true } },
      _count: { select: { members: { where: { state: 'ACTIVE' } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return (
    <section>
      <h1 className="text-2xl font-semibold">จัดการ Meetup</h1>
      <div className="mt-5 grid gap-3">
        {meetups.length ? (
          meetups.map((meetup) => (
            <a
              key={meetup.id}
              href={`/meetups/${meetup.id}`}
              className="rounded-xl border border-[var(--border)] bg-white p-4 hover:border-[var(--forest)]"
            >
              <strong>{meetup.title}</strong>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {meetup.place.nameTh} · Host: {meetup.host.name} · {meetup._count.members}/
                {meetup.maxMembers} · {meetup.status}
                {meetup.deletedAt ? ' · ซ่อนแล้ว' : ''}
              </p>
            </a>
          ))
        ) : (
          <p className="text-sm text-[var(--text-muted)]">ยังไม่มี Meetup</p>
        )}
      </div>
    </section>
  );
}
