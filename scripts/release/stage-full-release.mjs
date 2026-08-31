// Release rehearsal only: never connects to the remote database.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const folder = process.argv[2];
const mode = process.argv[3];
if (!folder || !['restore', 'data', 'apply', 'test'].includes(mode)) throw new Error('audit folder and mode required');
const container = 'supabase_db_SONASP-local-mirror';
const database = process.env.SONASP_RELEASE_TEST_DB || 'sonasp_release_20260830';
if (!['sonasp_release_20260830','sonasp_iam_audit_full_release_20260830'].includes(database)) throw new Error('Non-release database refused');
const psql = ['exec', '-i', container, 'psql', '-U', 'supabase_admin', '-d', database, '-v', 'ON_ERROR_STOP=1'];
const run = (sql) => execFileSync('docker', psql, { input: sql, encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024 });
const target = run('select current_database();');
if (!target.includes(database)) throw new Error('Unexpected staging database');
if (mode === 'restore') {
  const triggers = run("select pg_get_triggerdef(oid)||';' from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal;");
  writeFileSync(path.join(folder, 'staging-auth-triggers.txt'), triggers);
  run('DROP SCHEMA public CASCADE;');
  const log = run(readFileSync(path.join(folder, 'public-before.sql'), 'utf8'));
  writeFileSync(path.join(folder, 'staging-restore.log'), log);
  console.log('Live public schema restored into ' + database);
}
if (mode === 'data') {
  // Only this disposable, explicitly named local clone; never disable remote guards.
  const log = run('SET session_replication_role=replica;\n' + readFileSync(path.join(folder, 'public-data-before.sql'), 'utf8') + '\nSET session_replication_role=origin;');
  writeFileSync(path.join(folder, 'staging-data-restore.log'), log);
  const triggers = readFileSync(path.join(folder, 'staging-auth-triggers.txt'), 'utf8').match(/^\s*CREATE TRIGGER .+;\s*$/gm) || [];
  if (triggers.length) run(triggers.join('\n'));
  console.log('Public data restored into isolated clone; auth triggers restored: ' + triggers.length);
}
if (mode === 'apply') {
  const files = JSON.parse(readFileSync('scripts/release/full-release-spec.json', 'utf8'));
  for (const file of files) {
    const log = run(readFileSync(path.join('supabase/migrations', file), 'utf8'));
    writeFileSync(path.join(folder, file + '.staging.log'), log);
    console.log('PASS ' + file);
  }
}
if (mode === 'test') {
  let failures = 0;
  for (const file of process.argv.slice(4)) {
    try {
      const log = run(readFileSync(path.join('supabase/tests', file), 'utf8'));
      writeFileSync(path.join(folder, file + '.staging.log'), log);
      const failed = /(^|\n)\s*not ok \d|Looks like you failed|Bad plan/.test(log);
      failures += Number(failed);
      console.log(JSON.stringify({ file, passed: !failed, assertions: (log.match(/(^|\n)\s*ok \d/g) || []).length, failures: log.split('\n').filter(s => /not ok|Failed test|Looks like|Bad plan/.test(s)) }));
    } catch (e) {
      failures++;
      writeFileSync(path.join(folder, file + '.staging.log'), String(e.stdout || '') + String(e.stderr || ''));
      console.log(JSON.stringify({ file, passed: false, error: String(e.stderr || '').slice(-2000) }));
    }
  }
  if (failures) process.exitCode = 1;
}
