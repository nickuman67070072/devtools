import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Serve only the two installed npm artifacts required by the MapLibre worker.
// Preserve their license headers. No remote fetch or user-controlled filesystem path.
const files = new Set(['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']);
export const runtime = 'nodejs';
export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  if (!files.has(file)) return new Response('Not found', { status: 404 });
  const source = await readFile(
    path.join(process.cwd(), 'node_modules/maplibre-gl/dist', file),
    'utf8',
  );
  return new Response(source, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
