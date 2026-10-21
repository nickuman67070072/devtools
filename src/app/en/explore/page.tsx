import { SiteHeader } from '@/components/site-header';
import { ExploreShell } from '@/features/map/explore-shell';
import { parseExploreUrl, toUrlSearchParams } from '@/lib/explore-url';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initialState = parseExploreUrl(toUrlSearchParams(await searchParams));
  return (
    <>
      <SiteHeader locale="en" />
      <main>
        <ExploreShell locale="en" initialState={initialState} />
      </main>
    </>
  );
}
