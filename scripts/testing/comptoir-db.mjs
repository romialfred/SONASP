import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

// Base jetable uniquement. Les fonctions métier testées proviennent de la migration.
export async function createComptoirTestDb() {
 const db=new PGlite();
 await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE SCHEMA storage;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('test.role',true),''),'authenticated') $$;
 CREATE TABLE public.user_profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),role text NOT NULL,is_active boolean NOT NULL DEFAULT true,mining_company_id uuid);
 CREATE TABLE public.snp_ministries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text NOT NULL UNIQUE,name text NOT NULL DEFAULT 'Ministère de test',is_active boolean NOT NULL DEFAULT true);
 CREATE TABLE public.snp_organizations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text NOT NULL UNIQUE,name text NOT NULL,organization_type text NOT NULL,supervising_ministry_id uuid NOT NULL REFERENCES public.snp_ministries(id),
 short_name text,legal_form text,phone text,email text,website text,address text,administrative_region text,notes text,scope_metadata jsonb NOT NULL DEFAULT '{}',
 is_active boolean NOT NULL DEFAULT true,created_by uuid REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
 CREATE FUNCTION public.snp_session_est_active() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.session',true)='active' $$;
 CREATE FUNCTION public.snp_peut_gerer_sites_artisanaux() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT current_setting('test.aal',true)='aal2' AND EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND is_active AND mining_company_id IS NULL AND role IN ('owner','admin','dgmg')) $$;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text NOT NULL,metadata jsonb,UNIQUE(bucket_id,name));
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon,service_role;
 GRANT ALL ON storage.objects,storage.buckets TO service_role;
 GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,anon;
 CREATE POLICY test_existing_broad_policy ON storage.objects FOR ALL TO authenticated,anon USING(true) WITH CHECK(true);
 INSERT INTO public.snp_ministries(code) VALUES('MEMC');`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20260906174800_dossiers_comptoirs_entreprises.sql',import.meta.url),'utf8'));
 return db;
}
export async function comptoirTestActor(db,id,role='authenticated',aal='aal2',session='active') {
 await db.exec('RESET ROLE');
 await db.query("SELECT set_config('test.uid',$1,false),set_config('test.role',$2,false),set_config('test.aal',$3,false),set_config('test.session',$4,false)",[id??'',role,aal,session]);
 if(!['authenticated','anon','service_role'].includes(role))throw new Error('Invalid test role');
 await db.exec(`SET ROLE ${role}`);
}
