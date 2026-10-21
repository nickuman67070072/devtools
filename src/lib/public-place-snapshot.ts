import { z } from 'zod';

const nullableText = z.string().nullable();
export const publicPlaceSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  places: z.array(
    z.object({
      slug: z.string().min(1),
      nameTh: z.string().min(1),
      nameEn: nullableText,
      descriptionTh: z.string(),
      descriptionEn: nullableText,
      addressTh: z.string(),
      addressEn: nullableText,
      postalCode: nullableText,
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      phone: nullableText,
      emergencyPhone: nullableText,
      website: nullableText,
      socialLinks: z.record(z.string(), z.unknown()).nullable(),
      status: z.enum(['VERIFIED', 'STALE', 'TEMPORARILY_CLOSED', 'PERMANENTLY_CLOSED']),
      confidenceLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
      trustScore: z.number().int().min(0).max(100),
      lastVerifiedAt: z.string().datetime().nullable(),
      isEmergency24Hours: z.boolean(),
      provinceCode: z.string().min(1),
      districtCode: nullableText,
      primaryCategoryCode: z.string().min(1),
      additionalCategoryCodes: z.array(z.string().min(1)),
      petRule: z
        .object({
          petTypes: z.array(z.enum(['DOG', 'CAT', 'SMALL_PET', 'BIRD', 'EXOTIC'])),
          petSizes: z.array(z.enum(['SMALL', 'MEDIUM', 'LARGE'])),
          indoorAllowed: z.boolean(),
          outdoorAllowed: z.boolean(),
          leashRequired: z.boolean(),
          carrierRequired: z.boolean(),
          strollerRequired: z.boolean(),
          diaperRequired: z.boolean(),
          freeEntry: z.boolean(),
          feeDescriptionTh: nullableText,
          feeDescriptionEn: nullableText,
          maximumWeightKg: z.number().nullable(),
          maximumPetCount: z.number().int().nullable(),
          advanceNotice: z.boolean(),
          hasParking: z.boolean(),
          hasDrinkingWater: z.boolean(),
          hasWasteArea: z.boolean(),
          hasRamp: z.boolean(),
        })
        .nullable(),
      businessHours: z.array(
        z.object({
          weekday: z.enum([
            'MONDAY',
            'TUESDAY',
            'WEDNESDAY',
            'THURSDAY',
            'FRIDAY',
            'SATURDAY',
            'SUNDAY',
          ]),
          intervalOrder: z.number().int().min(0),
          opensAt: nullableText,
          closesAt: nullableText,
          isClosed: z.boolean(),
          is24Hours: z.boolean(),
        }),
      ),
    }),
  ),
});

export type PublicPlaceSnapshot = z.infer<typeof publicPlaceSnapshotSchema>;
