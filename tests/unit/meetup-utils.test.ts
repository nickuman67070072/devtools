import { describe, expect, it } from 'vitest';

import {
  canWriteMeetupChat,
  distanceKm,
  effectiveMeetupStatus,
} from '../../src/features/meetups/utils';

describe('Meetup lifecycle and distance', () => {
  const now = new Date('2026-10-20T10:00:00.000Z');
  const starts = new Date('2026-10-20T11:00:00.000Z');
  const ends = new Date('2026-10-20T13:00:00.000Z');

  it('derives FULL from capacity and reopens when a member leaves', () => {
    expect(effectiveMeetupStatus('OPEN', starts, ends, 8, 8, now)).toBe('FULL');
    expect(effectiveMeetupStatus('OPEN', starts, ends, 7, 8, now)).toBe('OPEN');
  });

  it('prioritizes terminal and time-based statuses', () => {
    expect(effectiveMeetupStatus('CANCELLED', starts, ends, 1, 8, now)).toBe('CANCELLED');
    expect(
      effectiveMeetupStatus('OPEN', starts, ends, 1, 8, new Date('2026-10-20T12:00:00Z')),
    ).toBe('ONGOING');
    expect(
      effectiveMeetupStatus('CLOSED', starts, ends, 1, 8, new Date('2026-10-20T14:00:00Z')),
    ).toBe('COMPLETED');
  });

  it('calculates a radius without revealing or persisting a search point', () => {
    expect(distanceKm(13.7563, 100.5018, 13.7563, 100.5018)).toBe(0);
    expect(distanceKm(13.7563, 100.5018, 18.7883, 98.9853)).toBeGreaterThan(500);
  });

  it('makes cancelled chat read-only immediately and completed chat after 24 hours', () => {
    expect(canWriteMeetupChat('CANCELLED', ends, now)).toBe(false);
    expect(canWriteMeetupChat('COMPLETED', ends, new Date('2026-10-21T12:59:00Z'))).toBe(true);
    expect(canWriteMeetupChat('COMPLETED', ends, new Date('2026-10-21T13:00:00Z'))).toBe(false);
  });
});
