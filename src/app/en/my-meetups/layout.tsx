import type { ReactNode } from 'react';

import { MeetupShell } from '@/features/meetups/meetup-shell';

export default function Layout({ children }: { children: ReactNode }) {
  return <MeetupShell locale="en">{children}</MeetupShell>;
}
