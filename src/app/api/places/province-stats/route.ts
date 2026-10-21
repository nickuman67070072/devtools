import { NextRequest, NextResponse } from 'next/server';
import { parseMapQuery } from '@/lib/map-query';
import { publicPlaceStats } from '@/lib/place-repository';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  let filters;
  try {
    filters = parseMapQuery(request.nextUrl.searchParams);
  } catch {
    return NextResponse.json({ error: 'INVALID_QUERY' }, { status: 400 });
  }
  // Province heights are independent of the viewport's point limit and bounding box.
  const stats = await publicPlaceStats({ ...filters, bbox: undefined });
  return NextResponse.json(stats, { headers: { 'Cache-Control': 'no-store' } });
}
