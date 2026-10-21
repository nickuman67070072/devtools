import { notFound } from 'next/navigation';

import { EditMeetupForm } from '@/features/meetups/edit-form';
import { requireUser } from '@/lib/auth-guards';
import type { Locale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';

export async function MeetupEditPage({ id, locale }: { id: string; locale: Locale }) {
  const session = await requireUser(locale);
  const meetup = await prisma.meetup.findFirst({
    where: { id, deletedAt: null },
    include: { place: { select: { id: true, nameTh: true, nameEn: true } } },
  });
  if (
    !meetup ||
    (meetup.hostId !== session.user.id && session.user.role !== 'ADMIN') ||
    meetup.startsAt <= new Date() ||
    meetup.status === 'CANCELLED'
  )
    notFound();
  return (
    <EditMeetupForm
      locale={locale}
      meetup={{
        id,
        version: meetup.version,
        title: meetup.title,
        description: meetup.description,
        rules: meetup.rules ?? '',
        place: meetup.place,
        startsAt: meetup.startsAt.toISOString(),
        endsAt: meetup.endsAt.toISOString(),
        maxMembers: meetup.maxMembers,
      }}
    />
  );
}
