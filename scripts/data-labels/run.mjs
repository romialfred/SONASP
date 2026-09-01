import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const [mode, target, confirmation] = process.argv.slice(2);
if (!['local', 'rehearse', 'apply'].includes(mode) || !target) {
  throw new Error('Usage: run.mjs local DB_NAME | rehearse SUPABASE_CLI | apply SUPABASE_CLI NORMALIZE-DEVELOPMENT-LABELS');
}
if (mode === 'apply' && confirmation !== 'NORMALIZE-DEVELOPMENT-LABELS') throw new Error('Confirmation exacte requise.');
if (mode === 'local' && !/^sonasp_label_validation_20260831$/.test(target)) throw new Error('Base isolée attendue.');
if (mode !== 'local' && readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'yyverzuhkdonjjuficor') {
  throw new Error('Projet inattendu.');
}
const folder = mkdtempSync(path.join(tmpdir(), 'sonasp-label-repair-'));
const repair = readFileSync('scripts/data-labels/repair.sql', 'utf8');
const transaction = mode === 'rehearse' ? 'ROLLBACK' : 'COMMIT';
const sql = `BEGIN ISOLATION LEVEL SERIALIZABLE;\n${repair}\n${transaction};\n`;
const sqlFile = path.join(folder, `${mode}.sql`);
writeFileSync(sqlFile, sql);
const command = mode === 'local' ? 'docker' : target;
const args = mode === 'local'
  ? ['exec', '-i', 'supabase_db_SONASP-local-mirror', 'psql', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', target]
  : ['db', 'query', '--linked', '--file', sqlFile, '-o', 'json'];
const output = spawnSync(command, args, { input: mode === 'local' ? sql : undefined,
  encoding: 'utf8', timeout: 240_000, maxBuffer: 8 * 1024 * 1024 });
writeFileSync(path.join(folder, 'execution.json'), JSON.stringify({ mode, status: output.status, stdout: output.stdout, stderr: output.stderr }, null, 2));
if (output.status !== 0) {
  console.error(output.stderr || output.error?.message);
  console.error(`Vérifier l’état avant toute nouvelle tentative. Dossier : ${folder}`);
  process.exitCode = 1;
} else {
  const json = JSON.parse(output.stdout.slice(output.stdout.indexOf('{')));
  const result = mode === 'local' ? json : json.rows[0].result;
  const counts = {};
  for (const item of result.changes) counts[item.table_name] = (counts[item.table_name] || 0) + 1;
  writeFileSync(path.join(folder, 'changes.json'), JSON.stringify(result, null, 2));
  // Prepared reversal changes ONLY the exact fields in this run, and aborts on subsequent edits.
  const quote = value => value === null ? 'NULL' : `'${value.replaceAll("'", "''")}'`;
  const identifier = value => `"${value.replaceAll('"', '""')}"`;
  const reverse = result.changes.toReversed().map(item => `UPDATE public.${identifier(item.table_name)} SET ${identifier(item.column_name)}=${quote(item.old_value)} WHERE id=${quote(item.row_id)}::uuid AND ${identifier(item.column_name)} IS NOT DISTINCT FROM ${quote(item.new_value)}; GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'Donnée modifiée depuis la correction'; END IF;`);
  writeFileSync(path.join(folder, 'restore.sql'), `-- Review before use. Counters are never decremented (numbers can have been consumed).\nBEGIN;\nDO $restore$ DECLARE affected integer; BEGIN\n${reverse.join('\n')}\nEND $restore$;\nCOMMIT;\n`);
  console.log(JSON.stringify({ mode, transaction, folder, verifiedTables: result.verified_tables, changedFields: result.changes.length, counts,
    sales: result.changes.filter(item => item.table_name === 'sales') }, null, 2));
}
