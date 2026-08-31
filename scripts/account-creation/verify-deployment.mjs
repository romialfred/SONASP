#!/usr/bin/env node
// Read-only release gate. Downloads deployed source into a new temporary folder;
// never publishes a function, applies SQL, creates an account or sends email.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cli = process.argv[2];
if (!cli) throw new Error('Usage: node scripts/account-creation/verify-deployment.mjs CHEMIN_CLI_SUPABASE');
const project = readFileSync(path.join(root, 'supabase/.temp/project-ref'), 'utf8').trim();
if (project !== 'yyverzuhkdonjjuficor') throw new Error('Projet lié inattendu.');
const required = ['20260830103000', '20260830111500', '20260830160000'];
function run(args) {
  try {
    return execFileSync(cli, args, { cwd: root, encoding: 'utf8', timeout: 60000,
      maxBuffer: 10 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    throw new Error(`Vérification distante indisponible (${args[0]} ${args[1]}). Aucune modification distante effectuée.`);
  }
}
function parse(raw) {
  const start = raw.search(/[\[{]/);
  if (start < 0) throw new Error('Réponse JSON absente.');
  return JSON.parse(raw.slice(start));
}
const functions = parse(run(['functions', 'list', '--project-ref', project, '-o', 'json']));
const deployed = functions.find((fn) => fn.slug === 'create-user');
const versions = parse(run(['db', 'query', '--linked',
  `SELECT version FROM supabase_migrations.schema_migrations WHERE version IN (${required.map((v) => `'${v}'`).join(',')}) ORDER BY version`,
  '-o', 'json'])).rows.map((row) => row.version);
const snapshot = mkdtempSync(path.join(tmpdir(), 'sonasp-create-user-verification-'));
if (deployed) run(['functions', 'download', 'create-user', '--project-ref', project, '--use-api', '--workdir', snapshot]);
const sourceRoot = path.join(root, 'supabase/functions');
const files = new Set();
function visit(relative) {
  if (files.has(relative)) return;
  const absolute = path.resolve(sourceRoot, relative);
  if (!absolute.startsWith(`${sourceRoot}${path.sep}`)) throw new Error('Import hors du répertoire des fonctions.');
  files.add(relative);
  const source = readFileSync(absolute, 'utf8');
  for (const match of source.matchAll(/from\s+['"](\.[^'"]+\.ts)['"]/g)) {
    visit(path.relative(sourceRoot, path.resolve(path.dirname(absolute), match[1])));
  }
}
visit('create-user/index.ts');
const hash = (file) => existsSync(file)
  ? createHash('sha256').update(readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').trim()).digest('hex') : null;
const comparison = [...files].sort().map((file) => {
  const local = hash(path.join(sourceRoot, file));
  const remote = hash(path.join(snapshot, 'supabase/functions', file));
  return { file: file.replaceAll('\\', '/'), local, remote, matches: local === remote };
});
const missingMigrations = required.filter((version) => !versions.includes(version));
const ready = deployed?.status === 'ACTIVE' && missingMigrations.length === 0 && comparison.every((file) => file.matches);
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), project, ready,
  function: { version: deployed?.version ?? null, status: deployed?.status ?? 'ABSENT' },
  missingMigrations, source: comparison, snapshot,
  note: 'La concordance de version ne remplace pas le test fonctionnel authentifié de création et réception du courriel.',
}, null, 2));
process.exitCode = ready ? 0 : 1;
