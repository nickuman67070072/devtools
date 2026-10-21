const requiredRuntimeVariables = [
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'APP_ORIGIN',
  'S3_ENDPOINT',
  'S3_BUCKET',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'SMTP_HOST',
  'SMTP_PORT',
  'MAIL_FROM',
  'NOMINATIM_CONTACT_EMAIL',
] as const;

export function requiredEnvironment(name: (typeof requiredRuntimeVariables)[number] | string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Required environment variable ${name} is not configured`);
  return value;
}

export function productionConfigurationIssues() {
  if (process.env.NODE_ENV !== 'production') return [];
  const issues = requiredRuntimeVariables.filter((name) => !process.env[name]?.trim());
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (secret && secret.length < 32) issues.push('BETTER_AUTH_SECRET');
  for (const name of ['BETTER_AUTH_URL', 'APP_ORIGIN'] as const) {
    const value = process.env[name]?.trim();
    if (value) {
      try {
        const parsed = new URL(value);
        const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
        if (parsed.protocol !== 'https:' && !local) issues.push(name);
      } catch {
        issues.push(name);
      }
    }
  }
  return [...new Set(issues)];
}
