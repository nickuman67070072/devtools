import { Star } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { requireUser } from '@/lib/auth-guards';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';

export async function ReviewsPage({ locale }: { locale: Locale }) {
  const session = await requireUser(locale);
  const reviews = await prisma.review.findMany({
    where: { userId: session.user.id, deletedAt: null },
    include: { place: true },
    orderBy: { updatedAt: 'desc' },
  });
  const isThai = locale === 'th';
  return (
    <PageShell locale={locale}>
      <main className="container-shell max-w-4xl py-12">
        <p className="eyebrow">Community</p>
        <h1 className="mt-2 text-4xl font-black">{isThai ? 'รีวิวของฉัน' : 'My reviews'}</h1>
        <div className="mt-8 grid gap-4">
          {reviews.length === 0 ? (
            <p className="rounded-[28px] border border-dashed p-12 text-center font-bold">
              {isThai ? 'ยังไม่มีรีวิว' : 'No reviews yet'}
            </p>
          ) : (
            reviews.map((review) => (
              <a
                key={review.id}
                href={withLocale(locale, `/places/${review.place.slug}`)}
                className="surface p-5"
              >
                <div className="flex justify-between">
                  <h2 className="font-black">
                    {isThai ? review.place.nameTh : review.place.nameEn || review.place.nameTh}
                  </h2>
                  <span className="flex items-center gap-1 font-black text-[#a56c19]">
                    <Star className="size-4 fill-current" />
                    {review.rating}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#5e6561]">{review.content}</p>
              </a>
            ))
          )}
        </div>
      </main>
    </PageShell>
  );
}
