export function getTrustedOrigins(baseUrl: string, configuredOrigin?: string) {
  const origins = (configuredOrigin ?? baseUrl)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const authUrl = new URL(baseUrl);

  if (authUrl.hostname === 'localhost' || authUrl.hostname === '127.0.0.1') {
    const alternateHost = authUrl.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
    origins.push(`${authUrl.protocol}//${alternateHost}${authUrl.port ? `:${authUrl.port}` : ''}`);
  }

  return [...new Set(origins)];
}
