import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { productionConfigurationIssues } from '@/lib/server-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = { 'X-PawMap-Release': process.env.PAWMAP_RELEASE || 'unversioned' };
  try {
    const configuration = productionConfigurationIssues();
    if (configuration.length) {
      return NextResponse.json(
        { status: 'not-ready', reason: 'runtime-configuration' },
        { status: 503, headers },
      );
    }
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ready', repository: 'postgresql' }, { headers });
  } catch {
    return NextResponse.json({ status: 'not-ready' }, { status: 503, headers });
  }
}
