import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseMapQuery } from '@/lib/map-query';
import { findPublicMapPoints, findPublicPlaces, publicPlaceStats } from '@/lib/place-repository';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  let filters;
  let cursor;
  try {
    filters = parseMapQuery(request.nextUrl.searchParams);
    cursor = z.coerce
      .number()
      .int()
      .min(0)
      .max(10000000)
      .parse(request.nextUrl.searchParams.get('cursor') ?? 0);
  } catch {
    return NextResponse.json({ error: 'INVALID_QUERY' }, { status: 400 });
  }
  if (request.nextUrl.searchParams.get('detail') === 'compact') {
    const { items, nextCursor } = await findPublicMapPoints(filters, cursor);
    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features: items.map((place) => ({
          type: 'Feature',
          id: place.id,
          geometry: { type: 'Point', coordinates: [place.longitude, place.latitude] },
          properties: place,
        })),
        returned: items.length,
        nextCursor,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const [places, stats] = await Promise.all([
    findPublicPlaces(filters, { skip: cursor, take: 750 }),
    publicPlaceStats(filters),
  ]);
  return NextResponse.json(
    {
      type: 'FeatureCollection',
      features: places.map((place) => ({
        type: 'Feature',
        id: place.id,
        geometry: { type: 'Point', coordinates: [place.longitude, place.latitude] },
        properties: place,
      })),
      total: stats.total,
      facets: stats.facets,
      returned: places.length,
      nextCursor:
        places.length && cursor + places.length < stats.total ? cursor + places.length : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
