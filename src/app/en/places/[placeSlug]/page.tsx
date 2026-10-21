import { PlaceDetailPage } from '@/features/places/place-detail-page';
export const dynamic = 'force-dynamic';
export default async function Page({ params }: { params: Promise<{ placeSlug: string }> }) {
  const { placeSlug } = await params;
  return <PlaceDetailPage slug={placeSlug} locale="en" />;
}
