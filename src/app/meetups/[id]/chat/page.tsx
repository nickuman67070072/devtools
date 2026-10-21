import { MeetupChatPage } from '@/features/meetups/chat-page';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <MeetupChatPage id={(await params).id} locale="th" />;
}
