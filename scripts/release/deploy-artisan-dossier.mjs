// Apply only the reviewed dossier migration; never repair or replay the historical migration chain.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [mode, cli, folder] = process.argv.slice(2);
if (!['backup', 'rehearse', 'apply', 'verify'].includes(mode) || !cli || !folder) throw new Error('Usage: deploy-artisan-dossier.mjs backup|rehearse|apply|verify CLI private-folder');
const project = 'yyverzuhkdonjjuficor';
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== project) throw new Error('Unexpected project');
mkdirSync(folder, { recursive: true });
const file = 'supabase/migrations/20260906111030_refonte_dossier_artisan.sql';
const sql = readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
const checksum = createHash('sha256').update(sql).digest('hex');
const catalogue = JSON.parse(readFileSync('supabase/migrations.catalogue.json', 'utf8'));
if (catalogue.files.find(item => item.path === file)?.sha256 !== checksum) throw new Error('Migration checksum mismatch');
const version = '20260906111030';
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const tables = ['snp_artisans_miniers', 'snp_artisan_documents', 'snp_artisan_ventes_or', 'snp_artisan_paiements', 'snp_artisan_moyens_paiement', 'artisanal_sites', 'artisanal_site_assignments', 'user_profiles', 'user_permissions', 'mining_companies', 'snp_organizations'];
const added = {
  snp_artisans_miniers: ['dossier_version', 'numero_ifu', 'whatsapp', 'whatsapp_identique', 'siege_pays', 'siege_region', 'siege_commune', 'siege_adresse', 'exploitant_id', 'creation_fingerprint'],
  snp_artisan_documents: ['owner_kind', 'responsable_id', 'titre', 'storage_bucket', 'sha256', 'deleted_at'],
};
function query(statement, label) {
  const target = path.join(folder, label + '.sql');
  writeFileSync(target, statement, { mode: 0o600 });
  try {
    const raw = execFileSync(cli, ['db', 'query', '--linked', '--file', target, '-o', 'json'], { encoding: 'utf8', timeout: 120000, maxBuffer: 30 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    const result = JSON.parse(raw.slice(raw.indexOf('{'))).rows;
    writeFileSync(path.join(folder, label + '.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
    return result;
  } catch (error) {
    writeFileSync(path.join(folder, label + '.error.log'), String(error.stderr || error.message), { mode: 0o600 });
    throw new Error(label + ' failed; inspect the private log before retrying.');
  }
}
const fingerprints = tables.map(table => {
  const row = `to_jsonb(t)${added[table] ? '-ARRAY[' + added[table].map(quote).join(',') + ']' : ''}`;
  return `SELECT ${quote(table)} table_name,count(*) row_count,md5(coalesce(string_agg((${row})::text,'|' ORDER BY (${row})::text),'')) fingerprint FROM public.${table} t`;
}).join('\nUNION ALL\n');
const baseline = `SELECT jsonb_build_object(
 'rows',(SELECT jsonb_agg(to_jsonb(f) ORDER BY table_name) FROM (${fingerprints}) f),
 'columns',(SELECT jsonb_agg(to_jsonb(c) ORDER BY table_name,ordinal_position) FROM information_schema.columns c WHERE table_schema='public' AND table_name IN (${tables.map(quote)})),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid)) ORDER BY conrelid::regclass::text,conname) FROM pg_constraint WHERE connamespace='public'::regnamespace),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'acl',p.proacl) ORDER BY p.oid::regprocedure::text) FROM pg_proc p WHERE pronamespace='public'::regnamespace AND prokind='f' AND proname LIKE 'snp_%artisan%'),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname) FROM pg_policies p WHERE schemaname IN ('public','storage')),
 'installed',EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=${quote(version)}),
 'responsible_table',to_regclass('public.snp_artisan_responsables')::text
) baseline;`;
const verification = `SELECT
 EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=${quote(version)}) migration_recorded,
 to_regprocedure('public.snp_save_artisan_dossier(uuid,uuid,timestamptz,jsonb,boolean)') IS NOT NULL save_rpc,
 NOT has_function_privilege('anon','public.snp_save_artisan_dossier(uuid,uuid,timestamptz,jsonb,boolean)','EXECUTE') anon_save_denied,
 NOT has_function_privilege('authenticated','public.snp_delete_artisan_document_gateway(uuid,uuid)','EXECUTE') direct_delete_denied,
 EXISTS(SELECT 1 FROM storage.buckets WHERE id='artisan-dossiers' AND NOT public AND file_size_limit=5242880) private_documents,
 (SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.snp_artisan_responsables'::regclass,'public.snp_artisan_dossier_audit'::regclass,'public.snp_artisan_vente_site_origins'::regclass)) rls_enabled,
 (SELECT count(*) FROM public.snp_artisans_miniers) artisans,
 (SELECT count(*) FROM public.snp_artisan_ventes_or) sales,
 (SELECT count(*) FROM public.snp_artisan_vente_site_origins) sale_origins;`;
if (mode === 'backup') {
  if (existsSync(path.join(folder, 'baseline.json'))) throw new Error('Backup already exists');
  const before = query(baseline, 'baseline')[0].baseline;
  if (before.installed || before.responsible_table) throw new Error('Migration already present or schema differs');
  console.log(JSON.stringify({ project, mode, checksum, tables: before.rows.length, schemaSaved: true, recordsExported: false }));
} else if (mode === 'verify') {
  const result = query(verification, 'verification')[0];
  for (const [key, value] of Object.entries(result)) if (!['artisans', 'sales', 'sale_origins'].includes(key) && value !== true) throw new Error('Verification failed: ' + key);
  console.log(JSON.stringify(result));
} else {
  const before = JSON.parse(readFileSync(path.join(folder, 'baseline.json'), 'utf8'))[0].baseline;
  if (mode === 'apply') {
    const receipt = JSON.parse(readFileSync(path.join(folder, 'rehearsal-receipt.json'), 'utf8'));
    if (receipt.checksum !== checksum || !receipt.rollbackVerified) throw new Error('Matching successful rehearsal required');
  }
  if ((sql.match(/^BEGIN;$/gm) || []).length !== 1 || (sql.match(/^COMMIT;$/gm) || []).length !== 1) throw new Error('Unexpected migration transaction structure');
  const body = sql.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, '');
  const payload = `BEGIN ISOLATION LEVEL REPEATABLE READ;
 SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';
 SELECT pg_advisory_xact_lock(60906111030);
 DO $guard$ BEGIN
  IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=${quote(version)}) THEN RAISE EXCEPTION 'Already applied'; END IF;
  IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260906093115') THEN RAISE EXCEPTION 'Registry migration missing'; END IF;
 END $guard$;
 CREATE TEMP TABLE business_before ON COMMIT DROP AS ${fingerprints};
 ${body}
 CREATE TEMP TABLE business_after ON COMMIT DROP AS ${fingerprints};
 DO $checks$ BEGIN
  IF EXISTS(SELECT * FROM business_before EXCEPT SELECT * FROM business_after) OR EXISTS(SELECT * FROM business_after EXCEPT SELECT * FROM business_before) THEN RAISE EXCEPTION 'Existing business data changed'; END IF;
  IF EXISTS(SELECT 1 FROM public.snp_artisans_miniers WHERE dossier_version<>0) THEN RAISE EXCEPTION 'Historical dossier reclassified'; END IF;
  IF (SELECT count(*) FROM public.snp_artisan_vente_site_origins)<>(SELECT count(*) FROM public.snp_artisan_ventes_or v JOIN public.snp_artisans_miniers a ON a.id=v.artisan_id) THEN RAISE EXCEPTION 'Sale attribution missing'; END IF;
  IF has_function_privilege('anon','public.snp_save_artisan_dossier(uuid,uuid,timestamptz,jsonb,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous save allowed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='artisan-dossiers' AND NOT public) THEN RAISE EXCEPTION 'Private bucket missing'; END IF;
 END $checks$;
 ${mode === 'apply' ? `INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES(${quote(version)},'refonte_dossier_artisan',ARRAY[${quote(sql)}]);` : ''}
 ${mode === 'apply' ? 'COMMIT;' : 'ROLLBACK;'}
 SELECT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=${quote(version)}) migration_recorded,
 to_regclass('public.snp_artisan_responsables') IS NOT NULL responsible_table;`;
  const result = query(payload, mode)[0];
  if (result.migration_recorded !== (mode === 'apply') || result.responsible_table !== (mode === 'apply')) throw new Error('Unexpected final database state');
  if (mode === 'rehearse') {
    const after = query(baseline, 'after-rehearsal')[0].baseline;
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Rollback verification failed');
    writeFileSync(path.join(folder, 'rehearsal-receipt.json'), JSON.stringify({ checksum, rollbackVerified: true, at: new Date().toISOString() }, null, 2));
  }
  const receipt = { project, mode, checksum, at: new Date().toISOString(), result, unchangedBusinessTables: tables.length };
  writeFileSync(path.join(folder, mode + '-receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
}
