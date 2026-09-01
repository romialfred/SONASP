// Execute an explicitly named reviewed SQL file; keep the complete receipt off the console.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const [file, cli] = process.argv.slice(2);
if (!file || !cli) throw new Error('Usage: node scripts/data-labels/query.mjs SQL_FILE SUPABASE_CLI');
const allowed = ['inspect.sql', 'inspect-operations.sql', 'audit-labels.sql'].map(name => path.resolve('scripts/data-labels', name));
if (!allowed.includes(path.resolve(file))) throw new Error('Ce lecteur accepte uniquement les scripts d’inspection.');
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'yyverzuhkdonjjuficor') {
  throw new Error('Projet inattendu : arrêt sans requête.');
}
const output = execFileSync(cli, ['db', 'query', '--linked', '--file', path.resolve(file), '-o', 'json'], {
  encoding: 'utf8', timeout: 240_000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
});
const result = JSON.parse(output.slice(output.indexOf('{')));
const folder = mkdtempSync(path.join(tmpdir(), 'sonasp-data-labels-'));
writeFileSync(path.join(folder, 'receipt.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ receipt: path.join(folder, 'receipt.json'), rows: result.rows.map(row =>
  row.section ? { section: row.section, count: row.data?.length ?? 0 } : row) }, null, 2));
