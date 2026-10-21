import type { MeetupStatus } from '@prisma/client';

export function effectiveMeetupStatus(
  status: MeetupStatus,
  startsAt: Date,
  endsAt: Date,
  memberCount: number,
  maxMembers: number,
  now = new Date(),
) {
  if (status === 'CANCELLED' || status === 'COMPLETED') return status;
  if (endsAt <= now) return 'COMPLETED';
  if (startsAt <= now) return 'ONGOING';
  if (status === 'CLOSED') return status;
  return memberCount >= maxMembers ? 'FULL' : 'OPEN';
}

export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const radians = Math.PI / 180;
  const latDelta = (bLat - aLat) * radians;
  const lonDelta = (bLon - aLon) * radians;
  const value =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(aLat * radians) * Math.cos(bLat * radians) * Math.sin(lonDelta / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.min(1, Math.sqrt(value)));
}

export function canWriteMeetupChat(status: MeetupStatus, endsAt: Date, now = new Date()) {
  if (status === 'CANCELLED') return false;
  return now.getTime() < endsAt.getTime() + 24 * 60 * 60 * 1000;
}
