import { MyMeetupsPage } from '@/features/meetups/my-meetups-page';

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <MyMeetupsPage locale="en" tab={tab} />;
}
