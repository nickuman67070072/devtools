import { PageShell } from '@/components/page-shell';
import { SubmissionForm } from '@/features/submissions/submission-form';
import { requireUser } from '@/lib/auth-guards';
export const dynamic = 'force-dynamic';
export default async function Page() {
  await requireUser('en');
  return (
    <PageShell locale="en">
      <main className="container-shell py-12">
        <SubmissionForm locale="en" />
      </main>
    </PageShell>
  );
}
