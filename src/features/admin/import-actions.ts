'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-guards';
import type { ActionResult } from '@/lib/action-result';
import { reviewImportedPlace, type ImportDecision } from './import-service';

export async function reviewImport(
  input: ImportDecision,
): Promise<ActionResult<{ placeId: string | null }>> {
  const session = await requireAdmin();
  try {
    const data = await reviewImportedPlace(session.user.id, input);
    revalidatePath('/admin/imports');
    revalidatePath('/explore');
    revalidatePath('/en/explore');
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      formError: error instanceof Error ? error.message : 'ไม่สามารถตรวจข้อมูลได้',
    };
  }
}
