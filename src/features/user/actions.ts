'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { ActionResult } from '@/lib/action-result';
import { requireUser } from '@/lib/auth-guards';
import { prisma } from '@/lib/prisma';
import { firstFieldErrors, plainText } from '@/lib/validation';

const profileSchema = z.object({
  name: plainText(2, 80),
  locale: z.enum(['th', 'en']),
});

export type ProfileInput = z.input<typeof profileSchema>;

export async function updateProfile(
  input: ProfileInput,
): Promise<ActionResult<{ name: string; locale: 'th' | 'en' }>> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: firstFieldErrors(parsed.error) };

  const session = await requireUser(parsed.data.locale);
  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: parsed.data,
    select: { name: true, locale: true },
  });

  revalidatePath('/profile');
  revalidatePath('/en/profile');
  return {
    ok: true,
    data: { name: user.name, locale: user.locale === 'en' ? 'en' : 'th' },
  };
}

export async function createCollection(name: string): Promise<ActionResult<{ id: string }>> {
  const session = await requireUser();
  const parsed = plainText(2, 80).safeParse(name);
  if (!parsed.success) return { ok: false, formError: 'ชื่อคอลเลกชันไม่ถูกต้อง' };
  try {
    const collection = await prisma.favoriteCollection.create({
      data: { name: parsed.data, userId: session.user.id },
    });
    revalidatePath('/favorites');
    return { ok: true, data: { id: collection.id } };
  } catch {
    return { ok: false, formError: 'มีคอลเลกชันชื่อนี้แล้ว' };
  }
}

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const session = await requireUser();
  const notification = await prisma.notification.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!notification) return { ok: false, formError: 'ไม่พบการแจ้งเตือน' };
  await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  revalidatePath('/notifications');
  return { ok: true, data: undefined };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const session = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath('/notifications');
  return { ok: true, data: undefined };
}
