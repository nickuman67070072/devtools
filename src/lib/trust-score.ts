import type { VerificationKind } from '@prisma/client';

export interface TrustInputs {
  lastVerifiedAt?: Date | null;
  verifications: Array<{
    kind: VerificationKind;
    isConfirmed: boolean;
    createdAt: Date;
    hasEvidence: boolean;
  }>;
  confirmedReports: number;
}

export function calculateTrustScore(input: TrustInputs, now = new Date()) {
  const active = input.verifications.filter((item) => item.isConfirmed);
  const hasAdmin = active.some((item) => item.kind === 'ADMIN');
  const hasOwner = active.some((item) => item.kind === 'OWNER');
  const community = active.filter((item) => item.kind === 'COMMUNITY').length;
  const evidence = active.filter((item) => item.hasEvidence).length;
  const ageDays = input.lastVerifiedAt
    ? Math.floor((now.getTime() - input.lastVerifiedAt.getTime()) / 86_400_000)
    : 999;
  const recency = ageDays <= 30 ? 30 : ageDays <= 90 ? 22 : ageDays <= 180 ? 12 : 0;
  const score = Math.max(
    0,
    Math.min(
      100,
      (hasAdmin ? 30 : 0) +
        (hasOwner ? 20 : 0) +
        Math.min(20, community * 5) +
        Math.min(10, evidence * 2) +
        recency -
        Math.min(30, input.confirmedReports * 10),
    ),
  );
  return {
    score,
    level: score >= 75 ? ('HIGH' as const) : score >= 45 ? ('MEDIUM' as const) : ('LOW' as const),
    stale: ageDays > 180,
    factors: {
      adminVerification: hasAdmin,
      ownerVerification: hasOwner,
      community,
      evidence,
      ageDays,
      confirmedReports: input.confirmedReports,
    },
  };
}
