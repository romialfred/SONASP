/**
 * Isolated PostgreSQL regression check; never connects to a project.
 * npm install --no-save @electric-sql/pglite
 * node scripts/test-artisanal-site-migration.mjs
 * PGLITE_MODULE may point to a separately installed module's file URL.
 * The scaffold models only the tables/policies touched by this migration;
 * it does not replace a full Supabase migration replay.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
    CREATE FUNCTION public.snp_mfa_satisfaite() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT current_setting('test.aal',true)='aal2'$$;
    CREATE FUNCTION public.snp_peut_gerer_sites_artisanaux() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT false$$;
    CREATE FUNCTION public.snp_can_access_artisan(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT false$$;
    CREATE FUNCTION public.snp_require_capability(text) RETURNS void LANGUAGE plpgsql AS $$BEGIN
      IF (SELECT role FROM public.user_profiles WHERE id=auth.uid()) NOT IN ('owner','admin','management') THEN
        RAISE EXCEPTION 'capability refused' USING ERRCODE='42501'; END IF; END$$;
    CREATE TABLE public.user_profiles(id uuid PRIMARY KEY,role text,is_active boolean,mining_company_id uuid);
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,UNIQUE(bucket_id,name));
    CREATE TABLE public.mining_companies(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text);
    CREATE TABLE public.mining_company_documents(id uuid PRIMARY KEY,mining_company_id uuid);
    CREATE TABLE public.stakeholder_bank_accounts(id uuid PRIMARY KEY,stakeholder_type text,stakeholder_id uuid);
    CREATE TABLE public.snp_artisans_miniers(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE TABLE public.snp_artisan_ventes_or(id uuid PRIMARY KEY);
    CREATE TABLE public.snp_artisan_documents(id uuid PRIMARY KEY,artisan_id uuid);
    CREATE POLICY snp_artisan_child_perimeter_restrictive ON public.snp_artisan_documents AS RESTRICTIVE FOR ALL TO authenticated USING(false);
    CREATE TABLE public.snp_ministries(id uuid PRIMARY KEY,is_active boolean);
    CREATE TABLE public.snp_organizations(id uuid PRIMARY KEY,code text,name text,short_name text,organization_type text,organization_subtype text,
      supervising_ministry_id uuid,parent_organization_id uuid,mining_company_id uuid,source_artisan_id uuid,
      legal_form text,email text,phone text,address text,website text,administrative_region text,zone_code text,service_code text,
      notes text,is_active boolean,scope_metadata jsonb,created_by uuid,updated_at timestamptz);
    CREATE TABLE public.snp_modules(id uuid PRIMARY KEY,code text,nom text);
    CREATE TABLE public.snp_navigation_groups(code text PRIMARY KEY,name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.snp_artisans_miniers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.mining_companies ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.snp_organizations ENABLE ROW LEVEL SECURITY;
    CREATE POLICY snp_mining_companies_insert_admin ON public.mining_companies FOR INSERT TO authenticated WITH CHECK(false);
    CREATE POLICY legacy_artisan_access ON public.snp_artisans_miniers FOR ALL TO authenticated USING(true) WITH CHECK(true);
    CREATE POLICY snp_artisans_insert_internal_restrictive ON public.snp_artisans_miniers AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(false);
    CREATE POLICY snp_artisans_perimeter_restrictive ON public.snp_artisans_miniers AS RESTRICTIVE FOR SELECT TO authenticated USING(false);
    CREATE POLICY snp_artisans_update_perimeter_restrictive ON public.snp_artisans_miniers AS RESTRICTIVE FOR UPDATE TO authenticated USING(false);
  `);
  const old = await fs.readFile(new URL('../supabase/migrations/20260823130000_installer_sites_artisanaux.sql', import.meta.url), 'utf8');
  await db.exec(old.slice(old.indexOf('CREATE TABLE IF NOT EXISTS public.artisanal_sites'), old.indexOf('CREATE TABLE IF NOT EXISTS public.artisanal_site_productions')));
  await db.exec(`ALTER TABLE public.artisanal_sites ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.artisanal_site_assignments ENABLE ROW LEVEL SECURITY;
    CREATE POLICY old_sites ON public.artisanal_sites FOR ALL TO authenticated USING(public.snp_peut_gerer_sites_artisanaux()) WITH CHECK(public.snp_peut_gerer_sites_artisanaux());
    CREATE POLICY old_contacts ON public.artisanal_site_assignments FOR ALL TO authenticated USING(public.snp_peut_gerer_sites_artisanaux()) WITH CHECK(public.snp_peut_gerer_sites_artisanaux());
    GRANT USAGE ON SCHEMA public,auth,storage TO authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public,storage TO authenticated;
    GRANT SELECT ON auth.users TO authenticated;
  `);
  const migration = await fs.readFile(new URL('../supabase/migrations/20260906093115_sites_artisanaux_formalisation_aea.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  const profiles = {};
  for (const role of ['owner','admin','dgmg','management','comptoir','collector','mine','dgi']) {
    profiles[role] = randomUUID();
    await db.query('INSERT INTO auth.users VALUES($1)', [profiles[role]]);
    await db.query('INSERT INTO public.user_profiles VALUES($1,$2,true,null)', [profiles[role], role]);
  }
  await db.exec('SET ROLE authenticated');
  const actor = async (role, aal = 'aal2') => { await db.query("SELECT set_config('test.uid',$1,false),set_config('test.aal',$2,false)", [profiles[role], aal]); };
  const contact = [{ role: 'site_manager', full_name: 'Responsable', phone: '70000001' }, { role: 'collection_officer', full_name: 'Collecte', phone: '70000002' }];
  const site = () => ({ id: randomUUID(), code: `TEST-${randomUUID()}`, name: 'Site de test', status: 'planned', region: 'Centre', province: 'Kadiogo', locality: 'Test', area_hectares: 2, formalization: 'non_formalized', authorized_miners: 100, active_miners: 50, average_hole_depth_m: 2, authorized_chemicals: [], photos: [], latitude: 12, longitude: -1 });
  const save = (s, contacts = contact) => db.query('SELECT public.snp_save_artisanal_site($1,$2) AS saved', [JSON.stringify(s), JSON.stringify(contacts)]);
  let checks = 0;
  for (const role of ['owner','admin','dgmg']) {
    await actor(role); const s = site();
    const result = (await save(s)).rows[0].saved;
    assert.equal(result.site.exploitation_type, 'artisanale');
    assert.equal(result.assignments.length, 2);
    await db.query('INSERT INTO public.mining_companies(name) VALUES($1)', ['test']);
    await db.exec('INSERT INTO public.snp_artisans_miniers DEFAULT VALUES'); checks += 3;
  }
  for (const role of ['management','comptoir','collector','mine','dgi']) {
    await actor(role);
    await assert.rejects(save(site()), e => e.code === '42501');
    await assert.rejects(db.query('INSERT INTO public.mining_companies(name) VALUES($1)', ['denied']), e => e.code === '42501');
    await assert.rejects(db.exec('INSERT INTO public.snp_artisans_miniers DEFAULT VALUES'), e => e.code === '42501'); checks += 3;
  }
  await actor('dgmg', 'aal1'); await assert.rejects(save(site()), e => e.code === '42501'); checks++;
  await actor('dgmg');
  const missing = { ...site(), formalization: 'formalized', aea_number: 'AEA-01', aea_issued_on: '2026-01-31', aea_duration_months: 12, aea_document_name: 'aea.pdf' };
  await assert.rejects(save(missing), e => e.code === '23514'); checks++;
  missing.aea_document_path = `${missing.id}/${randomUUID()}.pdf`;
  await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)', ['artisanal-site-aea', missing.aea_document_path]);
  await save(missing);
  const updated = (await save({ ...missing, name: 'Site modifié' })).rows[0].saved;
  assert.equal(updated.site.aea_document_path, missing.aea_document_path); checks++;
  const erased = await db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING name', [missing.aea_document_path]);
  assert.equal(erased.rows.length, 0); checks++;
  await assert.rejects(save({ ...missing, id: randomUUID(), code: randomUUID() }), e => e.code === '23514'); checks++;
  const bad = site();
  await assert.rejects(save(bad, [contact[0], { ...contact[1], user_id: randomUUID() }]), e => e.code === '23503');
  assert.equal((await db.query('SELECT id FROM public.artisanal_sites WHERE id=$1', [bad.id])).rows.length, 0); checks++;
  const unformalized = (await save({ ...missing, formalization: 'non_formalized' })).rows[0].saved;
  assert.equal(unformalized.site.aea_document_path, null); checks++;
  await actor('management');
  assert.ok((await db.query('SELECT id FROM public.artisanal_sites')).rows.length > 0); checks++;
  await db.exec('RESET ROLE');
  const ministry = randomUUID();
  await db.query('INSERT INTO public.snp_ministries VALUES($1,true)', [ministry]);
  await db.exec('SET ROLE authenticated');
  const organization = async (type, id = null) => {
    const args = [id, 'CP-TEST', 'Comptoir de test', '', type, '', ministry, null, null, null, '', '', '', '', '', '', '', '', '', true, '{}'];
    return db.query('SELECT public.snp_save_organization(' + args.map((_,i) => '$' + (i+1)).join(',') + ') AS id', args);
  };
  await actor('dgmg');
  const comptoirId = (await organization('comptoir')).rows[0].id;
  assert.ok(comptoirId); checks++;
  await organization('comptoir', comptoirId); checks++;
  await assert.rejects(organization('dgi'), e => e.code === '42501'); checks++;
  await actor('management');
  await assert.rejects(organization('comptoir'), e => e.code === '42501'); checks++;
  console.log(`${checks} vérifications PostgreSQL réussies : migration, rôles, AEA et atomicité (base isolée).`);
} catch (error) { console.error(error.code, error.message, error.where || ""); process.exitCode = 1; } finally { await db.close(); }
