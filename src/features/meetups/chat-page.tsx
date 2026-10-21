import { notFound } from 'next/navigation';

import { MeetupChatRoom } from '@/features/meetups/chat-room';
import { canAccessMeetupChat, canWriteMeetupChat } from '@/features/meetups/service';
import { requireUser } from '@/lib/auth-guards';
import type { Locale } from '@/lib/i18n';

export async function MeetupChatPage({ id, locale }: { id: string; locale: Locale }) {
  const session = await requireUser(locale);
  const meetup = await canAccessMeetupChat(id, session.user.id, session.user.role === 'ADMIN');
  if (!meetup) notFound();
  return (
    <MeetupChatRoom
      locale={locale}
      id={id}
      viewerId={session.user.id}
      canModerate={session.user.role === 'ADMIN' || meetup.hostId === session.user.id}
      writable={canWriteMeetupChat(meetup.status, meetup.endsAt)}
    />
  );
}
