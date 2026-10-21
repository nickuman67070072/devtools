import { z } from 'zod';
import { categoryDefinitions, type CategoryCode, type MapFilters } from '@/lib/domain';
const booleanParam = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true');
const querySchema = z.object({
  bbox: z
    .string()
    .optional()
    .transform((value, context) => {
      if (!value) return undefined;
      const numbers = value.split(',').map(Number);
      if (
        numbers.length !== 4 ||
        numbers.some((number) => !Number.isFinite(number)) ||
        numbers[0]! >= numbers[2]! ||
        numbers[1]! >= numbers[3]!
      ) {
        context.addIssue({ code: 'custom', message: 'bbox must contain four numbers' });
        return z.NEVER;
      }
      return numbers as [number, number, number, number];
    }),
  q: z.string().trim().max(100).optional(),
  province: z.string().trim().max(80).optional(),
  district: z.string().trim().max(80).optional(),
  categories: z.string().optional(),
  openNow: booleanParam,
  twentyFourHours: booleanParam,
  verifiedOnly: booleanParam,
  minimumRating: z.coerce.number().min(0).max(5).optional(),
});

export function parseMapQuery(params: URLSearchParams) {
  const parsed = querySchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) throw new Error('INVALID_QUERY');
  const categoryCodes = new Set<CategoryCode>(categoryDefinitions.map((category) => category.code));
  const categories = parsed.data.categories
    ?.split(',')
    .filter((value): value is CategoryCode => categoryCodes.has(value as CategoryCode));
  const filters: MapFilters = {
    query: parsed.data.q,
    province: parsed.data.province,
    district: parsed.data.district,
    categories,
    openNow: parsed.data.openNow,
    twentyFourHours: parsed.data.twentyFourHours,
    verifiedOnly: parsed.data.verifiedOnly,
    minimumRating: parsed.data.minimumRating,
    bbox: parsed.data.bbox,
  };

  return filters;
}
