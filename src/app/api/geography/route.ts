import { NextRequest, NextResponse } from 'next/server';

import { getDistricts, getProvinces } from '@/lib/boundaries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const provinceCode = request.nextUrl.searchParams.get('province') ?? undefined;
  const [provinces, districts] = await Promise.all([
    getProvinces(),
    provinceCode ? getDistricts(provinceCode) : Promise.resolve([]),
  ]);
  return NextResponse.json(
    { provinces, districts },
    { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } },
  );
}
