import { access, readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('tests/interaction-manifest.json', 'utf8'));
const missing = [];
for (const [interaction, tests] of Object.entries(manifest)) {
  if (!Array.isArray(tests) || tests.length === 0) {
    missing.push(`${interaction}: no automated verification`);
    continue;
  }
  for (const reference of tests) {
    const file = String(reference).split(': ')[0];
    try {
      await access(file);
    } catch {
      missing.push(`${interaction}: ${file} is missing`);
    }
  }
}
if (missing.length) {
  process.stderr.write(`Interaction manifest is incomplete:\n${missing.join('\n')}\n`);
  process.exitCode = 1;
} else
  process.stdout.write(
    `Interaction manifest covers ${Object.keys(manifest).length} workflow groups.\n`,
  );
