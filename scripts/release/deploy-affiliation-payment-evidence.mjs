// Scoped publication of the reviewed affiliation evidence migration; no history repair.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const [mode, cli, folder] = process.argv.slice(2);
if (!['backup', 'rehearse', 'apply', 'verify'].includes(mode) || !cli || !folder)
  throw new Error('Usage: deploy-affiliation-payment-evidence.mjs backup|rehearse|apply|verify CLI workspace/backups/private-folder');
const project = 'yyverzuhkdonjjuficor', version = '20260906235254';
const file = `supabase/migrations/${version}_affiliation_payment_evidence_and_paid_generation.sql`;
assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), project);
const target = path.resolve(folder);
assert.ok(target.startsWith(path.resolve('backups') + path.sep), 'Private backup must stay inside workspace/backups');
mkdirSync(target, { recursive: true });
const normalize = sql => sql.replace(/\r\n?/g, '\n');
const digest = sql => createHash('sha256').update(normalize(sql)).digest('hex');
const sql = normalize(readFileSync(file, 'utf8')), checksum = digest(sql);
const catalogue = JSON.parse(readFileSync('supabase/migrations.catalogue.json', 'utf8'));
assert.equal(catalogue.files.find(f => f.path === file)?.sha256, checksum, 'Reviewed catalogue checksum required');
assert.equal((sql.match(/^BEGIN;$/gm) || []).length, 1);
assert.equal((sql.match(/^COMMIT;$/gm) || []).length, 1);
const body = sql.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, '');
const source = { project, version, checksum };
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const tables = ['snp_artisans_miniers', 'snp_cartes_professionnelles', 'snp_adhesion_baremes', 'snp_adhesion_droits', 'snp_adhesion_encaissements', 'snp_artisan_ventes_or', 'snp_artisan_paiements', 'snp_workflow_audit'];
const schemaTables = [...tables, 'snp_adhesion_preuves'];
const functions = ['snp_adhesion_preuve_allowed', 'snp_affiliation_require_paid', 'snp_enregistrer_adhesion_encaissement', 'snp_claim_affiliation_render', 'snp_complete_affiliation_render', 'snp_affiliation_card_json', 'snp_preparer_carte_affiliation'];
function query(text, label) {
  const filename = path.join(target, label + '.sql');
  writeFileSync(filename, text, { mode: 0o600 });
  try {
    const output = execFileSync(cli, ['db', 'query', '--linked', '--file', filename, '-o', 'json'], {
      encoding: 'utf8', timeout: 120000, maxBuffer: 40 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const rows = JSON.parse(output.slice(output.indexOf('{'))).rows;
    writeFileSync(path.join(target, label + '.json'), JSON.stringify(rows, null, 2), { mode: 0o600 });
    return rows;
  } catch (error) {
    writeFileSync(path.join(target, label + '.error.log'), String(error.stderr || error.message), { mode: 0o600 });
    throw new Error(`${label} failed. Inspect the private log and database state before retrying.`);
  }
}
const schemaSql = `SELECT jsonb_build_object(
 'recorded',EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=${quote(version)}),
 'proof_table',to_regclass('public.snp_adhesion_preuves') IS NOT NULL,
 'columns',(SELECT jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',udt_name,'default',column_default,'nullable',is_nullable) ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name IN(${schemaTables.map(quote)})),
 'functions',(SELECT coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'acl',p.proacl) ORDER BY p.oid::regprocedure::text),'[]') FROM pg_proc p WHERE pronamespace='public'::regnamespace AND prokind='f' AND proname IN(${functions.map(quote)})),
 'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname),'[]') FROM pg_policies p WHERE schemaname='storage' OR schemaname='public' AND tablename IN(${schemaTables.map(quote)})),
 'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid)) ORDER BY conrelid::regclass::text,conname),'[]') FROM pg_constraint WHERE conrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN(${schemaTables.map(quote)}))),
 'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',tgrelid::regclass::text,'name',tgname,'enabled',tgenabled,'definition',pg_get_triggerdef(oid)) ORDER BY tgrelid::regclass::text,tgname),'[]') FROM pg_trigger WHERE tgrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN(${schemaTables.map(quote)})) AND NOT tgisinternal),
 'bucket',(SELECT to_jsonb(b) FROM storage.buckets b WHERE id='affiliation-payment-proofs')
) snapshot;`;
const fingerprintSql = columns => tables.map(table => {
  const names = columns.filter(c => c.table === table).map(c => c.column);
  assert.ok(names.length > 0, 'Missing business table: ' + table);
  const row = `(SELECT jsonb_object_agg(k,v) FROM jsonb_each(to_jsonb(t)) e(k,v) WHERE k=ANY(ARRAY[${names.map(quote)}]))`;
  return `SELECT ${quote(table)} AS table_name,count(*) AS row_count,md5(coalesce(string_agg((${row})::text,'|' ORDER BY (${row})::text),'')) AS fingerprint FROM public.${table} t`;
}).join('\nUNION ALL\n');
const historySql = `SELECT version,statements FROM supabase_migrations.schema_migrations WHERE version=${quote(version)};`;
const checksSql = `SELECT
 EXISTS(SELECT 1 FROM pg_class WHERE oid='public.snp_adhesion_preuves'::regclass AND relrowsecurity) AS proofs_rls,
 (SELECT count(*)=3 FROM information_schema.columns WHERE table_schema='public' AND table_name='snp_adhesion_encaissements' AND column_name IN('annee_adhesion','lieu_paiement','preuve_path')) AS receipt_fields,
 EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.snp_adhesion_encaissements'::regclass AND conname='adhesion_receipt_evidence_complete' AND contype='c') AS evidence_constraint,
 NOT has_table_privilege('authenticated','public.snp_adhesion_preuves','INSERT') AS browser_proof_write_denied,
 NOT has_table_privilege('authenticated','public.snp_adhesion_encaissements','INSERT') AS browser_receipt_write_denied,
 NOT has_function_privilege('anon','public.snp_adhesion_preuve_allowed(uuid)','EXECUTE') AS anonymous_proof_denied,
 NOT has_function_privilege('anon','public.snp_enregistrer_adhesion_encaissement(uuid,uuid,numeric,text,text,date,integer,text,text)','EXECUTE') AS anonymous_receipt_denied,
 has_function_privilege('authenticated','public.snp_enregistrer_adhesion_encaissement(uuid,uuid,numeric,text,text,date,integer,text,text)','EXECUTE') AS receipt_rpc_available,
 NOT has_function_privilege('authenticated','public.snp_complete_affiliation_render(uuid,uuid,integer,jsonb)','EXECUTE') AS completion_worker_only,
 NOT has_function_privilege('authenticated','public.snp_affiliation_require_paid(public.snp_cartes_professionnelles)','EXECUTE') AS internal_paid_guard_private,
 position('snp_affiliation_require_paid' IN pg_get_functiondef('public.snp_claim_affiliation_render(uuid)'::regprocedure))>0 AS claim_payment_guard,
 position('snp_affiliation_require_paid' IN pg_get_functiondef('public.snp_complete_affiliation_render(uuid,uuid,integer,jsonb)'::regprocedure))>0 AS completion_payment_guard,
 position('permissions.can_finance' IN pg_get_functiondef('public.snp_affiliation_card_json(public.snp_cartes_professionnelles)'::regprocedure))>0 AS financial_visibility_guard,
 EXISTS(SELECT 1 FROM storage.buckets WHERE id='affiliation-payment-proofs' AND NOT public AND file_size_limit=5242880 AND allowed_mime_types @> ARRAY['application/pdf','image/jpeg','image/png']) AS private_proof_bucket,
 (SELECT count(*)=6 FROM pg_policies WHERE schemaname='storage' AND policyname IN('adhesion_proofs_download','adhesion_proofs_download_boundary','adhesion_proofs_insert_boundary','adhesion_proofs_update_boundary','adhesion_proofs_delete_boundary','adhesion_proofs_anon_boundary')) AS storage_boundaries;`;
function verify() {
  const history = query(historySql, 'migration-history');
  assert.equal(history.length, 1, 'Exact migration history entry required');
  assert.equal(history[0].statements?.length, 1, 'Unexpected migration statement history');
  assert.equal(digest(history[0].statements[0]), checksum, 'Recorded migration checksum differs');
  const result = query(checksSql, 'verification')[0];
  for (const [key, value] of Object.entries(result)) assert.equal(value, true, key);
  return result;
}
if (mode === 'backup') {
  assert.ok(!existsSync(path.join(target, 'baseline.json')), 'Baseline already exists; use a new private folder');
  const before = query(schemaSql, 'baseline')[0].snapshot;
  assert.equal(before.recorded, false); assert.equal(before.proof_table, false); assert.equal(before.bucket, null);
  const rows = query(fingerprintSql(before.columns), 'business-baseline');
  writeFileSync(path.join(target, 'source.json'), JSON.stringify(source), { mode: 0o600 });
  console.log(JSON.stringify({ mode, ...source, businessTables: rows.map(({ table_name, row_count }) => ({ table_name, row_count })), recordsExported: false }));
} else if (mode === 'verify') {
  console.log(JSON.stringify({ mode, ...source, checks: verify() }));
} else {
  const recorded = query(historySql, 'existing-history');
  if (mode === 'apply' && recorded.length) {
    console.log(JSON.stringify({ mode, ...source, alreadyApplied: true, checks: verify() }));
    process.exit(0);
  }
  assert.equal(recorded.length, 0, 'Migration already present; rehearse in a fresh isolated environment');
  assert.deepEqual(JSON.parse(readFileSync(path.join(target, 'source.json'), 'utf8')), source);
  const before = JSON.parse(readFileSync(path.join(target, 'baseline.json'), 'utf8'))[0].snapshot;
  assert.deepEqual(query(schemaSql, 'before-' + mode)[0].snapshot, before, 'Relevant schema changed since backup');
  if (mode === 'apply') {
    const rehearsal = JSON.parse(readFileSync(path.join(target, 'rehearsal-receipt.json'), 'utf8'));
    assert.deepEqual(rehearsal.source, source); assert.equal(rehearsal.rollbackVerified, true);
  }
  const fingerprints = fingerprintSql(before.columns);
  const batch = `BEGIN ISOLATION LEVEL REPEATABLE READ;
 SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='90s';
 SELECT pg_advisory_xact_lock(${version});
 DO $guard$ BEGIN
  IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=${quote(version)}) THEN RAISE EXCEPTION 'Migration already applied'; END IF;
  IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260906134228') THEN RAISE EXCEPTION 'Affiliation workflow prerequisite missing'; END IF;
 END $guard$;
 CREATE TEMP TABLE business_before ON COMMIT DROP AS ${fingerprints};
 ${body}
 SET CONSTRAINTS ALL IMMEDIATE;
 CREATE TEMP TABLE business_after ON COMMIT DROP AS ${fingerprints};
 CREATE TEMP TABLE deployment_checks ON COMMIT DROP AS ${checksSql}
 DO $checks$ BEGIN
  IF EXISTS(SELECT * FROM business_before EXCEPT SELECT * FROM business_after) OR EXISTS(SELECT * FROM business_after EXCEPT SELECT * FROM business_before) THEN RAISE EXCEPTION 'Existing business records changed'; END IF;
  IF EXISTS(SELECT 1 FROM public.snp_adhesion_preuves) THEN RAISE EXCEPTION 'Unexpected payment proof data'; END IF;
  IF EXISTS(SELECT 1 FROM deployment_checks c,jsonb_each(to_jsonb(c)) e WHERE e.value IS DISTINCT FROM 'true'::jsonb) THEN RAISE EXCEPTION 'Deployment contract failed'; END IF;
 END $checks$;
 ${mode === 'apply' ? `INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES(${quote(version)},'affiliation_payment_evidence_and_paid_generation',ARRAY[${quote(sql)}]); COMMIT;` : 'ROLLBACK;'}
 SELECT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=${quote(version)}) AS recorded;`;
  const result = query(batch, mode)[0];
  assert.equal(result.recorded, mode === 'apply');
  if (mode === 'rehearse') {
    assert.deepEqual(query(schemaSql, 'after-rehearsal')[0].snapshot, before, 'Schema rollback mismatch');
    // Repeatable-read fingerprints prove that the transaction changed no existing data;
    // fresh fingerprints are retained separately because live business work can continue.
    query(fingerprints, 'business-after-rehearsal');
  } else verify();
  const receipt = { source, mode, at: new Date().toISOString(), rollbackVerified: mode === 'rehearse', unchangedBusinessTables: tables.length, result };
  writeFileSync(path.join(target, mode === 'rehearse' ? 'rehearsal-receipt.json' : 'apply-receipt.json'), JSON.stringify(receipt, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(receipt));
}
