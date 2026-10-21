import { getTrustedOrigins } from '@/lib/auth-origins';

export function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const authBaseUrl =
    process.env.BETTER_AUTH_URL ?? process.env.APP_ORIGIN ?? 'http://localhost:3000';
  return getTrustedOrigins(authBaseUrl, process.env.APP_ORIGIN).includes(origin);
}
