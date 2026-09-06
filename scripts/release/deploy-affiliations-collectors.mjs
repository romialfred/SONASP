// Publish exactly the reviewed card/collector migrations; never repair historical versions.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const [mode, cli, folder] = process.argv.slice(2);
if (!['backup', 'rehearse', 'apply', 'verify'].includes(mode) || !cli || !folder) throw new Error('Usage: deploy-affiliations-collectors.mjs backup|rehearse|apply|verify CLI private-folder');
const project = 'yyverzuhkdonjjuficor';
assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), project);
mkdirSync(folder, { recursive: true });
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const catalogue = JSON.parse(readFileSync('supabase/migrations.catalogue.json', 'utf8'));
const migrations = ['20260906134228_affiliations_cartes_faso_sanama.sql', '20260906145430_collecteurs_comptoirs_ventes.sql'].map(name => {
  const file = 'supabase/migrations/' + name;
  const sql = readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
  const checksum = createHash('sha256').update(sql).digest('hex');
  assert.equal(catalogue.files.find(item => item.path === file)?.sha256, checksum, file);
  assert.equal((sql.match(/^BEGIN;$/gm) || []).length, 1);
  assert.equal((sql.match(/^COMMIT;$/gm) || []).length, 1);
  return { name, version: name.slice(0, 14), sql, checksum, body: sql.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, '') };
});
const checksums = migrations.map(({ name, checksum }) => ({ name, checksum }));
const versions = migrations.map(m => quote(m.version)).join(',');
const tables = ['snp_artisans_miniers', 'snp_cartes_professionnelles', 'snp_artisan_documents', 'snp_artisan_responsables', 'snp_artisan_ventes_or', 'snp_artisan_factures_definitives', 'snp_artisan_paiements', 'snp_artisan_moyens_paiement', 'artisanal_sites', 'artisanal_site_assignments', 'user_profiles', 'user_permissions', 'snp_organizations', 'snp_notifications', 'snp_notifications_livraisons'];
const newTables = ['snp_adhesion_baremes', 'snp_adhesion_droits', 'snp_adhesion_encaissements', 'snp_collectors', 'snp_collector_sites', 'snp_collector_sales'];
function query(sql, label) {
  const target = path.join(folder, label + '.sql');
  writeFileSync(target, sql, { mode: 0o600 });
  try {
    const raw = execFileSync(cli, ['db', 'query', '--linked', '--file', target, '-o', 'json'], { encoding: 'utf8', timeout: 120000, maxBuffer: 40 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    const result = JSON.parse(raw.slice(raw.indexOf('{'))).rows;
    writeFileSync(path.join(folder, label + '.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
    return result;
  } catch (e) {
    writeFileSync(path.join(folder, label + '.error.log'), String(e.stderr || e.message), { mode: 0o600 });
    throw new Error(label + ' failed; inspect the private log and migration history before retrying.');
  }
}
const schemaSql = `SELECT jsonb_build_object(
 'versions',(SELECT coalesce(jsonb_agg(version ORDER BY version),'[]') FROM supabase_migrations.schema_migrations WHERE version IN(${versions})),
 'columns',(SELECT jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',udt_name,'default',column_default,'nullable',is_nullable) ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name IN(${tables.map(quote)})),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'acl',p.proacl) ORDER BY p.oid::regprocedure::text) FROM pg_proc p WHERE pronamespace='public'::regnamespace AND prokind='f'),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname) FROM pg_policies p WHERE schemaname IN ('public','storage')),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('table',tgrelid::regclass::text,'name',tgname,'enabled',tgenabled,'definition',pg_get_triggerdef(oid)) ORDER BY tgrelid::regclass::text,tgname) FROM pg_trigger WHERE tgrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace) AND NOT tgisinternal),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid)) ORDER BY conrelid::regclass::text,conname) FROM pg_constraint WHERE connamespace='public'::regnamespace),
 'newTables',(SELECT coalesce(jsonb_agg(table_name ORDER BY table_name),'[]') FROM information_schema.tables WHERE table_schema='public' AND table_name IN(${newTables.map(quote)}))
) snapshot;`;
const fingerprints = columns => tables.map(table => {
  const names = columns.filter(c => c.table === table).map(c => c.column);
  assert.ok(names.length > 0, 'Missing table: ' + table);
  const row = `(SELECT jsonb_object_agg(k,v) FROM jsonb_each(to_jsonb(t)) e(k,v) WHERE k=ANY(ARRAY[${names.map(quote)}]))`;
  return `SELECT ${quote(table)} table_name,count(*) row_count,md5(coalesce(string_agg((${row})::text,'|' ORDER BY (${row})::text),'')) fingerprint FROM public.${table} t`;
}).join('\nUNION ALL\n');
const verifiedSql = `SELECT
 (SELECT count(*)=2 FROM supabase_migrations.schema_migrations WHERE version IN(${versions})) migrations_recorded,
 (SELECT bool_and(relrowsecurity) AND count(*)=6 FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN(${newTables.map(quote)})) rls_enabled,
 NOT has_function_privilege('anon','public.snp_save_collector(uuid,integer,jsonb)','EXECUTE') anonymous_collector_denied,
 NOT has_function_privilege('anon','public.snp_activer_carte_affiliation(uuid)','EXECUTE') anonymous_activation_denied,
 NOT has_function_privilege('authenticated','public.snp_complete_affiliation_render(uuid,uuid,integer,jsonb)','EXECUTE') render_commit_service_only,
 NOT has_function_privilege('authenticated','public.snp_claim_collection_mail(uuid)','EXECUTE') mail_claim_service_only,
 NOT has_table_privilege('authenticated','public.snp_collectors','INSERT') direct_collector_write_denied,
 NOT has_table_privilege('authenticated','public.snp_adhesion_encaissements','INSERT') direct_receipt_write_denied,
 EXISTS(SELECT 1 FROM storage.buckets WHERE id='affiliation-cards' AND NOT public) private_cards,
 EXISTS(SELECT 1 FROM public.user_profiles WHERE role='owner' AND is_active) owner_active,
 to_regprocedure('public.snp_list_collectors()') IS NOT NULL collector_rpc,
 to_regprocedure('public.snp_collector_sales()') IS NOT NULL sales_rpc;`;
if (mode === 'backup') {
  if (existsSync(path.join(folder, 'baseline.json'))) throw new Error('Baseline already exists');
  const before = query(schemaSql, 'baseline')[0].snapshot;
  assert.equal(before.versions.length, 0); assert.equal(before.newTables.length, 0);
  const rows = query(fingerprints(before.columns), 'business-baseline');
  writeFileSync(path.join(folder, 'source-checksums.json'), JSON.stringify(checksums, null, 2));
  console.log(JSON.stringify({ mode, project, migrations: checksums, schemaSaved: true, businessTables: rows.map(({ table_name, row_count }) => ({ table_name, row_count })), recordsExported: false }));
} else if (mode === 'verify') {
  const result = query(verifiedSql, 'verification')[0];
  for (const [key, value] of Object.entries(result)) assert.equal(value, true, key);
  console.log(JSON.stringify(result));
} else {
  const before = JSON.parse(readFileSync(path.join(folder, 'baseline.json'), 'utf8'))[0].snapshot;
  assert.deepEqual(JSON.parse(readFileSync(path.join(folder, 'source-checksums.json'), 'utf8')), checksums);
  assert.deepEqual(query(schemaSql, 'before-' + mode)[0].snapshot, before, 'Schema changed since backup');
  if (mode === 'apply') {
    const rehearsal = JSON.parse(readFileSync(path.join(folder, 'rehearsal-receipt.json'), 'utf8'));
    assert.equal(rehearsal.rollbackVerified, true); assert.deepEqual(rehearsal.migrations, checksums);
  }
  const f = fingerprints(before.columns);
  const body = `BEGIN ISOLATION LEVEL REPEATABLE READ;
 SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='90s';
 SELECT pg_advisory_xact_lock(60906111030);
 DO $guard$ BEGIN
  IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version IN(${versions})) THEN RAISE EXCEPTION 'Migration already recorded'; END IF;
  IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260906111030') THEN RAISE EXCEPTION 'Artisan dossier prerequisite missing'; END IF;
 END $guard$;
 CREATE TEMP TABLE business_before ON COMMIT DROP AS ${f};
 ${migrations.map(m => m.body).join('\n')}
 SET CONSTRAINTS ALL IMMEDIATE;
 CREATE TEMP TABLE business_after ON COMMIT DROP AS ${f};
 DO $checks$ BEGIN
  IF EXISTS(SELECT * FROM business_before EXCEPT SELECT * FROM business_after) OR EXISTS(SELECT * FROM business_after EXCEPT SELECT * FROM business_before) THEN RAISE EXCEPTION 'Existing business data changed'; END IF;
  ${newTables.map(t => `IF EXISTS(SELECT 1 FROM public.${t}) THEN RAISE EXCEPTION 'Unexpected data in ${t}'; END IF;`).join('\n')}
  IF has_function_privilege('anon','public.snp_save_collector(uuid,integer,jsonb)','EXECUTE') OR has_function_privilege('anon','public.snp_activer_carte_affiliation(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous mutation permission'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='affiliation-cards' AND NOT public) THEN RAISE EXCEPTION 'Private card bucket missing'; END IF;
 END $checks$;
 ${mode === 'apply' ? migrations.map(m => `INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES(${quote(m.version)},${quote(m.name.slice(15, -4))},ARRAY[${quote(m.sql)}]);`).join('\n') : ''}
 ${mode === 'apply' ? 'COMMIT;' : 'ROLLBACK;'}
 SELECT count(*) recorded FROM supabase_migrations.schema_migrations WHERE version IN(${versions});`;
  const result = query(body, mode)[0];
  assert.equal(Number(result.recorded), mode === 'apply' ? 2 : 0);
  if (mode === 'rehearse') {
    assert.deepEqual(query(schemaSql, 'after-rehearsal')[0].snapshot, before, 'Schema rollback mismatch');
    const priorRows = JSON.parse(readFileSync(path.join(folder, 'business-baseline.json'), 'utf8'));
    assert.deepEqual(query(f, 'business-after-rehearsal'), priorRows, 'Business data changed during rehearsal');
  }
  const receipt = { project, mode, at: new Date().toISOString(), migrations: checksums, unchangedBusinessTables: tables.length, rollbackVerified: mode === 'rehearse', result };
  writeFileSync(path.join(folder, mode === 'rehearse' ? 'rehearsal-receipt.json' : 'apply-receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
}
