import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth-guards';
import { findConstructionHouses } from '@/lib/construction-repository';
import { parseMapQuery } from '@/lib/map-query';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  if (session.user.suspendedAt)
    return NextResponse.json({ error: 'SUSPENDED' }, { status: 403, headers });
  let filters;
  try {
    filters = parseMapQuery(request.nextUrl.searchParams);
  } catch {
    return NextResponse.json({ error: 'INVALID_QUERY' }, { status: 400, headers });
  }
  return NextResponse.json(
    { houses: await findConstructionHouses(session.user.id, filters) },
    { headers },
  );
}
