import { MeetupDetailPage } from '@/features/meetups/detail-page';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <MeetupDetailPage id={(await params).id} locale="th" />;
}
