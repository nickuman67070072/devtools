import { NextResponse } from 'next/server';

import { searchMeetups, searchMeetupSchema } from '@/features/meetups/service';
import { hasTrustedOrigin } from '@/lib/origin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request))
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  const parsed = searchMeetupSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: 'INVALID_QUERY', issues: parsed.error.issues },
      { status: 400 },
    );
  const result = await searchMeetups(parsed.data);
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
}
