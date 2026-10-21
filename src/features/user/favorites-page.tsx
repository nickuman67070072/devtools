import { FolderHeart, Heart, MapPin } from 'lucide-react';

import { PageShell } from '@/components/page-shell';
import { CollectionCreator } from '@/features/user/collection-creator';
import { requireUser } from '@/lib/auth-guards';
import type { Locale } from '@/lib/i18n';
import { withLocale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';

export async function FavoritesPage({ locale }: { locale: Locale }) {
  const session = await requireUser(locale);
  const [collections, favorites] = await Promise.all([
    prisma.favoriteCollection.findMany({
      where: { userId: session.user.id },
      include: { _count: { select: { favorites: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.favorite.findMany({
      where: { userId: session.user.id },
      include: { place: { include: { province: true, category: true } }, collection: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const isThai = locale === 'th';
  return (
    <PageShell locale={locale}>
      <main className="container-shell py-12">
        <p className="eyebrow">{isThai ? 'วางแผนทริป' : 'Plan together'}</p>
        <h1 className="mt-2 text-4xl font-black">{isThai ? 'รายการโปรด' : 'Favorites'}</h1>
        <div className="mt-7 grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="surface h-fit p-5">
            <h2 className="flex items-center gap-2 font-black">
              <FolderHeart className="size-5 text-[#2d5a43]" />
              {isThai ? 'คอลเลกชัน' : 'Collections'}
            </h2>
            <div className="mt-4">
              <CollectionCreator locale={locale} />
            </div>
            <ul className="mt-5 space-y-2">
              {collections.map((collection) => (
                <li
                  key={collection.id}
                  className="flex justify-between rounded-xl bg-[#f3f6f3] px-3 py-2 text-sm font-bold"
                >
                  <span>{collection.name}</span>
                  <span>{collection._count.favorites}</span>
                </li>
              ))}
            </ul>
          </aside>
          <section>
            {favorites.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-[#b8ccc3] bg-white/60 p-12 text-center">
                <Heart className="mx-auto size-10 text-[#6f8d82]" />
                <h2 className="mt-4 text-xl font-black">
                  {isThai ? 'ยังไม่มีสถานที่โปรด' : 'No favorites yet'}
                </h2>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {favorites.map((favorite) => (
                  <a
                    key={favorite.id}
                    href={withLocale(locale, `/places/${favorite.place.slug}`)}
                    className="surface p-5 transition hover:-translate-y-1"
                  >
                    <span className="text-xs font-bold text-[#2d5a43]">
                      {favorite.collection?.name ?? (isThai ? 'ทั่วไป' : 'General')}
                    </span>
                    <h2 className="mt-2 text-lg font-black">
                      {isThai
                        ? favorite.place.nameTh
                        : favorite.place.nameEn || favorite.place.nameTh}
                    </h2>
                    <p className="mt-2 flex gap-2 text-sm text-[#5e6561]">
                      <MapPin className="size-4" />
                      {isThai ? favorite.place.province.nameTh : favorite.place.province.nameEn}
                    </p>
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </PageShell>
  );
}
