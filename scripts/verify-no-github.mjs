import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const forbiddenHosts = [
  ['git', 'hub.com'].join(''),
  ['raw.git', 'hubusercontent.com'].join(''),
  ['api.git', 'hub.com'].join(''),
  ['codeload.git', 'hub.com'].join(''),
  ['objects.git', 'hubusercontent.com'].join(''),
  ['ghcr', '.io'].join(''),
];
const ignoredDirectories = new Set([
  '.git',
  '.next',
  'node_modules',
  'coverage',
  'playwright-report',
  'test-results',
]);
const ignoredFiles = new Set(['scripts/verify-no-github.mjs', 'package-lock.json']);
const canonicalRemote = ['https://git', 'hub.com/nickuman67070072/devtools.git'].join('');
const canonicalSshRemote = ['git@git', 'hub.com:nickuman67070072/devtools.git'].join('');
const textExtensions = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.env',
  '.txt',
  '.groovy',
  '.sh',
]);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(fullPath)));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

const root = process.cwd();
const violations = [];
for (const file of await collectFiles(root)) {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  if (ignoredFiles.has(relative)) continue;
  if (relative !== 'Jenkinsfile' && !textExtensions.has(path.extname(file))) continue;
  const text = await readFile(file, 'utf8');
  for (const host of forbiddenHosts) {
    if (text.toLowerCase().includes(host)) violations.push(`${relative}: ${host}`);
  }
}

const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
for (const [name, metadata] of Object.entries(lock.packages ?? {})) {
  if (metadata.resolved && new URL(metadata.resolved).hostname !== 'registry.npmjs.org') {
    violations.push(`package-lock.json:${name}: ${metadata.resolved}`);
  }
}

try {
  const remotes = execFileSync('git', ['remote', 'get-url', '--all', 'origin'], {
    encoding: 'utf8',
  })
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);
  for (const remote of remotes) {
    const isLocal =
      remote.startsWith('file://') ||
      /^[a-zA-Z]:[\\/]/u.test(remote) ||
      remote.startsWith('/') ||
      remote.startsWith('./') ||
      remote.startsWith('../');
    if (!isLocal && remote !== canonicalRemote && remote !== canonicalSshRemote)
      violations.push(`unapproved Git remote: ${remote}`);
  }
} catch {
  // A repository without an origin remote is valid for this local-only project.
}

if (violations.length) {
  process.stderr.write(`Unapproved source references:\n${violations.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('No unapproved GitHub-hosted source or artifact references found.\n');
}
