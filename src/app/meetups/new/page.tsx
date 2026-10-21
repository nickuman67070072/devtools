import { CreateMeetupForm } from '@/features/meetups/create-form';
import { requireUser } from '@/lib/auth-guards';

export default async function NewMeetupPage() {
  await requireUser('th');
  return <CreateMeetupForm locale="th" />;
}
