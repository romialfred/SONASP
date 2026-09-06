// Scoped deployment of the reviewed artisanal registry migration, with an atomic history entry.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [mode, cli, folder] = process.argv.slice(2);
if (!['backup', 'rehearse', 'apply', 'verify'].includes(mode) || !cli || !folder) throw new Error('Usage: deploy-artisanal-sites.mjs backup|rehearse|apply|verify CLI audit-folder');
const project = 'yyverzuhkdonjjuficor';
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== project) throw new Error('Unexpected project');
mkdirSync(folder, { recursive: true });
const file = 'supabase/migrations/20260906093115_sites_artisanaux_formalisation_aea.sql';
const sql = readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
const checksum = createHash('sha256').update(sql).digest('hex');
const catalogue = JSON.parse(readFileSync('supabase/migrations.catalogue.json', 'utf8'));
if (catalogue.files.find(item => item.path === file)?.sha256 !== checksum) throw new Error('Migration checksum mismatch');
const version = '20260906093115';
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
function query(statement, label) {
  const target = path.join(folder, label + '.sql');
  writeFileSync(target, statement, { mode: 0o600 });
  try {
    const raw = execFileSync(cli, ['db', 'query', '--linked', '--file', target, '-o', 'json'], { encoding: 'utf8', timeout: 120000, maxBuffer: 20 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    const result = JSON.parse(raw.slice(raw.indexOf('{'))).rows;
    writeFileSync(path.join(folder, label + '.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
    return result;
  } catch (error) {
    writeFileSync(path.join(folder, label + '.error.log'), String(error.stderr || error.message), { mode: 0o600 });
    throw new Error(label + ' failed; inspect the private log and current state before retrying.');
  }
}
const tableNames = ['artisanal_sites', 'artisanal_site_assignments', 'mining_companies', 'snp_artisans_miniers', 'snp_organizations', 'mining_company_documents', 'stakeholder_bank_accounts', 'snp_artisan_ventes_or', 'snp_artisan_documents', 'snp_navigation_groups', 'snp_modules'];
const functions = ['snp_peut_gerer_sites_artisanaux', 'snp_check_artisanal_site_aea', 'snp_save_artisanal_site', 'snp_guard_comptoir_registry_creation', 'snp_save_organization'];
const baselineSql = `SELECT jsonb_build_object(
 'sites', (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY id),'[]') FROM public.artisanal_sites s),
 'assignments', (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]') FROM public.artisanal_site_assignments a),
 'navigation', (SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY code),'[]') FROM public.snp_navigation_groups n WHERE code='semi-mecanise'),
 'modules', (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY code),'[]') FROM public.snp_modules m WHERE code='mining_sites'),
 'bucket', (SELECT coalesce(jsonb_agg(to_jsonb(b)),'[]') FROM storage.buckets b WHERE id='artisanal-site-aea'),
 'functions', (SELECT coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'acl',p.proacl) ORDER BY p.oid::regprocedure::text),'[]') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN (${functions.map(quote)})),
 'policies', (SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname) FROM pg_policies p WHERE (schemaname='public' AND tablename IN (${tableNames.map(quote)})) OR (schemaname='storage' AND tablename='objects')),
 'triggers', (SELECT jsonb_agg(jsonb_build_object('table',tgrelid::regclass::text,'definition',pg_get_triggerdef(oid)) ORDER BY tgrelid::regclass::text,tgname) FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN ('public.artisanal_sites'::regclass,'public.snp_organizations'::regclass)),
 'columns', (SELECT jsonb_agg(to_jsonb(c) ORDER BY table_name,ordinal_position) FROM information_schema.columns c WHERE table_schema='public' AND table_name IN (${tableNames.map(quote)})),
 'constraints', (SELECT jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid)) ORDER BY conrelid::regclass::text,conname) FROM pg_constraint WHERE conrelid IN ('public.artisanal_sites'::regclass,'public.snp_organizations'::regclass)),
 'history', (SELECT coalesce(jsonb_agg(to_jsonb(h)),'[]') FROM supabase_migrations.schema_migrations h WHERE version=${quote(version)})
) backup;`;

if (mode === 'backup') {
  if (existsSync(path.join(folder, 'database-before.json'))) throw new Error('Backup already exists; refusing to overwrite');
  const data = query(baselineSql, 'database-before')[0].backup;
  if (data.history.length || data.columns.some(c => c.table_name === 'artisanal_sites' && c.column_name === 'formalization')) throw new Error('Migration already present or schema differs; inspect before continuing');
  console.log(JSON.stringify({ backedUp: true, project, sites: data.sites.length, functions: data.functions.length, policies: data.policies.length, folder }));
} else if (mode === 'verify') {
  const result = query(`SELECT
    EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=${quote(version)}) AS migration_recorded,
    to_regprocedure('public.snp_save_artisanal_site(jsonb,jsonb)') IS NOT NULL AS save_rpc,
    EXISTS(SELECT 1 FROM storage.buckets WHERE id='artisanal-site-aea' AND NOT public AND file_size_limit=10485760) AS private_aea_bucket,
    NOT EXISTS(SELECT 1 FROM public.artisanal_sites WHERE exploitation_type<>'artisanale') AS artisanal_type,
    NOT has_function_privilege('anon','public.snp_save_artisanal_site(jsonb,jsonb)','EXECUTE') AS anon_denied,
    (SELECT count(*) FROM public.artisanal_sites) AS site_count;`, 'database-verification');
  if (Object.entries(result[0]).some(([key, value]) => key !== 'site_count' && value !== true)) throw new Error('Post-deployment verification failed');
  console.log(JSON.stringify(result));
} else {
  const backup = JSON.parse(readFileSync(path.join(folder, 'database-before.json'), 'utf8'))[0].backup;
  if (mode === 'apply') {
    const rehearsal = JSON.parse(readFileSync(path.join(folder, 'rehearsal-receipt.json'), 'utf8'));
    if (rehearsal.checksum !== checksum || !rehearsal.rollbackVerified) throw new Error('A matching successful rehearsal is required');
  }
  if ((sql.match(/^BEGIN;$/gm) || []).length !== 1 || (sql.match(/^COMMIT;$/gm) || []).length !== 1) throw new Error('Unexpected migration transaction structure');
  const body = sql.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, '');
  const unaffected = ['user_profiles', 'artisanal_site_assignments', 'mining_companies', 'snp_artisans_miniers', 'snp_organizations', 'mining_company_documents', 'stakeholder_bank_accounts', 'snp_artisan_ventes_or', 'snp_artisan_documents', 'user_permissions'];
  const fingerprints = unaffected.map(table => `SELECT ${quote(table)} AS table_name, md5(coalesce(string_agg(to_jsonb(t)::text,'|' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM public.${table} t`).join('\nUNION ALL\n');
  const payload = `BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='45s';
SELECT pg_advisory_xact_lock(hashtextextended('sonasp-artisanal-sites-deployment',0));
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=${quote(version)}) THEN RAISE EXCEPTION 'Migration already applied'; END IF;
END $guard$;
CREATE TEMP TABLE sites_before ON COMMIT DROP AS SELECT id,to_jsonb(s) AS data FROM public.artisanal_sites s;
CREATE TEMP TABLE unchanged_before ON COMMIT DROP AS ${fingerprints};
${body}
CREATE TEMP TABLE unchanged_after ON COMMIT DROP AS ${fingerprints};
DO $checks$ BEGIN
 IF EXISTS(SELECT * FROM unchanged_before EXCEPT SELECT * FROM unchanged_after) OR EXISTS(SELECT * FROM unchanged_after EXCEPT SELECT * FROM unchanged_before) THEN RAISE EXCEPTION 'Unrelated business/account data changed'; END IF;
 IF EXISTS(SELECT 1 FROM sites_before b FULL JOIN public.artisanal_sites s ON s.id=b.id
   WHERE b.id IS NULL OR s.id IS NULL OR
   (to_jsonb(s)-ARRAY['formalization','aea_number','aea_issued_on','aea_duration_months','aea_document_path','aea_document_name','legacy_exploitation_type','exploitation_type','updated_at']) IS DISTINCT FROM (b.data-ARRAY['exploitation_type','updated_at'])
   OR s.exploitation_type<>'artisanale'
   OR s.legacy_exploitation_type IS DISTINCT FROM CASE WHEN b.data->>'exploitation_type'<>'artisanale' THEN b.data->>'exploitation_type' ELSE NULL END)
 THEN RAISE EXCEPTION 'Site data changed outside the intended classification'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='artisanal-site-aea' AND NOT public AND file_size_limit=10485760) THEN RAISE EXCEPTION 'Private AEA bucket not configured'; END IF;
 IF has_function_privilege('anon','public.snp_save_artisanal_site(jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous save allowed'; END IF;
END $checks$;
${mode === 'apply' ? `INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES(${quote(version)},'sites_artisanaux_formalisation_aea',ARRAY[${quote(sql)}]);` : ''}
${mode === 'apply' ? 'COMMIT;' : 'ROLLBACK;'}
SELECT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=${quote(version)}) AS migration_recorded,
 to_regprocedure('public.snp_save_artisanal_site(jsonb,jsonb)') IS NOT NULL AS save_rpc;`;
  const result = query(payload, mode)[0];
  if (result.migration_recorded !== (mode === 'apply') || result.save_rpc !== (mode === 'apply')) throw new Error('Unexpected final database state');
  if (mode === 'rehearse') {
    const after = query(baselineSql, 'database-after-rehearsal')[0].backup;
    if (JSON.stringify(backup) !== JSON.stringify(after)) throw new Error('Rollback or baseline verification failed');
    writeFileSync(path.join(folder, 'rehearsal-receipt.json'), JSON.stringify({ checksum, rollbackVerified: true, at: new Date().toISOString() }, null, 2));
  }
  const receipt = { project, mode, checksum, at: new Date().toISOString(), result, unchangedTables: unaffected.length };
  writeFileSync(path.join(folder, mode + '-receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
}
