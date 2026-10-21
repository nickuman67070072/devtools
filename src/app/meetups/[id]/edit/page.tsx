import { MeetupEditPage } from '@/features/meetups/edit-page';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <MeetupEditPage id={(await params).id} locale="th" />;
}
