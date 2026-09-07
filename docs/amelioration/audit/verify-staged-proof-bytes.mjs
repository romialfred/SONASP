import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Read-only index audit: captured evidence must be stored without EOL conversion.
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const roots = [
  'docs/amelioration/audit/',
  'docs/amelioration/environnement/reprise-r02/',
  'docs/amelioration/environnement/reprise-r04/',
  'docs/amelioration/lot-artisanat/',
  'docs/amelioration/preuves/recette-r02/',
  'docs/amelioration/preuves/recette-r04/',
  'docs/amelioration/preuves/lecture-sites-ui/',
  'docs/amelioration/preuves/integration-r03/',
  'docs/header-identity-qa/',
  'docs/header-typography-qa/',
];
const staged = new Set(git('diff', '--cached', '--name-only', '-z').split('\0'));
const entries = git('ls-files', '--stage', '-z').split('\0').filter(Boolean);
const mismatches = [];
let checked = 0;
for (const entry of entries) {
  const [metadata, file] = entry.split('\t');
  if (!staged.has(file) || !roots.some(root => file.startsWith(root))) continue;
  const [, indexedHash, stage] = metadata.split(' ');
  if (stage !== '0') throw new Error(`Unmerged evidence: ${file}`);
  const bytes = readFileSync(file);
  const rawHash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  checked += 1;
  if (rawHash !== indexedHash) mismatches.push(file);
}
console.log(JSON.stringify({ checked, mismatches, indexBytesMatchWorkingFiles: checked > 0 && mismatches.length === 0 }, null, 2));
if (!checked || mismatches.length) process.exitCode = 1;
