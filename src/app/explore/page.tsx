import { SiteHeader } from '@/components/site-header';
import { ExploreShell } from '@/features/map/explore-shell';
import { parseExploreUrl, toUrlSearchParams } from '@/lib/explore-url';

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initialState = parseExploreUrl(toUrlSearchParams(await searchParams));
  return (
    <>
      <SiteHeader locale="th" />
      <main>
        <ExploreShell locale="th" initialState={initialState} />
      </main>
    </>
  );
}
