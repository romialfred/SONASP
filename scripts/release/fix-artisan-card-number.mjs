// Narrow hotfix: preserve business rows and permissions; exercise the deployed
// RPC/trigger chain in a rolled-back transaction before changing one function.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [mode, cli, folder] = process.argv.slice(2);
assert.ok(['backup', 'rehearse', 'apply', 'verify'].includes(mode) && cli && folder);
const version = '20260906190538';
const project = 'yyverzuhkdonjjuficor';
assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), project);
const file = `supabase/migrations/${version}_fix_artisan_card_number_search_path.sql`;
const sql = readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
const checksum = createHash('sha256').update(sql).digest('hex');
assert.equal(JSON.parse(readFileSync('supabase/migrations.catalogue.json', 'utf8')).files.find(f => f.path === file)?.sha256, checksum);
mkdirSync(folder, { recursive: true });
const quote = v => "'" + v.replaceAll("'", "''") + "'";
function query(statement, label) {
  const target = path.resolve(folder, label + '.sql');
  writeFileSync(target, statement);
  try {
    const raw = execFileSync(cli, ['db', 'query', '--linked', '--file', target, '-o', 'json'], { encoding: 'utf8', timeout: 120000, maxBuffer: 20e6, stdio: ['ignore', 'pipe', 'pipe'] });
    const rows = JSON.parse(raw.slice(raw.indexOf('{'))).rows;
    writeFileSync(path.join(folder, label + '.json'), JSON.stringify(rows, null, 2));
    return rows;
  } catch (error) {
    writeFileSync(path.join(folder, label + '.error.log'), String(error.stderr || error.message));
    throw new Error(label + ' failed; see the private error log.');
  }
}
const tables = ['snp_artisans_miniers', 'snp_cartes_professionnelles', 'snp_artisan_responsables', 'snp_artisan_dossier_audit', 'snp_artisan_documents', 'snp_artisan_moyens_paiement', 'snp_artisan_ventes_or', 'snp_artisan_paiements', 'snp_collectors', 'snp_collector_sites', 'snp_adhesion_droits', 'snp_adhesion_encaissements', 'snp_comptoir_dossiers', 'user_sessions'];
const fingerprints = tables.map(t => `SELECT ${quote(t)} table_name,count(*) row_count,md5(coalesce(string_agg(to_jsonb(t)::text,'|' ORDER BY to_jsonb(t)::text),'')) fingerprint FROM public.${t} t`).join(' UNION ALL ');
const snapshot = `SELECT jsonb_build_object(
 'function',(SELECT pg_get_functiondef('public.generate_numero_carte()'::regprocedure)),
 'acl',(SELECT proacl FROM pg_proc WHERE oid='public.generate_numero_carte()'::regprocedure),
 'security',(SELECT jsonb_agg(jsonb_build_object('function',oid::regprocedure::text,'definer',prosecdef,'config',proconfig,'acl',proacl) ORDER BY oid::regprocedure::text) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('snp_save_artisan_dossier','snp_encoder_instant_carte')),
 'rows',(SELECT jsonb_agg(to_jsonb(r) ORDER BY table_name) FROM (${fingerprints}) r)
) snapshot;`;
const probe = `
 SAVEPOINT artisan_probe;
 CREATE TEMP TABLE probe_actor AS SELECT id FROM public.user_profiles WHERE role='owner' AND is_active AND mining_company_id IS NULL AND mfa_enrolled_at IS NOT NULL ORDER BY id LIMIT 1;
 DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM probe_actor) THEN RAISE EXCEPTION 'No eligible administrator for SQL rehearsal'; END IF; END $guard$;
 -- Test session exists only inside this transaction, never in a browser/token.
 INSERT INTO public.user_sessions(user_id,token_hash,expires_at,is_active) SELECT id,extensions.digest('artisan-rollback-${version}','sha256'),clock_timestamp()+interval '10 minutes',true FROM probe_actor;
 SELECT set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated','aal','aal2','session_id','artisan-rollback-${version}','exp',extract(epoch from clock_timestamp()+interval '10 minutes')::bigint)::text,true),set_config('request.jwt.claim.sub',id::text,true),set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.aal','aal2',true) FROM probe_actor;
 SET LOCAL ROLE authenticated;
 DO $probe$
 DECLARE kind text; artisan_role text; data jsonb; saved jsonb; edited jsonb; parent uuid; card public.snp_cartes_professionnelles; probe_id uuid; BEGIN
  FOREACH kind IN ARRAY ARRAY['physique','morale'] LOOP
   FOREACH artisan_role IN ARRAY ARRAY['exploitant','fournisseur','aide_exploitant','intermediaire'] LOOP
    probe_id:=gen_random_uuid();
    data:=jsonb_build_object('type_personne',kind,'type_artisan',artisan_role,'pays','Burkina Faso','region','Centre','commune','Ouagadougou','telephone','+22670000001','email','','whatsapp','','whatsapp_identique',false,'artisanal_site_id',NULL,'exploitant_id',CASE WHEN artisan_role='aide_exploitant' THEN parent END);
    IF kind='physique' THEN data:=data||jsonb_build_object('nom','QA ROLLBACK ${version}','prenoms','Essai','date_naissance','1990-01-01','type_piece_identite','CNI','numero_piece_identite',probe_id::text);
    ELSE data:=data||jsonb_build_object('raison_sociale','QA ROLLBACK ${version}','numero_registre_commerce',probe_id::text,'numero_ifu',probe_id::text,'siege_pays','Burkina Faso','siege_region','Centre','siege_commune','Ouagadougou','siege_adresse','Adresse de test','responsable',jsonb_build_object('nom','Essai','prenoms','Responsable','date_naissance','1980-01-01','fonction','Gérant','telephone','+22670000002','type_piece_identite','CNI','numero_piece_identite',probe_id::text)); END IF;
    saved:=public.snp_save_artisan_dossier(NULL,probe_id,NULL,data,false);
    IF parent IS NULL THEN parent:=probe_id; END IF;
    IF saved->'artisan'->>'numero_carte' !~ '^BF-AM-[0-9]{4}-[0-9A-Za-z]{4}-[0-9]{4}$' THEN RAISE EXCEPTION 'Missing generated number'; END IF;
    SELECT * INTO STRICT card FROM public.snp_cartes_professionnelles WHERE artisan_id=probe_id;
    IF card.numero_carte<>saved->'artisan'->>'numero_carte' OR card.valid_from IS NOT NULL OR card.valid_until IS NOT NULL THEN RAISE EXCEPTION 'Incorrect initial card/activation'; END IF;
    edited:=public.snp_save_artisan_dossier(probe_id,NULL,(saved->'artisan'->>'updated_at')::timestamptz,data||jsonb_build_object('observations','Modification QA'),false);
    IF edited->'artisan'->>'numero_carte'<>saved->'artisan'->>'numero_carte' OR edited->'artisan'->>'observations'<>'Modification QA' THEN RAISE EXCEPTION 'Edit round trip failed'; END IF;
   END LOOP;
  END LOOP;
 END $probe$;
 SET CONSTRAINTS ALL IMMEDIATE;
 RESET ROLE;
 ROLLBACK TO SAVEPOINT artisan_probe;
 RELEASE SAVEPOINT artisan_probe;
`;
if (mode === 'backup') {
  assert.ok(!existsSync(path.join(folder, 'baseline.json')), 'Existing backup');
  query(snapshot, 'baseline');
  writeFileSync(path.join(folder, 'source.json'), JSON.stringify({ version, checksum }));
  console.log(JSON.stringify({ mode, version, schemaAndFingerprintsSaved: true }));
} else if (mode === 'verify') {
  const r = query(`SELECT (SELECT proconfig @> ARRAY['search_path=""'] AND NOT prosecdef FROM pg_proc WHERE oid='public.generate_numero_carte()'::regprocedure) hardened_invoker,
    EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='${version}') recorded,
    NOT has_function_privilege('anon','public.snp_save_artisan_dossier(uuid,uuid,timestamptz,jsonb,boolean)','EXECUTE') anonymous_denied;`, 'verify')[0];
  for (const [k, v] of Object.entries(r)) assert.equal(v, true, k);
  console.log(JSON.stringify(r));
} else {
  assert.deepEqual(JSON.parse(readFileSync(path.join(folder, 'source.json'), 'utf8')), { version, checksum });
  const before = JSON.parse(readFileSync(path.join(folder, 'baseline.json'), 'utf8'))[0].snapshot;
  const current = query(snapshot, 'before-' + mode)[0].snapshot;
  assert.equal(current.function, before.function, 'Function changed since backup');
  assert.deepEqual(current.acl, before.acl);
  if (mode === 'apply') assert.deepEqual(JSON.parse(readFileSync(path.join(folder, 'rehearse-receipt.json'), 'utf8')).source, { version, checksum });
  const body = sql.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, '');
  const result = query(`BEGIN ISOLATION LEVEL REPEATABLE READ;
    SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='90s';
    SELECT pg_advisory_xact_lock(60906111030);
    CREATE TEMP TABLE before_rows ON COMMIT DROP AS ${fingerprints};
    ${body}
    ${probe}
    CREATE TEMP TABLE after_rows ON COMMIT DROP AS ${fingerprints};
    DO $check$ BEGIN
     IF EXISTS(SELECT * FROM before_rows EXCEPT SELECT * FROM after_rows) OR EXISTS(SELECT * FROM after_rows EXCEPT SELECT * FROM before_rows) THEN RAISE EXCEPTION 'Business data changed'; END IF;
    END $check$;
    ${mode === 'apply' ? `INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('${version}','fix_artisan_card_number_search_path',ARRAY[${quote(sql)}]); COMMIT;` : 'ROLLBACK;'}
    SELECT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='${version}') recorded;`, mode)[0];
  assert.equal(result.recorded, mode === 'apply');
  const after = query(snapshot, 'after-' + mode)[0].snapshot;
  assert.deepEqual(after.acl, before.acl, 'Trigger function privileges changed');
  assert.deepEqual(after.security, before.security, 'RPC/helper security changed');
  if (mode === 'rehearse') assert.equal(after.function, before.function, 'Schema rollback failed');
  const receipt = { mode, project, source: { version, checksum }, hostedSqlVariants: 8, createAndEdit: true, initialCardsInactive: true, unchangedTables: tables.length, testRowsRolledBack: true, browserTest: false, at: new Date().toISOString() };
  writeFileSync(path.join(folder, mode + '-receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
}
