import { AdminShell } from '@/features/admin/admin-shell';
import { ReviewAction } from '@/features/admin/review-action';
import { prisma } from '@/lib/prisma';

export default async function AdminReviewsPage() {
  const reviews = await prisma.review.findMany({
    where: { deletedAt: null },
    include: { user: true, place: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return (
    <AdminShell
      title="จัดการรีวิว"
      description="ซ่อนหรือกู้คืนรีวิวพร้อมเหตุผลและ AuditLog ทุกครั้ง"
    >
      <div className="grid gap-4">
        {reviews.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-white/50 p-10 text-center">
            ยังไม่มีรีวิว
          </p>
        ) : (
          reviews.map((review) => (
            <article
              key={review.id}
              className="surface flex flex-col justify-between gap-4 p-5 lg:flex-row lg:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-black">{review.place.nameTh}</h2>
                  <span className="text-sm font-bold text-[#b16a24]">{review.rating}/5</span>
                  {review.isHidden && (
                    <span className="rounded-full bg-[#fff0ee] px-2 py-1 text-xs font-bold text-[#c23934]">
                      HIDDEN
                    </span>
                  )}
                </div>
                <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm">{review.content}</p>
                <p className="mt-1 text-xs text-[#5e6561]">
                  โดย {review.user.name} · {review.createdAt.toLocaleString('th-TH')}
                </p>
                {review.hiddenReason && (
                  <p className="mt-2 text-xs font-semibold text-[#9b3e46]">
                    เหตุผล: {review.hiddenReason}
                  </p>
                )}
              </div>
              <ReviewAction id={review.id} hidden={review.isHidden} />
            </article>
          ))
        )}
      </div>
    </AdminShell>
  );
}
