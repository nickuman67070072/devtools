import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';

const root = process.cwd();
const listed = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  cwd: root,
  encoding: 'utf8',
})
  .split(/\r?\n/u)
  .filter(Boolean)
  .map((file) => file.replaceAll('\\', '/'));

const violations = [];
const forbiddenPaths = [
  /(^|\/)\.env(\.|$)/u,
  /(^|\/)(?:infra\/backups|infra\/deploy-logs|infra\/runtime|release)(\/|$)/u,
  /\.(?:dump|log|pem|key|p12|pfx)$/iu,
  /(^|\/)(?:coverage|test-results|playwright-report|\.next)(\/|$)/u,
];
const allowedPath = (file) => file === '.env.example';
for (const file of listed) {
  if (!allowedPath(file) && forbiddenPaths.some((pattern) => pattern.test(file))) {
    violations.push(`${file}: forbidden release path`);
  }
}

const personalUser = ['sa', 'wam'].join('');
const personalEmail = ['67070072', '@', 'kmitl.ac.th'].join('');
const retiredCredentials = [
  ['Admin', '-PawMap-', '2569!'].join(''),
  ['User', '-PawMap-', '2569!'].join(''),
  ['pawmap', '-local-', 'admin'].join(''),
  ['pawmap', '-local-', 'secret'].join(''),
  ['pawmap', '-local-', 'db'].join(''),
];
const binaryExtensions = /\.(?:png|jpe?g|webp|gif|mp4|glb|gz|woff2?|ico|pdf)$/iu;
for (const relative of listed) {
  if (binaryExtensions.test(relative)) continue;
  let text;
  try {
    text = await readFile(path.join(root, relative), 'utf8');
  } catch {
    continue;
  }
  const lower = text.toLowerCase();
  if (lower.includes(personalUser)) violations.push(`${relative}: personal user identifier`);
  if (lower.includes(personalEmail))
    violations.push(`${relative}: personal email in tracked content`);
  if (/c:[\\/]users[\\/](?!<)/iu.test(text)) violations.push(`${relative}: personal Windows path`);
  for (const credential of retiredCredentials) {
    if (text.includes(credential)) violations.push(`${relative}: retired credential literal`);
  }
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u.test(text))
    violations.push(`${relative}: private key material`);
}

const snapshotRelative = 'prisma/data/public-places.v1.json.gz';
if (listed.includes(snapshotRelative)) {
  try {
    const snapshot = JSON.parse(
      gunzipSync(await readFile(path.join(root, snapshotRelative))).toString('utf8'),
    );
    if (snapshot.schemaVersion !== 1 || snapshot.places?.length !== 3091)
      throw new Error('unexpected schema or count');
    const serialized = JSON.stringify(snapshot);
    for (const forbidden of [
      'sourceUrl',
      'evidenceUrl',
      'ImportedPlace',
      'userId',
      'uploadedById',
      personalUser,
      personalEmail,
    ]) {
      if (serialized.toLowerCase().includes(forbidden.toLowerCase()))
        violations.push(`${snapshotRelative}: forbidden snapshot value ${forbidden}`);
    }
  } catch (error) {
    violations.push(
      `${snapshotRelative}: ${error instanceof Error ? error.message : 'invalid snapshot'}`,
    );
  }
} else {
  violations.push(`${snapshotRelative}: required release snapshot is missing`);
}

if (violations.length) {
  process.stderr.write(`Release safety violations:\n${violations.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Release safety check passed for ${listed.length} files.\n`);
}
