import { AdminMeetupReportAction } from '@/features/meetups/admin-report-action';
import { prisma } from '@/lib/prisma';

export default async function AdminMeetupReportsPage() {
  const reports = await prisma.meetupReport.findMany({
    where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
    include: {
      meetup: { select: { id: true, title: true } },
      reporter: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return (
    <section>
      <h1 className="text-2xl font-semibold">รายงาน Meetup</h1>
      <div className="mt-5 grid gap-3">
        {reports.length ? (
          reports.map((report) => (
            <article
              key={report.id}
              className="rounded-xl border border-[var(--border)] bg-white p-4"
            >
              <a
                href={`/meetups/${report.meetup.id}`}
                className="font-semibold text-[var(--forest)] underline"
              >
                {report.meetup.title}
              </a>
              <p className="mt-1 text-sm">
                {report.target} · {report.reason} · {report.reporter.name}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{report.details}</p>
              <div className="mt-3">
                <AdminMeetupReportAction id={report.id} />
              </div>
            </article>
          ))
        ) : (
          <p className="text-sm text-[var(--text-muted)]">ไม่มีรายงานที่รอตรวจ</p>
        )}
      </div>
    </section>
  );
}
