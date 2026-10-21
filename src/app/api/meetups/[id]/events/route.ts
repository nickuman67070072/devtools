import { headers } from 'next/headers';

import { auth } from '@/lib/auth';
import { canAccessMeetupChat } from '@/features/meetups/service';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session || session.user.suspendedAt) return new Response(null, { status: 401 });
  if (!(await canAccessMeetupChat(id, session.user.id, session.user.role === 'ADMIN')))
    return new Response(null, { status: 404 });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let latestVersion = '';
      let active = true;
      request.signal.addEventListener(
        'abort',
        () => {
          active = false;
        },
        { once: true },
      );
      try {
        controller.enqueue(encoder.encode('event: connected\ndata: {}\n\n'));
        while (active) {
          const currentSession = await auth.api.getSession({ headers: requestHeaders });
          const access =
            currentSession &&
            !currentSession.user.suspendedAt &&
            (await canAccessMeetupChat(id, session.user.id, session.user.role === 'ADMIN'));
          if (!access) {
            controller.enqueue(encoder.encode('event: revoked\ndata: {}\n\n'));
            break;
          }
          const latest = await prisma.meetupMessage.findFirst({
            where: { meetupId: id },
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            select: { id: true, updatedAt: true },
          });
          const version = latest ? `${latest.id}:${latest.updatedAt.getTime()}` : '';
          if (version && version !== latestVersion) {
            latestVersion = version;
            controller.enqueue(
              encoder.encode(`event: refresh\ndata: ${JSON.stringify({ version })}\n\n`),
            );
          } else controller.enqueue(encoder.encode(': keepalive\n\n'));
          await new Promise<void>((resolve) => setTimeout(resolve, 2000));
        }
      } catch {
        // Closed connections and deploys are recovered by EventSource reconnect.
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
