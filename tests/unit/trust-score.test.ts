import { describe, expect, it } from 'vitest';
import { calculateTrustScore } from '@/lib/trust-score';

const now = new Date('2026-09-01T00:00:00Z');
describe('calculateTrustScore', () => {
  it('rates recent admin and owner evidence as high', () => {
    const result = calculateTrustScore(
      {
        lastVerifiedAt: new Date('2026-08-20T00:00:00Z'),
        confirmedReports: 0,
        verifications: [
          { kind: 'ADMIN', isConfirmed: true, createdAt: now, hasEvidence: true },
          { kind: 'OWNER', isConfirmed: true, createdAt: now, hasEvidence: true },
          { kind: 'COMMUNITY', isConfirmed: true, createdAt: now, hasEvidence: true },
        ],
      },
      now,
    );
    expect(result.level).toBe('HIGH');
    expect(result.stale).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(75);
  });
  it('marks records older than 180 days stale and penalizes reports', () => {
    const result = calculateTrustScore(
      { lastVerifiedAt: new Date('2025-01-01T00:00:00Z'), confirmedReports: 3, verifications: [] },
      now,
    );
    expect(result).toMatchObject({ score: 0, level: 'LOW', stale: true });
    expect(result.factors.confirmedReports).toBe(3);
  });
  it('caps repeated community signals at 100', () => {
    const verifications = Array.from({ length: 30 }, () => ({
      kind: 'COMMUNITY' as const,
      isConfirmed: true,
      createdAt: now,
      hasEvidence: true,
    }));
    expect(
      calculateTrustScore({ lastVerifiedAt: now, confirmedReports: 0, verifications }, now).score,
    ).toBeLessThanOrEqual(100);
  });
});
