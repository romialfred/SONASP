#!/usr/bin/env node
// Déploiement ponctuel explicitement autorisé : deux migrations, aucun repair.
// La CLI utilise son authentification existante ; aucun secret n'est manipulé ici.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] || 'verify';
const cli = process.argv[3];
if (!['verify', 'rehearse', 'apply'].includes(mode) || !cli) {
  throw new Error('Usage : node scripts/deploy-owner-module-fix.mjs verify|rehearse|apply CHEMIN_CLI');
}
const project = readFileSync(path.join(root, 'supabase/.temp/project-ref'), 'utf8').trim();
if (project !== 'yyverzuhkdonjjuficor') throw new Error('Projet lié inattendu : arrêt.');
const work = mkdtempSync(path.join(tmpdir(), 'sonasp-owner-modules-'));
console.log(`Dossier de preuve privé : ${work}`);
const quote = (text) => `'${String(text).replaceAll("'", "''")}'`;
const digest = (text) => createHash('sha256').update(text.replace(/\r\n?/g, '\n')).digest('hex');
const files = [
  '20260829203000_separer_stock_et_reserve_nationale.sql',
  '20260830070000_acces_owner_et_audit_modules.sql',
];
const catalogue = JSON.parse(readFileSync(path.join(root, 'supabase/migrations.catalogue.json'), 'utf8'));
const migrations = files.map((name) => {
  const relative = `supabase/migrations/${name}`;
  const sql = readFileSync(path.join(root, relative), 'utf8');
  const checksum = digest(sql);
  if (catalogue.files.find((entry) => entry.path === relative)?.sha256 !== checksum) {
    throw new Error(`Checksum non validé : ${name}`);
  }
  return { name, sql, checksum, version: name.slice(0, 14) };
});
const versions = migrations.map(({ version }) => quote(version)).join(',');
const body = (sql) => {
  if (!/^BEGIN;\s*$/m.test(sql) || !/(?:COMMIT|ROLLBACK);\s*$/.test(sql)) {
    throw new Error('Délimiteurs de transaction absents : arrêt.');
  }
  return sql.replace(/^BEGIN;\s*/m, '').replace(/(?:COMMIT|ROLLBACK);\s*$/, '');
};

function query(sql, label) {
  const file = path.join(work, `${label}.sql`);
  writeFileSync(file, sql, { mode: 0o600 });
  let stdout;
  try {
    stdout = execFileSync(cli, ['db', 'query', '--linked', '--file', file, '-o', 'json'], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000,
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    // Conserver l'erreur dans le dossier local, jamais une chaîne de connexion.
    writeFileSync(path.join(work, `${label}.error.txt`), String(error.stderr || error.message), { mode: 0o600 });
    throw new Error(`${label} : erreur CLI (voir le dossier de preuve). Si apply, vérifier l’historique avant toute relance.`);
  }
  const result = JSON.parse(stdout.slice(stdout.indexOf('{')));
  if (!Array.isArray(result.rows)) throw new Error(`${label} : réponse SQL inattendue.`);
  writeFileSync(path.join(work, `${label}.json`), JSON.stringify(result.rows, null, 2), { mode: 0o600 });
  return result.rows;
}

const snapshotSql = `
SELECT jsonb_build_object(
  'checked_at',now(),
  'owner_valid',EXISTS(SELECT 1 FROM public.user_profiles
    WHERE email='romuald.tiegnan@gmail.com' AND role='owner' AND is_active),
  'applied_versions',(SELECT coalesce(jsonb_agg(version ORDER BY version),'[]')
    FROM supabase_migrations.schema_migrations WHERE version IN (${versions})),
  'modules',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY id),'[]') FROM public.modules m),
  'navigation',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY id),'[]') FROM public.snp_modules m),
  'permissions',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY user_id,module_id),'[]') FROM public.user_permissions p),
  'functions',(SELECT coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
    'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text) ORDER BY p.oid::regprocedure::text),'[]')
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN(
      'snp_permission_allowed','snp_user_permission_allowed','snp_actor_can_module_action',
      'get_user_modules','snp_grant_module_to_platform_accounts','snp_grant_modules_to_platform_account')),
  'audit_constraint',(SELECT pg_get_constraintdef(oid) FROM pg_constraint
    WHERE conrelid='public.snp_account_admin_audit'::regclass AND conname='snp_account_admin_audit_action_check'),
  'incomplete_owner_permissions',(SELECT count(*) FROM public.user_profiles u CROSS JOIN public.modules m
    WHERE u.role='owner' AND u.is_active AND NOT EXISTS(SELECT 1 FROM public.user_permissions p
      WHERE p.user_id=u.id AND p.module_id=m.id AND p.can_view AND p.can_create AND p.can_edit AND p.can_delete AND p.can_approve))
) AS snapshot;`;
const before = query(snapshotSql, 'before')[0]?.snapshot;
if (!before?.owner_valid) throw new Error('Le profil Owner attendu n’est pas actif : arrêt.');
console.log(JSON.stringify({ mode, project, migrations: migrations.map(({ name, checksum }) => ({ name, checksum })),
  appliedVersions: before.applied_versions, incompleteOwnerPermissions: before.incomplete_owner_permissions }));
if (mode === 'verify') process.exit(0);
if (before.applied_versions.length) throw new Error('Une migration ciblée est déjà enregistrée : vérifier avant toute relance.');

const businessTables = ['gold_inventory', 'inventory_transactions', 'reserve_allocations',
  'reserve_allocation_items', 'reserve_allocation_events', 'reserve_allocation_documents'];
const fingerprint = (table) => `SELECT ${quote(table)} AS relation,count(*) AS rows,
  md5(coalesce(string_agg(to_jsonb(t)::text,'|' ORDER BY id),'')) AS checksum FROM public.${table} t`;
const fingerprintSql = businessTables.map(fingerprint).join('\nUNION ALL\n');
const statements = [
  'BEGIN ISOLATION LEVEL REPEATABLE READ;',
  "SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';",
  "SELECT pg_advisory_xact_lock(hashtextextended('sonasp-owner-modules-20260830',0));",
  `DO $pre$ BEGIN IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version IN (${versions}))
    THEN RAISE EXCEPTION 'Migration déjà enregistrée'; END IF; END $pre$;`,
  `CREATE TEMP TABLE before_business ON COMMIT DROP AS ${fingerprintSql};`,
  ...migrations.map(({ sql }) => body(sql)),
];

for (const [test, count] of [['owner_module_continuity_test.sql', 26], ['national_reserve_catalog_test.sql', 9]]) {
  statements.push('SAVEPOINT regression_test;',
    body(readFileSync(path.join(root, 'supabase/tests', test), 'utf8')),
    `DO $test$ BEGIN IF extensions.num_failed() IS DISTINCT FROM 0 OR extensions._get('curr_test') IS DISTINCT FROM ${count}
      THEN RAISE EXCEPTION 'Échec du contrat ${test}'; END IF; END $test$;`,
    'ROLLBACK TO SAVEPOINT regression_test; RELEASE SAVEPOINT regression_test;');
}
statements.push(
  `CREATE TEMP TABLE after_business ON COMMIT DROP AS ${fingerprintSql};`,
  `DO $integrity$ BEGIN IF EXISTS(SELECT * FROM before_business EXCEPT SELECT * FROM after_business)
    THEN RAISE EXCEPTION 'Données métier modifiées : annulation'; END IF; END $integrity$;`,
);
if (mode === 'apply') {
  for (const migration of migrations) {
    statements.push(`INSERT INTO supabase_migrations.schema_migrations(version,name,statements)
      VALUES(${quote(migration.version)},${quote(migration.name.slice(15, -4))},ARRAY[${quote(migration.sql)}]);`);
  }
}
statements.push(`SELECT jsonb_build_object('mode',${quote(mode)},'sql_tests_passed',35,
  'business_data_unchanged',true,'versions',jsonb_build_array(${versions})) AS validation;`,
  mode === 'apply' ? 'COMMIT;' : 'ROLLBACK;');
const result = query(statements.join('\n'), mode);
console.log(JSON.stringify({ phase: mode, result }));
const after = query(snapshotSql, 'after')[0]?.snapshot;
const expectedVersionCount = mode === 'apply' ? 2 : 0;
if (after?.applied_versions.length !== expectedVersionCount || !after.owner_valid) {
  throw new Error('Contrôle après transaction non conforme : consulter les preuves, ne pas rejouer automatiquement.');
}
if (mode === 'apply' && (after.incomplete_owner_permissions !== 0
  || !after.audit_constraint.includes('module_catalog_update')
  || !after.audit_constraint.includes('access_configuration'))) {
  throw new Error('Contrôle Owner/audit non conforme après application.');
}
writeFileSync(path.join(work, 'receipt.json'), JSON.stringify({
  mode, project, checkedAt: after.checked_at, appliedVersions: after.applied_versions,
  incompleteOwnerPermissions: after.incomplete_owner_permissions,
  migrations: migrations.map(({ name, checksum }) => ({ name, checksum })),
  sqlTestsPassed: 35, businessDataUnchanged: true,
}, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ completed: mode, appliedVersions: after.applied_versions,
  sqlTestsPassed: 35, businessDataUnchanged: true, receipt: path.join(work, 'receipt.json') }));
