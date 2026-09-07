// Prépare uniquement le DELETE gardé et son postflight. Ne lance jamais la CLI.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const folder = 'docs/amelioration/environnement/reprise-r02';
const load = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const manifestFile = 'docs/amelioration/preuves/recette-r02/manifest-donnees.json';
const manifest = load(manifestFile);
const preflight = load(`${folder}/cleanup-preflight.json`).rows[0].cleanup_preflight;
const creation = load(`${folder}/site-creation-d9f7160a-aadd-41d9-ad4d-c9f886d41e0c.json`).rows[0].dossier;
const prior = load(`${folder}/baseline-apres-creation-r02.json`).rows[0].baseline;
const siteId = 'd9f7160a-aadd-41d9-ad4d-c9f886d41e0c';
const contactIds = ['12bd6c4e-52f4-4e9d-a2aa-81e101ab5e12','d585b8e2-8f0c-4acd-bb90-bfd03acd6a8c'];
assert.equal(fs.readFileSync('supabase/.temp/project-ref','utf8').trim(), 'yyverzuhkdonjjuficor');
assert.equal(manifest.runPrefix, 'QA20260907-R02');
assert.deepEqual(manifest.entities, { artisanal_sites:[siteId], artisanal_site_assignments:contactIds });
assert.deepEqual(manifest.storageObjects, []);
assert.equal(preflight.read_only, 'on');
assert.equal(preflight.dossier.id, siteId);
assert.equal(preflight.dossier.kind, 'site');
assert.equal(preflight.dossier.parent.name, 'QA20260907-R02-SITE');
assert.deepEqual(preflight.dossier.parent, creation.parent, 'Le site a changé depuis sa création : arrêt');
assert.deepEqual(preflight.dossier.assignments, creation.assignments, 'Les responsables ont changé : arrêt');
assert.deepEqual(preflight.dossier.parent.photos, []);
assert.equal(preflight.dossier.parent.aea_document_path, null);
assert.deepEqual(preflight.dossier.storage, []);
assert.deepEqual(preflight.schema.rules, []);
assert.ok(preflight.schema.triggers.every(t => t.internal || !t.definition.includes('DELETE')), 'Déclencheur métier DELETE non analysé');
const q = value => "'" + String(value).replaceAll("'", "''") + "'";
const array = values => `ARRAY[${values.map(q).join(',')}]::uuid[]`;
const schema = fs.readFileSync(`${folder}/cleanup-schema-expression.txt`, 'utf8');
const rowHash = (baseline, table, id) => {
  const row = baseline.tables.find(t => t.table_name === table)?.rows.find(r => r.id === id);
  assert.match(row?.md5 ?? '', /^[a-f0-9]{32}$/);
  return row.md5;
};
const targetHashes = {};
for (const [table, ids] of Object.entries(manifest.entities)) for (const id of ids) {
  const current = rowHash(preflight.baseline, table, id);
  assert.equal(current, rowHash(prior, table, id), `Ligne ${id} modifiée depuis la précédente baseline`);
  targetHashes[id] = current;
}
const incoming = preflight.schema.foreign_keys;
assert.equal(incoming.length, 6);
for (const fk of incoming) {
  assert.match(fk.table, /^[a-z_]+$/);
  assert.equal(fk.referenced_table, 'artisanal_sites');
  assert.deepEqual(fk.referenced_columns, ['id']);
  assert.equal(fk.columns.length, 1);
  assert.match(fk.columns[0], /^[a-z_]+$/);
  const ref = preflight.dossier.references.find(r => r.table_name === fk.table && r.column_name === fk.columns[0]);
  assert.ok(ref, 'Dépendance nouvelle non contrôlée');
  assert.equal(ref.row_count, fk.table === 'artisanal_site_assignments' ? 2 : 0, 'Dépendant externe : arrêt');
}
const outsideChecks = incoming.filter(fk => fk.table !== 'artisanal_site_assignments').map(fk => `
  IF EXISTS(SELECT 1 FROM public.${fk.table} WHERE ${fk.columns[0]}=${q(siteId)}::uuid) THEN
    RAISE EXCEPTION 'Dépendance externe ${fk.table}.${fk.columns[0]} : nettoyage refusé'; END IF;`).join('\n');
const affectedTables = [...new Set(['artisanal_sites',...incoming.map(fk => fk.table)])].sort();
const preservedTables = [...new Set([...preflight.baseline.tables.map(t => t.table_name), ...affectedTables])].sort();
const exclusions = table => table === 'artisanal_sites' ? ` WHERE t.id<>${q(siteId)}::uuid`
  : table === 'artisanal_site_assignments' ? ` WHERE NOT(t.id=ANY(${array(contactIds)}))` : '';
const preservation = `SELECT jsonb_build_object('tables',(SELECT jsonb_agg(to_jsonb(r) ORDER BY table_name) FROM (
${preservedTables.map(table => `SELECT ${q(table)} AS table_name,count(*) AS row_count,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id),'')) AS aggregate_md5 FROM public.${table} t${exclusions(table)}`).join('\nUNION ALL\n')}
) r),'storage',(SELECT jsonb_build_object('count',count(*),'metadata_md5',md5(coalesce(string_agg(to_jsonb(o)::text,'' ORDER BY id),'')))
 FROM storage.objects o WHERE bucket_id IN('artisanal-sites','artisanal-site-aea','artisan-dossiers')))`;
const sql = `-- Candidat de nettoyage R02. Exécution interdite sans instruction séparée du principal.
-- Un site et deux responsables exacts ; aucun autre dossier, aucune donnée Auth/Storage.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Empêche une nouvelle dépendance ou DDL entre les gardes et les DELETE, tout en permettant les SELECT.
-- Acquisition avant la première lecture du snapshot. Attente bornée, aucune désactivation de trigger/RLS.
LOCK TABLE ${affectedTables.map(table => `public.${table}`).join(', ')} IN SHARE ROW EXCLUSIVE MODE;
DO $cleanup$
DECLARE
  before_preservation jsonb;
  after_preservation jsonb;
  deleted_count integer;
BEGIN
  IF (${schema}) IS DISTINCT FROM ${q(JSON.stringify(preflight.schema))}::jsonb THEN
    RAISE EXCEPTION 'Schéma, FK, règles ou déclencheurs divergents : nouvelle revue nécessaire';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.artisanal_sites t WHERE t.id=${q(siteId)}::uuid
    AND t.name='QA20260907-R02-SITE' AND left(t.name,length('QA20260907-R02'))='QA20260907-R02'
    AND md5(to_jsonb(t)::text)=${q(targetHashes[siteId])}) THEN
    RAISE EXCEPTION 'Site absent, modifié ou hors manifeste : nettoyage refusé';
  END IF;
  IF (SELECT coalesce(array_agg(id ORDER BY id),ARRAY[]::uuid[]) FROM public.artisanal_site_assignments WHERE site_id=${q(siteId)}::uuid)
    IS DISTINCT FROM ${array([...contactIds].sort())} THEN
    RAISE EXCEPTION 'Responsables différents du manifeste : nettoyage refusé';
  END IF;
${contactIds.map(id => `  IF NOT EXISTS(SELECT 1 FROM public.artisanal_site_assignments t WHERE t.id=${q(id)}::uuid AND t.site_id=${q(siteId)}::uuid
    AND md5(to_jsonb(t)::text)=${q(targetHashes[id])}) THEN RAISE EXCEPTION 'Responsable modifié : nettoyage refusé'; END IF;`).join('\n')}
  IF EXISTS(SELECT 1 FROM public.artisanal_sites WHERE id=${q(siteId)}::uuid
    AND (cardinality(photos)<>0 OR aea_document_path IS NOT NULL)) THEN
    RAISE EXCEPTION 'Pièce distante présente : nettoyage hors portée';
  END IF;
${outsideChecks}
  before_preservation := (${preservation});
  DELETE FROM public.artisanal_site_assignments WHERE id=ANY(${array(contactIds)}) AND site_id=${q(siteId)}::uuid;
  GET DIAGNOSTICS deleted_count=ROW_COUNT;
  IF deleted_count<>2 THEN RAISE EXCEPTION 'Suppression attendue de deux responsables uniquement'; END IF;
  DELETE FROM public.artisanal_sites WHERE id=${q(siteId)}::uuid AND name='QA20260907-R02-SITE';
  GET DIAGNOSTICS deleted_count=ROW_COUNT;
  IF deleted_count<>1 THEN RAISE EXCEPTION 'Suppression attendue du seul site QA'; END IF;
  IF EXISTS(SELECT 1 FROM public.artisanal_sites WHERE id=${q(siteId)}::uuid)
    OR EXISTS(SELECT 1 FROM public.artisanal_site_assignments WHERE site_id=${q(siteId)}::uuid OR id=ANY(${array(contactIds)})) THEN
    RAISE EXCEPTION 'Le dossier QA existe encore';
  END IF;
  after_preservation := (${preservation});
  IF before_preservation IS DISTINCT FROM after_preservation THEN
    RAISE EXCEPTION 'Une donnée hors manifeste a changé : annulation intégrale';
  END IF;
END; $cleanup$;
SELECT jsonb_build_object('run_prefix','QA20260907-R02','site_id',${q(siteId)},'deleted_site',1,'deleted_assignments',2,
  'preservation_checked_in_transaction',true,'schema_unchanged',(${schema})=${q(JSON.stringify(preflight.schema))}::jsonb,
  'checked_at',clock_timestamp()) AS cleanup;
COMMIT;
`;
assert.doesNotMatch(sql, /CREATE\s+(?:TEMP\s+)?TABLE|ALTER\s+|DROP\s+|TRUNCATE\s+|DISABLE\s+TRIGGER|SET\s+ROLE/i);
const baselineSql = fs.readFileSync(`${folder}/baseline.sql`, 'utf8');
const statement = baselineSql.slice(baselineSql.indexOf('SELECT jsonb_build_object('),baselineSql.lastIndexOf(' AS baseline;')+' AS baseline'.length);
const postflight = `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
WITH baseline_read AS (${statement})
SELECT jsonb_build_object('checked_at',clock_timestamp(),'run_prefix','QA20260907-R02',
 'remaining_site',(SELECT count(*) FROM public.artisanal_sites WHERE id=${q(siteId)}::uuid),
 'remaining_assignments',(SELECT count(*) FROM public.artisanal_site_assignments WHERE site_id=${q(siteId)}::uuid OR id=ANY(${array(contactIds)})),
 'schema',${schema},'baseline',(SELECT baseline FROM baseline_read),'outside_preservation',(${preservation})) AS cleanup_postflight;
ROLLBACK;
`;
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
fs.writeFileSync(`${folder}/cleanup-candidate.sql`, sql, { flag:'wx' });
fs.writeFileSync(`${folder}/cleanup-postflight.sql`, postflight, { flag:'wx' });
const plan = { preparedAt:new Date().toISOString(),preparedOnly:true,executed:false,projectRef:'yyverzuhkdonjjuficor',
 manifestFile,siteId,contactIds,targetHashes,preflightAt:preflight.checked_at,
 targetUnchangedSinceCreation:true,externalDependencies:0,attachments:0,
 preservedTables,lockedTables:affectedTables,lockTimeout:'5s',statementTimeout:'30s',
 schemaSha256:hash(JSON.stringify(preflight.schema)),candidateSha256:hash(sql),postflightSha256:hash(postflight),
 mutationsAllowedOnlyAfterSeparateInstruction:['DELETE two exact artisanal_site_assignments','DELETE one exact artisanal_sites'],
 thirdPartyChangesExcluded:['5a29b656-c992-4a84-91fa-eb6819121ebb','be44ea0d-fb3b-4b02-88b4-cc6ccaf67c56','b0035b68-1fbb-45ef-a911-36a03d2e10e6'] };
fs.writeFileSync(`${folder}/cleanup-plan.json`, JSON.stringify(plan,null,2)+'\n', { flag:'wx' });
console.log(JSON.stringify({ preparedOnly:true,siteUnchanged:true,contactsUnchanged:true,externalDependencies:0,sha256:plan.candidateSha256 }));
