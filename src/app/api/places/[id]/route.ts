import { NextResponse } from 'next/server';
import { getPublicPlace } from '@/lib/place-repository';

export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id.length > 250) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  const place = await getPublicPlace(id);
  return NextResponse.json(place ?? { error: 'NOT_FOUND' }, {
    status: place ? 200 : 404,
    headers: { 'Cache-Control': 'no-store' },
  });
}
