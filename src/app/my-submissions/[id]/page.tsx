import { SubmissionDetailPage } from '@/features/submissions/submission-detail-page';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SubmissionDetailPage id={id} locale="th" />;
}
