-- Structural subset of the observed schema. Isolated test users and capabilities only.
CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE TABLE public.test_profiles(id uuid PRIMARY KEY,active boolean DEFAULT true,capabilities text[],scope uuid);
CREATE FUNCTION public.snp_session_est_active() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('test.session',true),'')='active' AND EXISTS(SELECT 1 FROM public.test_profiles WHERE id=auth.uid() AND active) $$;
CREATE FUNCTION public.snp_mfa_satisfaite() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.aal',true)='aal2' $$;
CREATE FUNCTION public.snp_actor_has_capability(text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT coalesce((SELECT $1=ANY(capabilities) AND active FROM public.test_profiles WHERE id=auth.uid()),false) AND public.snp_mfa_satisfaite() AND public.snp_session_est_active() $$;
CREATE FUNCTION public.snp_can_access_artisan(uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT coalesce((SELECT active AND (scope IS NULL OR scope=$1) FROM public.test_profiles WHERE id=auth.uid()),false) $$;
CREATE TABLE public.snp_capability_catalog(code text PRIMARY KEY,domain text,label text,description text,sensitive boolean);
CREATE TABLE public.snp_role_capabilities(role text,capability_code text,PRIMARY KEY(role,capability_code));
CREATE TABLE public.artisanal_sites(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text);
CREATE TABLE public.snp_artisans_miniers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),numero_carte text UNIQUE,type_personne text,type_artisan text,nom text,prenoms text,raison_sociale text,photo_url text,commune text,artisanal_site_id uuid,exploitant_id uuid,actif boolean DEFAULT true);
ALTER TABLE public.snp_artisans_miniers ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.snp_artisans_miniers TO authenticated;
CREATE POLICY artisan_read ON public.snp_artisans_miniers FOR SELECT TO authenticated USING(public.snp_can_access_artisan(id));
CREATE TABLE public.snp_artisan_responsables(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),artisan_id uuid UNIQUE,nom text,prenoms text);
CREATE TABLE public.snp_cartes_professionnelles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),artisan_id uuid NOT NULL REFERENCES public.snp_artisans_miniers(id),numero_carte text UNIQUE NOT NULL,
 date_emission date NOT NULL,date_expiration date NOT NULL,date_validation date,date_suspension date,statut text NOT NULL CHECK(statut IN ('en_cours','validee','en_exploitation','expiree','suspendue','annulee')),
 validee_par uuid,validee_le timestamptz,suspendue_par uuid,suspendue_le timestamptz,motif_suspension text,observations text,created_by uuid,updated_by uuid,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE public.snp_artisan_ventes_or(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),artisan_id uuid NOT NULL,statut text DEFAULT 'en_attente');
CREATE TABLE public.snp_artisan_paiements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),artisan_id uuid NOT NULL,statut text DEFAULT 'en_attente');
CREATE TABLE public.snp_workflow_audit(id bigserial PRIMARY KEY,aggregate_type text,aggregate_id uuid,action text,status_before text,status_after text,actor_id uuid,capability_code text,reason text,context jsonb,occurred_at timestamptz DEFAULT now());
CREATE TABLE public.snp_workflow_notification_outbox(id bigserial PRIMARY KEY,event_key text UNIQUE,event_type text,aggregate_type text,aggregate_id uuid,payload jsonb);
CREATE FUNCTION public.snp_record_workflow_event(text,uuid,text,text,text,text,text,jsonb) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$ DECLARE i bigint; BEGIN INSERT INTO public.snp_workflow_audit(aggregate_type,aggregate_id,action,status_before,status_after,capability_code,reason,context,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,auth.uid()) RETURNING id INTO i; RETURN i; END $$;
CREATE FUNCTION public.snp_4b_can_manage_artisan(uuid,text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT public.snp_actor_has_capability($2) AND EXISTS(SELECT 1 FROM public.snp_artisans_miniers WHERE id=$1) AND public.snp_can_access_artisan($1) $$;
CREATE FUNCTION public.snp_4b_require_trusted_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF current_user IN ('anon','authenticated') THEN RAISE EXCEPTION 'Mutation directe interdite' USING ERRCODE='42501'; END IF; RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END $$;
CREATE TRIGGER rpc_only BEFORE INSERT OR UPDATE OR DELETE ON public.snp_cartes_professionnelles FOR EACH ROW EXECUTE FUNCTION public.snp_4b_require_trusted_mutation();
CREATE FUNCTION public.trigger_check_carte_expiration() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE TRIGGER trigger_carte_expiration_desactivation AFTER INSERT OR UPDATE ON public.snp_cartes_professionnelles FOR EACH ROW EXECUTE FUNCTION public.trigger_check_carte_expiration();
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb,UNIQUE(bucket_id,name));
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON storage.objects TO authenticated;
REVOKE ALL ON public.snp_cartes_professionnelles FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.snp_cartes_professionnelles TO authenticated;
ALTER TABLE public.snp_cartes_professionnelles ENABLE ROW LEVEL SECURITY;
CREATE POLICY cards_read ON public.snp_cartes_professionnelles FOR SELECT TO authenticated USING(public.snp_can_access_artisan(artisan_id));

GRANT USAGE ON SCHEMA auth TO authenticated,anon;
GRANT USAGE ON SCHEMA storage TO authenticated;
