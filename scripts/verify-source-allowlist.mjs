import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const allowedHosts = new Set([
  'registry.npmjs.org',
  'gis-portal.disaster.go.th',
  'tile.openstreetmap.org',
  'nominatim.openstreetmap.org',
  'www.openstreetmap.org',
  'www.google.com',
  'tiles.mapterhorn.com',
  'nextjs.org',
  'www.jenkins.io',
  'updates.jenkins.io',
  'get.jenkins.io',
  'binaries.prisma.sh',
  'www.prisma.io',
  'better-auth.com',
  'hub.docker.com',
  'cdn.playwright.dev',
  'playwright.azureedge.net',
  'public.ecr.aws',
]);
const ignored = new Set([
  '.git',
  '.next',
  'node_modules',
  'coverage',
  'playwright-report',
  'test-results',
  '.playwright',
]);
const ownFile = 'scripts/verify-source-allowlist.mjs';
const ignoredFiles = new Set([ownFile, 'package-lock.json']);
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignored.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await files(full)));
    else result.push(full);
  }
  return result;
}
const violations = [];
for (const file of await files(process.cwd())) {
  const relative = path.relative(process.cwd(), file).replaceAll('\\', '/');
  if (ignoredFiles.has(relative)) continue;
  // Private database backup manifests contain passive user/source URLs, not
  // executable download configuration. The no-GitHub gate still checks them.
  if (
    /^infra\/backups\/category-retirement-\d+\/(?:dry-run|normalized-before)\.json$/u.test(relative)
  )
    continue;
  if (
    !/\.(?:js|mjs|ts|tsx|json|md|ya?ml|env|sh|groovy)$/u.test(relative) &&
    relative !== 'Jenkinsfile'
  )
    continue;
  let content;
  try {
    content = await readFile(file, 'utf8');
  } catch {
    continue;
  }
  // Provenance is passive, private data, never a dependency/download allowlist.
  // The independent no-GitHub gate still scans this file in full.
  if (relative === 'infra/runtime/place-imports/normalized.json') {
    try {
      const snapshot = JSON.parse(content);
      if (!Array.isArray(snapshot.records) || snapshot.report?.dataset !== 'thailand-pet-places')
        throw new Error();
      for (const record of snapshot.records) {
        for (const value of [record.website, ...record.sources.map((source) => source.url)].filter(
          Boolean,
        )) {
          const url = new URL(value);
          if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
            throw new Error();
        }
      }
    } catch {
      violations.push(`${relative}: invalid passive provenance snapshot`);
    }
    continue;
  }
  for (const match of content.matchAll(/https?:\/\/[^\s"'<>`)]+/gu)) {
    try {
      const host = new URL(match[0].replace(/[.,;:]$/u, '')).hostname;
      const localHost =
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === 'host.docker.internal' ||
        host.endsWith('.invalid') ||
        host.includes('$') ||
        !host.includes('.');
      if (!allowedHosts.has(host) && !localHost) violations.push(`${relative}: ${host}`);
    } catch {
      violations.push(`${relative}: malformed URL`);
    }
  }
}
if (violations.length) {
  process.stderr.write(`Source allowlist violations:\n${violations.join('\n')}\n`);
  process.exitCode = 1;
} else process.stdout.write('All declared source URLs use approved hosts.\n');
