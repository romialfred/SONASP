// Déploiement atomique et ciblé des améliorations de ventes internationales.
// Ne répare pas et ne rejoue jamais l'historique divergent des migrations.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [mode, cli, auditFolder] = process.argv.slice(2);
if (!['inspect', 'rehearse', 'apply'].includes(mode) || !cli || !auditFolder) {
  throw new Error('Usage: node deploy-sales-improvements.mjs <inspect|rehearse|apply> <supabase-cli> <audit-folder>');
}

const projectRef = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
if (projectRef !== 'yyverzuhkdonjjuficor') throw new Error('Projet Supabase inattendu.');
mkdirSync(auditFolder, { recursive: true });

const backupPath = path.join(auditFolder, 'public-before.sql');
if (mode !== 'inspect' && (!statSync(backupPath).isFile() || statSync(backupPath).size < 100_000)) {
  throw new Error('Sauvegarde de schéma absente ou incomplète.');
}

const migrationNames = [
  '20260904120000_simulations_ventes_internationales.sql',
  '20260904143000_refonte_creation_vente_internationale.sql',
];
const catalogue = JSON.parse(readFileSync('supabase/migrations.catalogue.json', 'utf8'));
const normalize = (value) => value.replace(/\r\n?/g, '\n');
const digest = (value) => createHash('sha256').update(normalize(value)).digest('hex');
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

const migrations = migrationNames.map((name) => {
  const relativePath = `supabase/migrations/${name}`;
  const sql = readFileSync(relativePath, 'utf8');
  const checksum = digest(sql);
  const catalogueEntry = catalogue.files.find((entry) => entry.path === relativePath);
  if (catalogueEntry?.sha256 !== checksum) throw new Error(`Empreinte catalogue invalide : ${name}`);
  if ((sql.match(/^BEGIN;\s*$/gm) || []).length !== 1 || (sql.match(/^COMMIT;\s*$/gm) || []).length !== 1) {
    throw new Error(`Transaction de migration inattendue : ${name}`);
  }
  return {
    name,
    version: name.slice(0, 14),
    checksum,
    sql,
    body: sql.replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, ''),
  };
});

const query = (sql, label) => {
  const sqlPath = path.join(auditFolder, `${label}.sql`);
  writeFileSync(sqlPath, sql);
  try {
    const raw = execFileSync(cli, ['db', 'query', '--linked', '--file', sqlPath, '-o', 'json'], {
      encoding: 'utf8',
      timeout: 180_000,
      maxBuffer: 24 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const payload = JSON.parse(raw.slice(raw.indexOf('{')));
    writeFileSync(path.join(auditFolder, `${label}.json`), JSON.stringify(payload.rows, null, 2));
    return payload.rows;
  } catch (error) {
    writeFileSync(path.join(auditFolder, `${label}.error.txt`), String(error.stderr || error.message));
    throw new Error(`${label} a échoué. Consulter le journal privé avant toute nouvelle tentative.`);
  }
};

const versionsSql = migrations.map(({ version }) => quote(version)).join(',');
const snapshotSql = `
SELECT jsonb_build_object(
  'project', ${quote(projectRef)},
  'database', current_database(),
  'versions', (
    SELECT coalesce(jsonb_agg(version ORDER BY version), '[]'::jsonb)
    FROM supabase_migrations.schema_migrations
    WHERE version IN (${versionsSql})
  ),
  'owner_active', EXISTS (
    SELECT 1 FROM public.user_profiles WHERE role = 'owner' AND is_active
  ),
  'objects', jsonb_build_object(
    'sale_simulations', to_regclass('public.sale_simulations') IS NOT NULL,
    'drafts', to_regclass('public.snp_ventes_export_brouillons') IS NOT NULL,
    'save_draft', EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'snp_enregistrer_brouillon_vente_export'
    ),
    'submit_draft', EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'snp_soumettre_brouillon_vente_export'
    )
  ),
  'required_functions', jsonb_build_object(
    'permissions', to_regprocedure('public.snp_actor_can_module_action(text,text)') IS NOT NULL,
    'sonasp_sale', EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'snp_creer_vente_export_idempotent'
    ),
    'mine_sale', EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'snp_creer_vente_export_mine'
    )
  )
) AS snapshot;
`;

const before = query(snapshotSql, `${mode}-before`)[0].snapshot;
if (!before.owner_active || Object.values(before.required_functions).some((available) => !available)) {
  throw new Error('Préconditions fonctionnelles ou Owner non satisfaites.');
}
if (mode !== 'inspect' && (before.versions.length || Object.values(before.objects).some(Boolean))) {
  throw new Error('Le lot semble déjà appliqué ou la cible contient des objets inattendus.');
}

if (mode === 'inspect') {
  console.log(JSON.stringify({ mode, project: projectRef, migrations: migrations.map(({ name, checksum }) => ({ name, checksum })), before }));
  process.exit(0);
}

const fingerprintFunction = `
CREATE FUNCTION pg_temp.sales_release_fingerprints()
RETURNS TABLE(relation text, row_count bigint, checksum text)
LANGUAGE plpgsql
AS $fingerprint$
DECLARE item text;
BEGIN
  FOREACH item IN ARRAY ARRAY['sales','customers','customer_contracts','gold_inventory','payments'] LOOP
    RETURN QUERY EXECUTE format(
      'SELECT %L::text, count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), '''' ORDER BY md5(to_jsonb(t)::text)), '''')) FROM public.%I t',
      item,
      item
    );
  END LOOP;
END
$fingerprint$;
`;

const guard = `
DO $guard$
BEGIN
  IF current_database() <> 'postgres' THEN RAISE EXCEPTION 'Base inattendue'; END IF;
  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version IN (${versionsSql})
  ) THEN RAISE EXCEPTION 'Versions déjà inscrites'; END IF;
  IF to_regclass('public.sale_simulations') IS NOT NULL
     OR to_regclass('public.snp_ventes_export_brouillons') IS NOT NULL THEN
    RAISE EXCEPTION 'Objets cibles déjà présents';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE role = 'owner' AND is_active) THEN
    RAISE EXCEPTION 'Owner actif introuvable';
  END IF;
  IF to_regprocedure('public.snp_actor_can_module_action(text,text)') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'snp_creer_vente_export_idempotent'
     )
     OR NOT EXISTS (
       SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'snp_creer_vente_export_mine'
     ) THEN
    RAISE EXCEPTION 'Prérequis serveur absents';
  END IF;
END
$guard$;
`;

const checks = `
DO $checks$
BEGIN
  IF EXISTS (
    SELECT * FROM release_before
    EXCEPT SELECT * FROM pg_temp.sales_release_fingerprints()
  ) OR EXISTS (
    SELECT * FROM pg_temp.sales_release_fingerprints()
    EXCEPT SELECT * FROM release_before
  ) THEN RAISE EXCEPTION 'Données métier existantes modifiées'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'sale_simulations' AND c.relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'snp_ventes_export_brouillons' AND c.relrowsecurity
  ) THEN RAISE EXCEPTION 'RLS absente sur un nouvel objet'; END IF;

  IF has_table_privilege('anon', 'public.sale_simulations', 'SELECT')
     OR has_table_privilege('anon', 'public.snp_ventes_export_brouillons', 'SELECT')
     OR has_table_privilege('authenticated', 'public.snp_ventes_export_brouillons', 'INSERT')
     OR has_function_privilege('anon', 'public.snp_enregistrer_brouillon_vente_export(uuid,integer,uuid,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.snp_soumettre_brouillon_vente_export(uuid,integer,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Privilèges trop permissifs';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.sale_simulations', 'SELECT')
     OR NOT has_function_privilege('authenticated', 'public.snp_enregistrer_brouillon_vente_export(uuid,integer,uuid,jsonb,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.snp_soumettre_brouillon_vente_export(uuid,integer,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Privilèges applicatifs absents';
  END IF;

  IF EXISTS (SELECT 1 FROM public.sale_simulations)
     OR EXISTS (SELECT 1 FROM public.snp_ventes_export_brouillons) THEN
    RAISE EXCEPTION 'Données inattendues dans les nouvelles tables';
  END IF;
END
$checks$;
`;

const historyStatements = mode === 'apply'
  ? migrations.map(({ version, name, sql }) => `
INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
VALUES (${quote(version)}, ${quote(name.slice(15, -4))}, ARRAY[${quote(sql)}]);
`).join('\n')
  : '';

const transaction = `
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';
SELECT pg_advisory_xact_lock(hashtextextended('sonasp-sales-release-20260904', 0));
${guard}
${fingerprintFunction}
CREATE TEMP TABLE release_before ON COMMIT DROP AS
SELECT * FROM pg_temp.sales_release_fingerprints();
${migrations.map(({ body }) => body).join('\n')}
SET CONSTRAINTS ALL IMMEDIATE;
${checks}
${historyStatements}
SELECT jsonb_build_object(
  'mode', ${quote(mode)},
  'migrations', ${migrations.length},
  'business_fingerprints_unchanged', true,
  'rls_verified', true,
  'privileges_verified', true
) AS validation;
${mode === 'apply' ? 'COMMIT;' : 'ROLLBACK;'}
`;

const result = query(transaction, `${mode}-transaction`);
const after = query(snapshotSql, `${mode}-after`)[0].snapshot;
const expectedVersionCount = mode === 'apply' ? migrations.length : 0;
const expectedObjects = mode === 'apply';
if (
  !after.owner_active
  || after.versions.length !== expectedVersionCount
  || Object.values(after.objects).some((value) => value !== expectedObjects)
) {
  throw new Error('Postcontrôle distant non conforme.');
}

const receipt = {
  project: projectRef,
  mode,
  at: new Date().toISOString(),
  migrations: migrations.map(({ name, checksum }) => ({ name, checksum })),
  backup: backupPath,
  result,
  before,
  after,
};
writeFileSync(path.join(auditFolder, `${mode}-receipt.json`), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify({ completed: mode, project: projectRef, migrations: receipt.migrations, validation: result[0]?.validation }));
