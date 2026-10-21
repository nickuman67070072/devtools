import { z } from 'zod';
import { categoryDefinitions } from './domain';

export const activeCategoryCode = z
  .string()
  .refine(
    (code) => categoryDefinitions.some((category) => category.code === code),
    'หมวดหมู่นี้ไม่เปิดใช้งาน / This category is not available',
  );

export const plainText = (minimum = 1, maximum = 2_000) =>
  z
    .string()
    .trim()
    .min(minimum)
    .max(maximum)
    .refine((value) => !/[<>]/u.test(value), 'กรุณาใช้ข้อความธรรมดาโดยไม่มีแท็ก HTML');

export function firstFieldErrors(error: z.ZodError) {
  const flattened = z.flattenError(error);
  return Object.fromEntries(
    Object.entries(flattened.fieldErrors).flatMap(([field, messages]) =>
      Array.isArray(messages) && messages.length ? [[field, messages]] : [],
    ),
  );
}
