import { SiteHeader } from '@/components/site-header';
import { ExploreShell } from '@/features/map/explore-shell';
import { parseExploreUrl, toUrlSearchParams } from '@/lib/explore-url';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ provinceSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { provinceSlug } = await params;
  const initialState = parseExploreUrl(toUrlSearchParams(await searchParams), provinceSlug);
  return (
    <>
      <SiteHeader locale="en" />
      <main>
        <ExploreShell locale="en" initialState={initialState} />
      </main>
    </>
  );
}
