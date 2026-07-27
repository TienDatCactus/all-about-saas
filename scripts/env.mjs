#!/usr/bin/env node
/**
 * Render every .env.tpl into its real (gitignored) .env file using the
 * 1Password CLI. This is how you "sync" secrets to a new device: install `op`,
 * sign in once, then run `npm run env:pull`. No manual copying, nothing secret
 * in git.
 *
 * Each op://Vault/Item/field reference in a template is resolved by `op inject`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// [ template, output ] — outputs stay gitignored.
const MAP = [
  ['apps/api/.env.tpl', 'apps/api/.env.development.local'],
  ['apps/web/.env.tpl', 'apps/web/.env'],
  ['packages/transactional/.env.tpl', 'packages/transactional/.env'],
];

function hasOp() {
  try {
    execFileSync('op', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (!hasOp()) {
  console.error(
    '\n✗ 1Password CLI (`op`) not found.\n' +
      '  Install it: https://developer.1password.com/docs/cli/get-started/\n' +
      '  Then enable desktop-app integration (Settings → Developer) or run `op signin`.\n',
  );
  process.exit(1);
}

let failed = 0;
for (const [tpl, out] of MAP) {
  const tplPath = resolve(root, tpl);
  const outPath = resolve(root, out);
  if (!existsSync(tplPath)) {
    console.warn(`- skip ${tpl} (no template found)`);
    continue;
  }
  try {
    // -f overwrites the output; op resolves op:// refs against your signed-in account.
    execFileSync('op', ['inject', '-f', '-i', tplPath, '-o', outPath], {
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    console.log(`✓ ${out}`);
  } catch {
    console.error(`✗ ${out} — op inject failed (not signed in, or a reference is missing)`);
    failed++;
  }
}

if (failed) {
  console.error(`\n${failed} file(s) failed. Run \`op signin\` and check your vault item names.\n`);
  process.exit(1);
}
console.log('\nDone. Secrets rendered from 1Password.\n');
