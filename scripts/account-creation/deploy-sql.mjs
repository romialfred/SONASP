// Only the three explicitly approved IAM migrations. No repair/reset, no accounts.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [mode, cli] = process.argv.slice(2);
if (!['rehearse', 'apply'].includes(mode) || !cli) throw new Error('Usage: deploy-sql.mjs rehearse|apply CLI');
const project = readFileSync(path.join(root, 'supabase/.temp/project-ref'), 'utf8').trim();
if (project !== 'yyverzuhkdonjjuficor') throw new Error('Unexpected linked project');
const folder = mkdtempSync(path.join(tmpdir(), `sonasp-creation-${mode}-`));
const quote = (s) => `'${String(s).replaceAll("'", "''")}'`;
const digest = (s) => createHash('sha256').update(s.replace(/\r\n?/g, '\n')).digest('hex');
const catalogue = JSON.parse(readFileSync(path.join(root, 'supabase/migrations.catalogue.json'), 'utf8'));
const migrations = [
  '20260830103000_securiser_administration_owner_et_profils.sql',
  '20260830111500_raccorder_habilitations_financieres_comptoir.sql',
  '20260830160000_habilitations_administrateur_configurables.sql',
].map((name) => {
  const file = `supabase/migrations/${name}`;
  const sql = readFileSync(path.join(root, file), 'utf8');
  const checksum = digest(sql);
  if (catalogue.files.find((f) => f.path === file)?.sha256 !== checksum) throw new Error(`Checksum differs: ${name}`);
  if (!/^BEGIN;\s*$/m.test(sql) || !/COMMIT;\s*$/.test(sql)) throw new Error('Unexpected transaction');
  return { name, version: name.slice(0, 14), sql, checksum,
    body: sql.replace(/^BEGIN;\s*$/m, '').replace(/COMMIT;\s*$/, '') };
});
const versions = migrations.map((m) => quote(m.version)).join(',');
const catalogs = ['snp_role_capabilities','snp_role_module_ceilings','snp_access_role_policies',
  'snp_capability_catalog','snp_responsibility_catalog','snp_role_responsibility_ceiling','snp_responsibility_conflicts'];
const aclTables = [...catalogs, 'user_profiles','user_permissions','snp_user_capabilities',
  'snp_user_responsibilities','snp_user_organization_memberships','snp_collector_accounts'];
const functions = [...new Set(migrations.flatMap((m) => [...m.sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)/g)].map((match) => match[1])))];
functions.push('snp_user_permission_allowed','snp_configurer_compte_portail','snp_assign_user_organization','snp_link_collector_account');
const names = [...new Set(functions)].map(quote).join(',');
function query(sql, label) {
  const file = path.join(folder, `${label}.sql`);
  writeFileSync(file, sql, { mode: 0o600 });
  try {
    const raw = execFileSync(cli, ['db','query','--linked','--file',file,'-o','json'], {
      cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 20 * 1024 * 1024,
      stdio: ['ignore','pipe','pipe'],
    });
    const result = JSON.parse(raw.slice(raw.indexOf('{')));
    if (!Array.isArray(result.rows)) throw new Error('Unexpected query result');
    writeFileSync(path.join(folder, `${label}.json`), JSON.stringify(result.rows, null, 2), { mode: 0o600 });
    return result.rows;
  } catch (error) {
    writeFileSync(path.join(folder, `${label}.error.txt`), String(error.stderr || error.message), { mode: 0o600 });
    throw new Error(`${label} failed; inspect ${folder}. If apply: verify migration history before retrying.`);
  }
}
const snapshotSql = `SELECT jsonb_build_object(
 'checked_at',now(),
 'versions',(SELECT coalesce(jsonb_agg(version ORDER BY version),'[]') FROM supabase_migrations.schema_migrations WHERE version IN (${versions})),
 'owner_active',EXISTS(SELECT 1 FROM public.user_profiles WHERE email='romuald.tiegnan@gmail.com' AND role='owner' AND is_active),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'hash',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text) ORDER BY p.oid::regprocedure::text)
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN(${names})),
 'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]') FROM pg_policies p WHERE schemaname='public' AND tablename IN('user_profiles','user_permissions')),
 'table_acls',(SELECT jsonb_agg(jsonb_build_object('relation',c.relname,'acl',c.relacl::text)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN(${aclTables.map(quote)})),
 'column_acls',(SELECT coalesce(jsonb_agg(jsonb_build_object('column',attname,'acl',attacl::text)),'[]') FROM pg_attribute WHERE attrelid='public.user_profiles'::regclass AND attnum>0 AND NOT attisdropped),
 'role_constraint',(SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.user_profiles'::regclass AND conname='user_profiles_role_check'),
 'columns',(SELECT jsonb_agg(to_jsonb(c)) FROM information_schema.columns c WHERE table_schema='public' AND table_name='snp_responsibility_catalog'),
 'catalogs',jsonb_build_object(${catalogs.map((t) => `${quote(t)},(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY to_jsonb(c)::text),'[]') FROM public.${t} c)`).join(',')})
) snapshot;`;
const before = query(snapshotSql, 'before')[0].snapshot;
if (!before.owner_active || before.versions.length) throw new Error('Owner inactive or one of the migrations already applied: stop and review.');
console.log(JSON.stringify({ phase: 'backup-complete', mode, folder, migrations: migrations.map(({ name, checksum }) => ({ name, checksum })) }));

const guard = `DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version IN (${versions})) THEN RAISE EXCEPTION 'Migration already recorded'; END IF;
 ${before.functions.map((f) => `IF md5(pg_get_functiondef(${quote(f.signature)}::regprocedure)) IS DISTINCT FROM ${quote(f.hash)} THEN RAISE EXCEPTION 'Concurrent schema change'; END IF;`).join('\n')}
END $guard$;`;
const fingerprintFn = `CREATE FUNCTION pg_temp.creation_fingerprints() RETURNS TABLE(relation text,row_count bigint,checksum text)
LANGUAGE plpgsql AS $fp$ DECLARE item record; BEGIN
 FOR item IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN('r','p') AND c.relname NOT IN(${catalogs.map(quote)}) ORDER BY c.relname
 LOOP RETURN QUERY EXECUTE format('SELECT %L::text,count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'''' ORDER BY md5(to_jsonb(t)::text)),'''')) FROM public.%I t',item.relname,item.relname); END LOOP;
END $fp$;`;
const checks = `DO $check$ BEGIN
 IF EXISTS(SELECT * FROM creation_before EXCEPT SELECT * FROM creation_after)
  OR EXISTS(SELECT * FROM creation_after EXCEPT SELECT * FROM creation_before) THEN RAISE EXCEPTION 'Business/account data changed'; END IF;
 IF (SELECT count(*) FROM public.snp_role_module_ceilings WHERE role='admin' AND can_view AND can_create AND can_edit AND can_delete AND can_approve)<>18 THEN RAISE EXCEPTION 'Admin ceiling incomplete'; END IF;
 IF (SELECT count(*) FROM public.snp_role_responsibility_ceiling WHERE role='comptoir' AND responsibility_code IN('comptoir.invoices.issue','comptoir.payments.execute','comptoir.payments.reconcile','comptoir.tax.execute'))<>4 THEN RAISE EXCEPTION 'Responsibility catalog incomplete'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.snp_access_role_policies WHERE role='owner' AND NOT is_legacy) THEN RAISE EXCEPTION 'Owner role unavailable'; END IF;
 IF has_table_privilege('authenticated','public.user_permissions','UPDATE') OR has_column_privilege('authenticated','public.user_profiles','role','UPDATE') THEN RAISE EXCEPTION 'Direct privilege escalation remains open'; END IF;
 IF position('p_role IN(''owner''' IN pg_get_functiondef('public.snp_configurer_acces_compte(uuid,text,text,text,boolean,uuid,uuid,uuid,jsonb,jsonb)'::regprocedure))=0 THEN RAISE EXCEPTION 'Owner configuration missing'; END IF;
END $check$;`;
const statements = [
 "BEGIN ISOLATION LEVEL REPEATABLE READ; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s';",
 "SELECT pg_advisory_xact_lock(hashtextextended('sonasp-account-creation-deployment',0));",
 guard, fingerprintFn, 'CREATE TEMP TABLE creation_before ON COMMIT DROP AS SELECT * FROM pg_temp.creation_fingerprints();',
 ...migrations.map((m) => m.body),
 'CREATE TEMP TABLE creation_after ON COMMIT DROP AS SELECT * FROM pg_temp.creation_fingerprints();', checks,
 ...(mode === 'apply' ? migrations.map((m) => `INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES(${quote(m.version)},${quote(m.name.slice(15,-4))},ARRAY[${quote(m.sql)}]);`) : []),
 `SELECT jsonb_build_object('mode',${quote(mode)},'tables_unchanged',(SELECT count(*) FROM creation_before),'accounts_and_business_unchanged',true,'checks_passed',true) validation;`,
 mode === 'apply' ? 'COMMIT;' : 'ROLLBACK;',
];
const result = query(statements.join('\n'), mode);
const after = query(snapshotSql, 'after')[0].snapshot;
if (after.versions.length !== (mode === 'apply' ? 3 : 0) || !after.owner_active) throw new Error('Postflight failed: inspect history before any retry');
if (mode === 'rehearse' && JSON.stringify({ ...before, checked_at: null }) !== JSON.stringify({ ...after, checked_at: null })) {
  // PostgreSQL may reorder JSON aggregates without ORDER BY. Compare substantive
  // function versions and catalog values instead of assuming output row order.
  if (JSON.stringify(before.functions) !== JSON.stringify(after.functions) || JSON.stringify(before.catalogs) !== JSON.stringify(after.catalogs)) throw new Error('Rollback verification failed');
}
const receipt = { project, mode, checkedAt: after.checked_at, folder, versions: after.versions,
  migrations: migrations.map(({ name, checksum }) => ({ name, checksum })), result,
  functionHashes: after.functions.map(({ signature, hash }) => ({ signature, hash })) };
writeFileSync(path.join(folder, 'receipt.json'), JSON.stringify(receipt,null,2), { mode: 0o600 });
console.log(JSON.stringify({ completed: mode, folder, versions: after.versions, result }));
