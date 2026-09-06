BEGIN;

-- Référentiel artisanal : la catégorie documentaire est distincte du statut d'activité.
ALTER TABLE public.artisanal_sites
  ADD COLUMN IF NOT EXISTS formalization text,
  ADD COLUMN IF NOT EXISTS aea_number text,
  ADD COLUMN IF NOT EXISTS aea_issued_on date,
  ADD COLUMN IF NOT EXISTS aea_duration_months integer,
  ADD COLUMN IF NOT EXISTS aea_document_path text,
  ADD COLUMN IF NOT EXISTS aea_document_name text,
  ADD COLUMN IF NOT EXISTS legacy_exploitation_type text;
UPDATE public.artisanal_sites SET legacy_exploitation_type = exploitation_type,
  exploitation_type = 'artisanale' WHERE exploitation_type <> 'artisanale';
ALTER TABLE public.artisanal_sites
  ADD CONSTRAINT artisanal_site_type_only CHECK (exploitation_type = 'artisanale'),
  ADD CONSTRAINT artisanal_site_formalization_check CHECK (formalization IN ('formalized','non_formalized')),
  ADD CONSTRAINT artisanal_site_aea_check CHECK (
    formalization IS DISTINCT FROM 'formalized' OR (
      aea_number IS NOT NULL AND length(btrim(aea_number)) BETWEEN 1 AND 120
      AND aea_issued_on IS NOT NULL AND aea_issued_on BETWEEN DATE '1900-01-01' AND DATE '9899-12-31'
      AND aea_duration_months IS NOT NULL AND aea_duration_months BETWEEN 1 AND 1200
      AND aea_document_path IS NOT NULL AND length(aea_document_path) > 0
      AND aea_document_name IS NOT NULL AND length(aea_document_name) > 0
    ));
COMMENT ON COLUMN public.artisanal_sites.formalization IS 'Catégorie déclarée ; NULL = dossier historique à renseigner, sans présumer une absence d’AEA.';
COMMENT ON COLUMN public.artisanal_sites.legacy_exploitation_type IS 'Ancien classement conservé lors de l’unification du registre artisanal.';

-- Autorité de gestion nationale. Les opérations commerciales ont leurs propres droits.
CREATE OR REPLACE FUNCTION public.snp_peut_gerer_sites_artisanaux()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
  SELECT public.snp_mfa_satisfaite() AND EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND is_active
      AND mining_company_id IS NULL AND role IN ('owner','admin','dgmg')
  );
$fn$;
REVOKE ALL ON FUNCTION public.snp_peut_gerer_sites_artisanaux() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_peut_gerer_sites_artisanaux() TO authenticated;
COMMENT ON FUNCTION public.snp_peut_gerer_sites_artisanaux() IS 'Gestion des référentiels miniers par DGMG et administrateur ; accès global Owner conservé, MFA requise.';

CREATE POLICY snp_sites_artisanaux_consultation ON public.artisanal_sites FOR SELECT TO authenticated
USING (public.snp_mfa_satisfaite() AND EXISTS (
  SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND is_active AND mining_company_id IS NULL
  AND role IN ('owner','admin','dgmg','management','manager')));
-- La gestion documentaire n'accorde pas la suppression des sites à la DGMG.
CREATE POLICY snp_sites_delete_registry_boundary ON public.artisanal_sites AS RESTRICTIVE FOR DELETE TO authenticated
USING(EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role IN ('owner','admin')));
CREATE POLICY snp_assignments_delete_registry_boundary ON public.artisanal_site_assignments AS RESTRICTIVE FOR DELETE TO authenticated
USING(EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role IN ('owner','admin')));
CREATE POLICY snp_affectations_sites_consultation ON public.artisanal_site_assignments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.artisanal_sites WHERE id=site_id));

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('artisanal-site-aea','artisanal-site-aea',false,10485760,ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;
CREATE POLICY snp_aea_read ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id='artisanal-site-aea' AND (
    public.snp_peut_gerer_sites_artisanaux() OR EXISTS (
      SELECT 1 FROM public.artisanal_sites s WHERE s.aea_document_path=storage.objects.name)));
CREATE POLICY snp_aea_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='artisanal-site-aea' AND public.snp_peut_gerer_sites_artisanaux()
  AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$');
-- Restrictions opposables aux autres politiques Storage historiques.
CREATE POLICY snp_aea_read_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING (
  bucket_id<>'artisanal-site-aea' OR public.snp_peut_gerer_sites_artisanaux() OR EXISTS (
    SELECT 1 FROM public.artisanal_sites s WHERE s.aea_document_path=storage.objects.name));
CREATE POLICY snp_aea_insert_boundary ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  bucket_id<>'artisanal-site-aea' OR (public.snp_peut_gerer_sites_artisanaux()
    AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$'));
CREATE POLICY snp_aea_update_boundary ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
USING(bucket_id<>'artisanal-site-aea') WITH CHECK(bucket_id<>'artisanal-site-aea');
CREATE POLICY snp_aea_delete_boundary ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING (
  bucket_id<>'artisanal-site-aea' OR (public.snp_peut_gerer_sites_artisanaux()
    AND NOT EXISTS(SELECT 1 FROM public.artisanal_sites s WHERE s.aea_document_path=storage.objects.name)));
-- Un justificatif déjà rattaché reste protégé si la réponse réseau de la sauvegarde est perdue.
CREATE POLICY snp_aea_remove_draft ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id='artisanal-site-aea' AND public.snp_peut_gerer_sites_artisanaux()
  AND NOT EXISTS (SELECT 1 FROM public.artisanal_sites s WHERE s.aea_document_path=storage.objects.name));

CREATE OR REPLACE FUNCTION public.snp_check_artisanal_site_aea()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF NEW.formalization IS NULL THEN RAISE EXCEPTION 'Choisissez la catégorie du site.' USING ERRCODE='23514'; END IF;
  IF NEW.formalization='formalized' THEN
    IF split_part(NEW.aea_document_path,'/',1) IS DISTINCT FROM NEW.id::text
      OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='artisanal-site-aea' AND name=NEW.aea_document_path)
    THEN RAISE EXCEPTION 'Le justificatif AEA doit être déposé pour ce site.' USING ERRCODE='23514'; END IF;
  ELSE
    NEW.aea_number:=NULL; NEW.aea_issued_on:=NULL; NEW.aea_duration_months:=NULL;
    NEW.aea_document_path:=NULL; NEW.aea_document_name:=NULL;
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.snp_check_artisanal_site_aea() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER snp_artisanal_site_aea_guard BEFORE INSERT OR UPDATE ON public.artisanal_sites
FOR EACH ROW EXECUTE FUNCTION public.snp_check_artisanal_site_aea();

-- Sauvegarde atomique des références du site et de ses deux responsables sous RLS.
CREATE OR REPLACE FUNCTION public.snp_save_artisanal_site(p_site jsonb,p_assignments jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_site public.artisanal_sites; v_saved public.artisanal_sites; v_contact record;
BEGIN
  IF NOT public.snp_peut_gerer_sites_artisanaux() THEN RAISE EXCEPTION 'Gestion réservée à la DGMG et à l’administrateur.' USING ERRCODE='42501'; END IF;
  v_site:=jsonb_populate_record(NULL::public.artisanal_sites,p_site);
  IF jsonb_typeof(p_assignments) IS DISTINCT FROM 'array' OR jsonb_array_length(p_assignments)<>2 THEN
    RAISE EXCEPTION 'Deux responsables sont obligatoires.' USING ERRCODE='23514'; END IF;
  IF (SELECT count(DISTINCT value->>'role') FROM jsonb_array_elements(p_assignments)
      WHERE value->>'role' IN ('site_manager','collection_officer') AND length(btrim(value->>'full_name'))>0 AND length(btrim(value->>'phone'))>0)<>2 THEN
    RAISE EXCEPTION 'Le nom et le téléphone de chaque responsable sont obligatoires.' USING ERRCODE='23514'; END IF;
  INSERT INTO public.artisanal_sites(id,code,name,status,region,province,locality,area_hectares,exploitation_type,
    formalization,aea_number,aea_issued_on,aea_duration_months,aea_document_path,aea_document_name,
    authorized_miners,active_miners,average_hole_depth_m,authorized_chemicals,latitude,longitude,photos,notes,created_by,updated_by)
  VALUES(v_site.id,v_site.code,btrim(v_site.name),v_site.status,v_site.region,v_site.province,v_site.locality,v_site.area_hectares,'artisanale',
    v_site.formalization,v_site.aea_number,v_site.aea_issued_on,v_site.aea_duration_months,v_site.aea_document_path,v_site.aea_document_name,
    v_site.authorized_miners,v_site.active_miners,v_site.average_hole_depth_m,v_site.authorized_chemicals,v_site.latitude,v_site.longitude,v_site.photos,v_site.notes,auth.uid(),auth.uid())
  ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,status=EXCLUDED.status,region=EXCLUDED.region,province=EXCLUDED.province,
    locality=EXCLUDED.locality,area_hectares=EXCLUDED.area_hectares,exploitation_type='artisanale',formalization=EXCLUDED.formalization,
    aea_number=EXCLUDED.aea_number,aea_issued_on=EXCLUDED.aea_issued_on,aea_duration_months=EXCLUDED.aea_duration_months,
    aea_document_path=EXCLUDED.aea_document_path,aea_document_name=EXCLUDED.aea_document_name,
    authorized_miners=EXCLUDED.authorized_miners,active_miners=EXCLUDED.active_miners,average_hole_depth_m=EXCLUDED.average_hole_depth_m,
    authorized_chemicals=EXCLUDED.authorized_chemicals,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,photos=EXCLUDED.photos,
    notes=EXCLUDED.notes,updated_by=auth.uid()
  RETURNING * INTO v_saved;
  FOR v_contact IN SELECT * FROM jsonb_to_recordset(p_assignments) AS c(role text,full_name text,phone text,email text,user_id uuid) LOOP
    INSERT INTO public.artisanal_site_assignments(site_id,role,full_name,phone,email,user_id)
    VALUES(v_saved.id,v_contact.role,btrim(v_contact.full_name),btrim(v_contact.phone),v_contact.email,v_contact.user_id)
    ON CONFLICT(site_id,role) DO UPDATE SET full_name=EXCLUDED.full_name,phone=EXCLUDED.phone,email=EXCLUDED.email,user_id=EXCLUDED.user_id;
  END LOOP;
  RETURN jsonb_build_object('site',to_jsonb(v_saved),'assignments',
    (SELECT jsonb_agg(to_jsonb(a)) FROM public.artisanal_site_assignments a WHERE site_id=v_saved.id));
END;
$fn$;
REVOKE ALL ON FUNCTION public.snp_save_artisanal_site(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_save_artisanal_site(jsonb,jsonb) TO authenticated;

-- Création des autres acteurs du référentiel, avec restriction également côté base.
DROP POLICY snp_mining_companies_insert_admin ON public.mining_companies;
CREATE POLICY snp_mining_companies_insert_admin ON public.mining_companies FOR INSERT TO authenticated
WITH CHECK(public.snp_peut_gerer_sites_artisanaux());
CREATE POLICY snp_mining_companies_registry_read ON public.mining_companies FOR SELECT TO authenticated USING(public.snp_peut_gerer_sites_artisanaux());
CREATE POLICY snp_mining_companies_registry_update ON public.mining_companies FOR UPDATE TO authenticated
USING(public.snp_peut_gerer_sites_artisanaux()) WITH CHECK(public.snp_peut_gerer_sites_artisanaux());
DROP POLICY snp_artisans_insert_internal_restrictive ON public.snp_artisans_miniers;
CREATE POLICY snp_artisans_insert_internal_restrictive ON public.snp_artisans_miniers AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK(public.snp_peut_gerer_sites_artisanaux());
DROP POLICY snp_artisans_perimeter_restrictive ON public.snp_artisans_miniers;
CREATE POLICY snp_artisans_perimeter_restrictive ON public.snp_artisans_miniers AS RESTRICTIVE FOR SELECT TO authenticated
USING(public.snp_peut_gerer_sites_artisanaux() OR public.snp_can_access_artisan(id));
DROP POLICY snp_artisans_update_perimeter_restrictive ON public.snp_artisans_miniers;
CREATE POLICY snp_artisans_update_perimeter_restrictive ON public.snp_artisans_miniers AS RESTRICTIVE FOR UPDATE TO authenticated
USING(public.snp_peut_gerer_sites_artisanaux() OR public.snp_can_access_artisan(id))
WITH CHECK(public.snp_peut_gerer_sites_artisanaux() OR public.snp_can_access_artisan(id));
CREATE POLICY snp_comptoirs_registry_read ON public.snp_organizations FOR SELECT TO authenticated
USING(organization_type='comptoir' AND public.snp_peut_gerer_sites_artisanaux());

CREATE OR REPLACE FUNCTION public.snp_guard_comptoir_registry_creation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF NEW.organization_type='comptoir' AND (TG_OP='INSERT' OR OLD.organization_type IS DISTINCT FROM NEW.organization_type) AND auth.uid() IS NOT NULL AND NOT public.snp_peut_gerer_sites_artisanaux() THEN
    RAISE EXCEPTION 'La création des comptoirs est réservée à la DGMG et à l’administrateur.' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.snp_guard_comptoir_registry_creation() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER snp_comptoir_registry_creation BEFORE INSERT OR UPDATE OF organization_type ON public.snp_organizations
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_comptoir_registry_creation();

CREATE OR REPLACE FUNCTION public.snp_save_organization(
  p_id uuid,
  p_code text,
  p_name text,
  p_short_name text,
  p_organization_type text,
  p_organization_subtype text,
  p_supervising_ministry_id uuid,
  p_parent_organization_id uuid,
  p_mining_company_id uuid,
  p_source_artisan_id uuid,
  p_legal_form text,
  p_email text,
  p_phone text,
  p_address text,
  p_website text,
  p_administrative_region text,
  p_zone_code text,
  p_service_code text,
  p_notes text,
  p_is_active boolean,
  p_scope_metadata jsonb
) RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_id uuid := COALESCE(p_id, gen_random_uuid());
  v_code text := upper(trim(COALESCE(p_code, '')));
  v_name text := trim(COALESCE(p_name, ''));
BEGIN
  IF p_organization_type='comptoir' AND public.snp_peut_gerer_sites_artisanaux() THEN
    IF p_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.snp_organizations WHERE id=p_id AND organization_type='comptoir') THEN
      RAISE EXCEPTION 'Le dossier doit être un comptoir existant.' USING ERRCODE='42501'; END IF;
  ELSE
    PERFORM public.snp_require_capability('referentials.manage');
    IF p_id IS NULL AND p_organization_type='comptoir' THEN
      RAISE EXCEPTION 'La création des comptoirs est réservée à la DGMG et à l’administrateur.' USING ERRCODE='42501'; END IF;
  END IF;

  IF v_code !~ '^[A-Z0-9][A-Z0-9._-]{1,29}$' THEN
    RAISE EXCEPTION 'Le code de l’organisation est invalide.' USING ERRCODE='22023';
  END IF;
  IF length(v_name)<3 OR length(v_name)>180 THEN
    RAISE EXCEPTION 'Le nom de l’organisation doit contenir entre 3 et 180 caractères.' USING ERRCODE='22023';
  END IF;
  IF p_organization_type NOT IN (
    'sonasp','dgmg','dgi','public_institution','mine','comptoir','collector',
    'factory','airport','refinery','customer'
  ) THEN
    RAISE EXCEPTION 'Le type d’organisation est invalide.' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.snp_ministries ministry
    WHERE ministry.id=p_supervising_ministry_id AND ministry.is_active
  ) THEN
    RAISE EXCEPTION 'Le ministère de tutelle est obligatoire et doit être actif.' USING ERRCODE='23502';
  END IF;
  IF p_parent_organization_id=v_id OR (
    p_parent_organization_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.snp_organizations parent
      WHERE parent.id=p_parent_organization_id AND parent.is_active
    )
  ) THEN
    RAISE EXCEPTION 'L’organisation parente est invalide.' USING ERRCODE='23503';
  END IF;
  IF p_organization_type='mine' AND p_mining_company_id IS NULL THEN
    RAISE EXCEPTION 'La société minière liée est obligatoire.' USING ERRCODE='23502';
  END IF;
  IF p_organization_type='collector' AND p_source_artisan_id IS NULL THEN
    RAISE EXCEPTION 'Le profil collecteur lié est obligatoire.' USING ERRCODE='23502';
  END IF;
  IF NULLIF(trim(COALESCE(p_email,'')),'') IS NOT NULL
     AND trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'L’adresse e-mail est invalide.' USING ERRCODE='22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.snp_organizations (
      id, code, name, short_name, organization_type, organization_subtype,
      supervising_ministry_id, parent_organization_id, mining_company_id,
      source_artisan_id, legal_form, email, phone, address, website,
      administrative_region, zone_code, service_code, notes, is_active,
      scope_metadata, created_by, updated_at
    ) VALUES (
      v_id, v_code, v_name, nullif(trim(p_short_name),''), p_organization_type,
      nullif(trim(p_organization_subtype),''), p_supervising_ministry_id,
      p_parent_organization_id,
      CASE WHEN p_organization_type='mine' THEN p_mining_company_id ELSE NULL END,
      CASE WHEN p_organization_type='collector' THEN p_source_artisan_id ELSE NULL END,
      nullif(trim(p_legal_form),''), nullif(trim(p_email),''), nullif(trim(p_phone),''),
      nullif(trim(p_address),''), nullif(trim(p_website),''),
      nullif(trim(p_administrative_region),''), nullif(trim(p_zone_code),''),
      nullif(trim(p_service_code),''), nullif(trim(p_notes),''), coalesce(p_is_active,true),
      coalesce(p_scope_metadata,'{}'::jsonb), auth.uid(), now()
    );
  ELSE
    UPDATE public.snp_organizations SET
      code=v_code,
      name=v_name,
      short_name=nullif(trim(p_short_name),''),
      organization_type=p_organization_type,
      organization_subtype=nullif(trim(p_organization_subtype),''),
      supervising_ministry_id=p_supervising_ministry_id,
      parent_organization_id=p_parent_organization_id,
      mining_company_id=CASE WHEN p_organization_type='mine' THEN p_mining_company_id ELSE NULL END,
      source_artisan_id=CASE WHEN p_organization_type='collector' THEN p_source_artisan_id ELSE NULL END,
      legal_form=nullif(trim(p_legal_form),''),
      email=nullif(trim(p_email),''),
      phone=nullif(trim(p_phone),''),
      address=nullif(trim(p_address),''),
      website=nullif(trim(p_website),''),
      administrative_region=nullif(trim(p_administrative_region),''),
      zone_code=nullif(trim(p_zone_code),''),
      service_code=nullif(trim(p_service_code),''),
      notes=nullif(trim(p_notes),''),
      is_active=coalesce(p_is_active,true),
      scope_metadata=coalesce(p_scope_metadata,'{}'::jsonb),
      updated_at=now()
    WHERE id=p_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Organisation introuvable.' USING ERRCODE='P0002';
    END IF;
  END IF;

  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_save_organization(
  uuid,text,text,text,text,text,uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,boolean,jsonb
) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.snp_save_organization(
  uuid,text,text,text,text,text,uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,boolean,jsonb
) TO authenticated;


-- Pièces et coordonnées attachées aux sociétés minières du référentiel.
CREATE POLICY snp_company_registry_documents_read ON public.mining_company_documents FOR SELECT TO authenticated
USING(public.snp_peut_gerer_sites_artisanaux());
CREATE POLICY snp_company_registry_storage_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='mining-company-documents' AND public.snp_peut_gerer_sites_artisanaux());
CREATE POLICY snp_company_registry_bank_accounts ON public.stakeholder_bank_accounts FOR ALL TO authenticated
USING(stakeholder_type='mining_company' AND public.snp_peut_gerer_sites_artisanaux())
WITH CHECK(stakeholder_type='mining_company' AND public.snp_peut_gerer_sites_artisanaux()
  AND EXISTS(SELECT 1 FROM public.mining_companies WHERE id=stakeholder_id));

-- La supervision des sites requiert la lecture de leurs déclarations, sans droit commercial.
CREATE POLICY snp_registry_sales_read ON public.snp_artisan_ventes_or FOR SELECT TO authenticated
USING(public.snp_peut_gerer_sites_artisanaux());
DROP POLICY snp_artisan_child_perimeter_restrictive ON public.snp_artisan_documents;
CREATE POLICY snp_artisan_documents_registry_select ON public.snp_artisan_documents AS RESTRICTIVE FOR SELECT TO authenticated
USING(public.snp_peut_gerer_sites_artisanaux() OR public.snp_can_access_artisan(artisan_id));
CREATE POLICY snp_artisan_documents_registry_insert ON public.snp_artisan_documents AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK(public.snp_peut_gerer_sites_artisanaux() OR public.snp_can_access_artisan(artisan_id));
CREATE POLICY snp_artisan_documents_existing_update ON public.snp_artisan_documents AS RESTRICTIVE FOR UPDATE TO authenticated
USING(public.snp_can_access_artisan(artisan_id)) WITH CHECK(public.snp_can_access_artisan(artisan_id));
CREATE POLICY snp_artisan_documents_existing_delete ON public.snp_artisan_documents AS RESTRICTIVE FOR DELETE TO authenticated
USING(public.snp_can_access_artisan(artisan_id));
CREATE POLICY snp_artisan_registry_storage_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='artisan-documents' AND public.snp_peut_gerer_sites_artisanaux());

UPDATE public.snp_navigation_groups SET name='Sites artisanaux & Artisans'
WHERE code='semi-mecanise';
UPDATE public.snp_modules SET nom='Sites artisanaux' WHERE code='mining_sites';

NOTIFY pgrst, 'reload schema';
COMMIT;
