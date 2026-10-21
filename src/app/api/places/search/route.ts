import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { findPublicPlaces, publicPlaceWhere } from '@/lib/place-repository';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  q: z.string().trim().max(100).optional(),
  province: z.string().trim().max(80).optional(),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(18),
});

export async function GET(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_QUERY' }, { status: 400 });
  }
  const filters = {
    query: parsed.data.q,
    province: parsed.data.province,
  };
  const [items, total] = await Promise.all([
    findPublicPlaces(filters, { skip: parsed.data.cursor, take: parsed.data.limit }),
    prisma.place.count({ where: publicPlaceWhere(filters) }),
  ]);
  const nextCursor =
    parsed.data.cursor + items.length < total ? parsed.data.cursor + items.length : null;
  return NextResponse.json({ items, total, nextCursor });
}
