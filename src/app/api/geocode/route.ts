import { NextRequest, NextResponse } from 'next/server';
import { requiredEnvironment } from '@/lib/server-config';
import { z } from 'zod';

const schema = z.object({ q: z.string().trim().min(3).max(160) });
const cache = new Map<string, { expiresAt: number; value: unknown }>();
let lastRequestAt = 0;

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const parsed = schema.safeParse({ q: request.nextUrl.searchParams.get('q') });
  if (!parsed.success) {
    return NextResponse.json({ error: 'กรุณากรอกที่อยู่อย่างน้อย 3 ตัวอักษร' }, { status: 400 });
  }
  const query = parsed.data.q.toLocaleLowerCase('th');
  const cached = cache.get(query);
  if (cached && cached.expiresAt > Date.now()) return NextResponse.json(cached.value);
  if (Date.now() - lastRequestAt < 1_000) {
    return NextResponse.json(
      { error: 'กรุณารอสักครู่ก่อนค้นหาที่อยู่ครั้งถัดไป' },
      { status: 429 },
    );
  }
  const baseUrl = process.env.NOMINATIM_BASE_URL ?? 'https://nominatim.openstreetmap.org';
  const url = new URL('/search', baseUrl);
  url.search = new URLSearchParams({
    q: parsed.data.q,
    format: 'jsonv2',
    addressdetails: '1',
    countrycodes: 'th',
    limit: '5',
  }).toString();
  if (url.hostname !== 'nominatim.openstreetmap.org') {
    return NextResponse.json({ error: 'Geocoding provider is not approved' }, { status: 503 });
  }
  lastRequestAt = Date.now();
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': `PawMap-Thailand/1.0 (${requiredEnvironment('NOMINATIM_CONTACT_EMAIL')})`,
      },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Provider unavailable');
    const raw = (await response.json()) as Array<{
      place_id: number;
      display_name: string;
      lat: string;
      lon: string;
    }>;
    const value = {
      results: raw.map((item) => ({
        id: String(item.place_id),
        displayName: item.display_name,
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      })),
    };
    cache.set(query, { expiresAt: Date.now() + 86_400_000, value });
    return NextResponse.json(value);
  } catch {
    return NextResponse.json(
      { error: 'ค้นหาที่อยู่ไม่ได้ในขณะนี้ กรุณาปักหมุดด้วยตนเอง' },
      { status: 503 },
    );
  }
}
