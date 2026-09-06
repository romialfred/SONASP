-- Additive dossier contract. No historical record is deleted or reclassified.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.snp_peut_gerer_sites_artisanaux()') IS NULL THEN
    RAISE EXCEPTION 'Le référentiel minier doit être installé avant le dossier artisan.';
  END IF;
END $$;

ALTER TABLE public.snp_artisans_miniers
  ADD COLUMN dossier_version smallint NOT NULL DEFAULT 0,
  ADD COLUMN numero_ifu text,
  ADD COLUMN whatsapp text,
  ADD COLUMN whatsapp_identique boolean NOT NULL DEFAULT false,
  ADD COLUMN siege_pays text,
  ADD COLUMN siege_region text,
  ADD COLUMN siege_commune text,
  ADD COLUMN siege_adresse text,
  ADD COLUMN exploitant_id uuid REFERENCES public.snp_artisans_miniers(id) ON DELETE RESTRICT,
  ADD COLUMN creation_fingerprint text;
ALTER TABLE public.snp_artisans_miniers ALTER COLUMN dossier_version SET DEFAULT 1;
ALTER TABLE public.snp_artisans_miniers DROP CONSTRAINT snp_artisans_miniers_type_artisan_check;
ALTER TABLE public.snp_artisans_miniers ADD CONSTRAINT snp_artisans_miniers_type_artisan_check
  CHECK(type_artisan IN ('exploitant','collecteur','intermediaire','fournisseur','aide_exploitant'));
ALTER TABLE public.snp_artisans_miniers ADD CONSTRAINT snp_artisan_aide_parent_check
  CHECK((type_artisan='aide_exploitant' AND exploitant_id IS NOT NULL AND exploitant_id<>id AND artisanal_site_id IS NULL)
    OR (type_artisan<>'aide_exploitant' AND exploitant_id IS NULL));
CREATE INDEX snp_artisans_exploitant_idx ON public.snp_artisans_miniers(exploitant_id) WHERE exploitant_id IS NOT NULL;
CREATE INDEX snp_artisans_exploitant_search_idx ON public.snp_artisans_miniers(type_artisan,nom,raison_sociale) WHERE actif;

CREATE TABLE public.snp_artisan_responsables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid NOT NULL UNIQUE REFERENCES public.snp_artisans_miniers(id) ON DELETE RESTRICT,
  nom text NOT NULL, prenoms text NOT NULL, date_naissance date NOT NULL,
  telephone text NOT NULL, whatsapp text, whatsapp_identique boolean NOT NULL DEFAULT false,
  email text, fonction text NOT NULL,
  type_piece_identite text NOT NULL CHECK(type_piece_identite IN ('CNI','Passeport','Permis','Autre')),
  numero_piece_identite text NOT NULL, date_delivrance_piece date, date_expiration_piece date, lieu_delivrance_piece text,
  UNIQUE(id,artisan_id)
);
ALTER TABLE public.snp_artisan_responsables ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.snp_artisan_responsables TO authenticated;
CREATE POLICY artisan_responsable_read ON public.snp_artisan_responsables FOR SELECT TO authenticated
  USING(public.snp_peut_gerer_sites_artisanaux() OR public.snp_can_access_artisan(artisan_id));
CREATE POLICY artisan_responsable_insert ON public.snp_artisan_responsables FOR INSERT TO authenticated
  WITH CHECK(public.snp_peut_gerer_sites_artisanaux() OR public.snp_can_access_artisan(artisan_id));
CREATE POLICY artisan_responsable_update ON public.snp_artisan_responsables FOR UPDATE TO authenticated
  USING(public.snp_peut_gerer_sites_artisanaux() OR public.snp_can_access_artisan(artisan_id))
  WITH CHECK(public.snp_peut_gerer_sites_artisanaux() OR public.snp_can_access_artisan(artisan_id));

CREATE TABLE public.snp_artisan_dossier_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  artisan_id uuid NOT NULL REFERENCES public.snp_artisans_miniers(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, ancien_role text, nouveau_role text, ancien_exploitant_id uuid, nouvel_exploitant_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX snp_artisan_dossier_audit_parent_idx ON public.snp_artisan_dossier_audit(artisan_id,created_at);
ALTER TABLE public.snp_artisan_dossier_audit ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.snp_artisan_dossier_audit TO authenticated;
CREATE POLICY artisan_dossier_audit_read ON public.snp_artisan_dossier_audit FOR SELECT TO authenticated
  USING(public.snp_peut_gerer_sites_artisanaux() OR public.snp_can_access_artisan(artisan_id));

CREATE FUNCTION public.snp_artisan_validate_contact(p_telephone text,p_email text,p_whatsapp text)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF coalesce(regexp_replace(p_telephone,'[[:space:]().-]','','g'),'') !~ '^\+[1-9][0-9]{6,14}$'
    OR (nullif(p_whatsapp,'') IS NOT NULL AND regexp_replace(p_whatsapp,'[[:space:]().-]','','g') !~ '^\+[1-9][0-9]{6,14}$') THEN
    RAISE EXCEPTION 'Saisissez un numéro international valide avec indicatif.' USING ERRCODE='23514';
  END IF;
  IF nullif(p_email,'') IS NOT NULL AND p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'L’adresse e-mail est invalide.' USING ERRCODE='23514'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.snp_artisan_validate_contact(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_artisan_validate_contact(text,text,text) TO authenticated;

CREATE FUNCTION public.snp_guard_artisan_dossier() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.snp_artisans_miniers; changed_identity boolean; inactive_fields text[]; inactive_values jsonb; previous_inactive jsonb;
BEGIN
  -- The registry is low-volume. One transaction lock also serializes the existing MAX-based card numbering.
  PERFORM pg_advisory_xact_lock(60906111030);
  IF TG_OP='INSERT' AND NEW.dossier_version<>1 THEN RAISE EXCEPTION 'Un nouveau dossier doit respecter le formulaire courant.'; END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.dossier_version<OLD.dossier_version THEN RAISE EXCEPTION 'La version du dossier ne peut pas être rétrogradée.'; END IF;
    IF NEW.type_personne IS DISTINCT FROM OLD.type_personne THEN
      RAISE EXCEPTION 'La qualité juridique d’un dossier existant ne peut pas être convertie dans ce formulaire. Conservez son historique et créez le dossier approprié.' USING ERRCODE='23514';
    END IF;
    IF (NEW.type_artisan IS DISTINCT FROM OLD.type_artisan OR (OLD.actif AND NOT NEW.actif))
      AND EXISTS(SELECT 1 FROM public.snp_artisans_miniers WHERE exploitant_id=OLD.id) THEN
      RAISE EXCEPTION 'Des aides sont rattachés à cet exploitant. Réaffectez-les avant ce changement.' USING ERRCODE='23514'; END IF;
  END IF;
  IF NEW.type_artisan='aide_exploitant' THEN
    SELECT * INTO p FROM public.snp_artisans_miniers WHERE id=NEW.exploitant_id FOR UPDATE;
    IF p.id IS NULL OR p.type_artisan<>'exploitant' OR NOT p.actif OR p.id=NEW.id THEN
      RAISE EXCEPTION 'Choisissez un exploitant actif accessible dans votre périmètre.' USING ERRCODE='23514'; END IF;
    IF (TG_OP='INSERT' OR NEW.exploitant_id IS DISTINCT FROM OLD.exploitant_id OR NEW.type_artisan IS DISTINCT FROM OLD.type_artisan)
      AND NOT (public.snp_peut_gerer_sites_artisanaux() OR public.snp_can_access_artisan(p.id)) THEN
      RAISE EXCEPTION 'Choisissez un exploitant actif accessible dans votre périmètre.' USING ERRCODE='42501'; END IF;
  END IF;
  IF NEW.dossier_version=0 THEN RETURN NEW; END IF;
  -- Raw table writes must obey the same branch boundaries as the form RPC.
  -- Unchanged historical values are retained rather than erased during upgrades.
  inactive_fields:=CASE WHEN NEW.type_personne='physique' THEN ARRAY['raison_sociale','numero_registre_commerce','numero_ifu','siege_pays','siege_region','siege_commune','siege_adresse']
    ELSE ARRAY['nom','prenoms','date_naissance','lieu_naissance','nationalite','sexe','type_piece_identite','numero_piece_identite','date_delivrance_piece','date_expiration_piece','lieu_delivrance_piece','photo_url'] END;
  SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO inactive_values FROM jsonb_each(to_jsonb(NEW)) WHERE key=ANY(inactive_fields) AND value NOT IN ('null'::jsonb,'""'::jsonb);
  IF TG_OP='UPDATE' THEN
    SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO previous_inactive FROM jsonb_each(to_jsonb(OLD)) WHERE key=ANY(inactive_fields) AND value NOT IN ('null'::jsonb,'""'::jsonb);
  END IF;
  IF inactive_values<>'{}'::jsonb AND (TG_OP='INSERT' OR inactive_values IS DISTINCT FROM previous_inactive) THEN
    RAISE EXCEPTION 'Les champs doivent correspondre à la qualité juridique du dossier.' USING ERRCODE='23514'; END IF;
  IF NEW.dossier_version<>1 OR nullif(btrim(NEW.region),'') IS NULL OR nullif(btrim(NEW.commune),'') IS NULL OR nullif(btrim(NEW.pays),'') IS NULL THEN
    RAISE EXCEPTION 'Le pays, la région et la commune sont obligatoires.' USING ERRCODE='23514'; END IF;
  IF NEW.whatsapp_identique THEN NEW.whatsapp:=NEW.telephone; END IF;
  PERFORM public.snp_artisan_validate_contact(NEW.telephone,NEW.email,NEW.whatsapp);
  IF NEW.type_personne='physique' THEN
    IF nullif(btrim(NEW.nom),'') IS NULL OR NEW.date_naissance IS NULL OR NEW.date_naissance>CURRENT_DATE-INTERVAL '18 years'
      OR NEW.type_piece_identite IS NULL OR nullif(btrim(NEW.numero_piece_identite),'') IS NULL THEN
      RAISE EXCEPTION 'Le nom, une naissance valide (18 ans minimum) et les références de la pièce sont obligatoires.' USING ERRCODE='23514'; END IF;
    IF NEW.date_delivrance_piece>CURRENT_DATE OR NEW.date_expiration_piece<NEW.date_delivrance_piece THEN
      RAISE EXCEPTION 'Les dates de la pièce d’identité sont incohérentes.' USING ERRCODE='23514'; END IF;
    changed_identity:=TG_OP='INSERT';
    IF TG_OP='UPDATE' THEN changed_identity := ROW(NEW.pays,NEW.type_piece_identite,NEW.numero_piece_identite) IS DISTINCT FROM ROW(OLD.pays,OLD.type_piece_identite,OLD.numero_piece_identite); END IF;
    IF changed_identity AND EXISTS(SELECT 1 FROM public.snp_artisans_miniers a WHERE a.id<>NEW.id AND a.type_personne='physique'
      AND a.pays=NEW.pays AND a.type_piece_identite=NEW.type_piece_identite AND lower(btrim(a.numero_piece_identite))=lower(btrim(NEW.numero_piece_identite))) THEN
      RAISE EXCEPTION 'Un dossier possède déjà cette pièce d’identité dans ce pays.' USING ERRCODE='23505'; END IF;
  ELSE
    IF nullif(btrim(NEW.raison_sociale),'') IS NULL OR nullif(btrim(NEW.numero_registre_commerce),'') IS NULL OR nullif(btrim(NEW.numero_ifu),'') IS NULL
      OR nullif(btrim(NEW.siege_pays),'') IS NULL OR nullif(btrim(NEW.siege_region),'') IS NULL OR nullif(btrim(NEW.siege_commune),'') IS NULL OR nullif(btrim(NEW.siege_adresse),'') IS NULL THEN
      RAISE EXCEPTION 'La raison sociale, le RCCM, l’IFU et l’adresse du siège sont obligatoires.' USING ERRCODE='23514'; END IF;
    changed_identity:=TG_OP='INSERT';
    IF TG_OP='UPDATE' THEN changed_identity:=ROW(NEW.siege_pays,NEW.numero_registre_commerce,NEW.numero_ifu) IS DISTINCT FROM ROW(OLD.siege_pays,OLD.numero_registre_commerce,OLD.numero_ifu); END IF;
    IF changed_identity AND EXISTS(SELECT 1 FROM public.snp_artisans_miniers a WHERE a.id<>NEW.id AND a.type_personne='morale' AND a.siege_pays=NEW.siege_pays
      AND (lower(btrim(a.numero_registre_commerce))=lower(btrim(NEW.numero_registre_commerce)) OR lower(btrim(a.numero_ifu))=lower(btrim(NEW.numero_ifu)))) THEN
      RAISE EXCEPTION 'Une société possède déjà ce RCCM ou cet IFU dans ce pays.' USING ERRCODE='23505'; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.snp_guard_artisan_dossier() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER aaa_guard_artisan_dossier BEFORE INSERT OR UPDATE ON public.snp_artisans_miniers
  FOR EACH ROW EXECUTE FUNCTION public.snp_guard_artisan_dossier();

CREATE FUNCTION public.snp_guard_artisan_responsable() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.artisan_id<>OLD.artisan_id) THEN RAISE EXCEPTION 'Le responsable ne peut pas être transféré à un autre dossier.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.snp_artisans_miniers WHERE id=NEW.artisan_id AND type_personne='morale') THEN RAISE EXCEPTION 'Le responsable doit appartenir à une personne morale.'; END IF;
  IF nullif(btrim(NEW.nom),'') IS NULL OR nullif(btrim(NEW.prenoms),'') IS NULL OR nullif(btrim(NEW.fonction),'') IS NULL OR nullif(btrim(NEW.numero_piece_identite),'') IS NULL
    OR NEW.date_naissance>CURRENT_DATE OR NEW.date_delivrance_piece>CURRENT_DATE OR NEW.date_expiration_piece<NEW.date_delivrance_piece THEN
    RAISE EXCEPTION 'Complétez l’identité, la fonction et les dates valides du responsable.' USING ERRCODE='23514'; END IF;
  IF NEW.whatsapp_identique THEN NEW.whatsapp:=NEW.telephone; END IF;
  PERFORM public.snp_artisan_validate_contact(NEW.telephone,NEW.email,NEW.whatsapp);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.snp_guard_artisan_responsable() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_artisan_responsable BEFORE INSERT OR UPDATE ON public.snp_artisan_responsables
  FOR EACH ROW EXECUTE FUNCTION public.snp_guard_artisan_responsable();
CREATE FUNCTION public.snp_check_artisan_responsable() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.snp_artisans_miniers a WHERE a.id=NEW.id AND a.dossier_version=1 AND a.type_personne='morale'
    AND NOT EXISTS(SELECT 1 FROM public.snp_artisan_responsables r WHERE r.artisan_id=a.id)) THEN
    RAISE EXCEPTION 'Le responsable de la société est obligatoire.' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.snp_check_artisan_responsable() FROM PUBLIC,anon,authenticated;
CREATE CONSTRAINT TRIGGER artisan_responsable_required AFTER INSERT OR UPDATE ON public.snp_artisans_miniers
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.snp_check_artisan_responsable();

CREATE FUNCTION public.snp_audit_artisan_dossier() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.snp_artisan_dossier_audit(artisan_id,actor_id,action,ancien_role,nouveau_role,ancien_exploitant_id,nouvel_exploitant_id)
  VALUES(NEW.id,auth.uid(),CASE WHEN TG_OP='INSERT' THEN 'creation' ELSE 'modification' END,
    CASE WHEN TG_OP='UPDATE' THEN OLD.type_artisan END,NEW.type_artisan,CASE WHEN TG_OP='UPDATE' THEN OLD.exploitant_id END,NEW.exploitant_id);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.snp_audit_artisan_dossier() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER audit_artisan_dossier AFTER INSERT OR UPDATE ON public.snp_artisans_miniers FOR EACH ROW EXECUTE FUNCTION public.snp_audit_artisan_dossier();
CREATE FUNCTION public.snp_audit_artisan_responsable() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.snp_artisan_dossier_audit(artisan_id,actor_id,action)
    VALUES(NEW.artisan_id,auth.uid(),CASE WHEN TG_OP='INSERT' THEN 'responsable_ajoute' ELSE 'responsable_modifie' END);
  UPDATE public.snp_artisans_miniers SET updated_at=clock_timestamp() WHERE id=NEW.artisan_id;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.snp_audit_artisan_responsable() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER audit_artisan_responsable AFTER INSERT OR UPDATE ON public.snp_artisan_responsables FOR EACH ROW EXECUTE FUNCTION public.snp_audit_artisan_responsable();

-- SECURITY INVOKER keeps existing row access rules, including collector/comptoir perimeter.
CREATE FUNCTION public.snp_save_artisan_dossier(p_id uuid,p_creation_id uuid,p_expected_updated_at timestamptz,p_dossier jsonb,p_confirm_transition boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v public.snp_artisans_miniers; previous public.snp_artisans_miniers; r public.snp_artisan_responsables;
  payload jsonb; fingerprint text:=md5(p_dossier::text); target uuid:=coalesce(p_id,p_creation_id);
BEGIN
  IF auth.uid() IS NULL OR NOT public.snp_mfa_satisfaite() OR target IS NULL THEN RAISE EXCEPTION 'Session autorisée requise.' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(60906111030);
  SELECT * INTO previous FROM public.snp_artisans_miniers WHERE id=target FOR UPDATE;
  IF p_id IS NULL AND previous.id IS NOT NULL THEN
    IF previous.created_by=auth.uid() AND previous.creation_fingerprint=fingerprint THEN
      RETURN jsonb_build_object('artisan',to_jsonb(previous),'responsable',(SELECT to_jsonb(x) FROM public.snp_artisan_responsables x WHERE artisan_id=target));
    END IF;
    RAISE EXCEPTION 'Ce dossier a déjà été enregistré. Rechargez sa fiche avant de le modifier.' USING ERRCODE='40001';
  END IF;
  IF p_id IS NOT NULL AND (previous.id IS NULL OR previous.updated_at IS DISTINCT FROM p_expected_updated_at) THEN
    RAISE EXCEPTION 'La fiche a changé depuis son ouverture. Rechargez-la avant d’enregistrer.' USING ERRCODE='40001'; END IF;
  IF previous.id IS NULL AND NOT public.snp_peut_gerer_sites_artisanaux() THEN RAISE EXCEPTION 'Création réservée à la DGMG et à l’administrateur.' USING ERRCODE='42501'; END IF;
  IF p_dossier->>'type_artisan'='collecteur' AND (previous.id IS NULL OR previous.type_artisan<>'collecteur') THEN RAISE EXCEPTION 'La création d’un collecteur utilise son parcours dédié.'; END IF;
  IF previous.id IS NOT NULL AND (previous.exploitant_id IS DISTINCT FROM nullif(p_dossier->>'exploitant_id','')::uuid OR previous.type_artisan IS DISTINCT FROM p_dossier->>'type_artisan') AND NOT p_confirm_transition THEN
    RAISE EXCEPTION 'Confirmez le changement de rôle ou d’exploitant. Les opérations historiques resteront inchangées.' USING ERRCODE='23514'; END IF;
  IF jsonb_typeof(p_dossier)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_dossier) k WHERE k<>ALL(ARRAY[
    'type_personne','type_artisan','nom','prenoms','raison_sociale','numero_registre_commerce','numero_ifu','date_naissance','lieu_naissance','nationalite','sexe',
    'pays','region','commune','adresse','siege_pays','siege_region','siege_commune','siege_adresse','telephone','whatsapp','whatsapp_identique','email',
    'artisanal_site_id','exploitant_id','type_piece_identite','numero_piece_identite','date_delivrance_piece','date_expiration_piece','lieu_delivrance_piece','observations','responsable'])) THEN
    RAISE EXCEPTION 'Le dossier contient des champs non autorisés.'; END IF;
  payload:=p_dossier-'responsable';
  IF nullif(payload->>'artisanal_site_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.artisanal_sites WHERE id=(payload->>'artisanal_site_id')::uuid) THEN
    RAISE EXCEPTION 'Le site sélectionné n’est pas accessible dans votre périmètre.' USING ERRCODE='42501'; END IF;
  SELECT * INTO v FROM jsonb_populate_record(previous,payload);
  IF v.type_personne='morale' AND (payload ?| ARRAY['nom','prenoms','date_naissance','lieu_naissance','nationalite','sexe','type_piece_identite','numero_piece_identite','date_delivrance_piece','date_expiration_piece','lieu_delivrance_piece']) THEN RAISE EXCEPTION 'Les données personnelles doivent appartenir au responsable.'; END IF;
  IF v.type_personne='physique' AND (p_dossier ?| ARRAY['raison_sociale','numero_ifu','numero_registre_commerce','siege_pays','siege_region','siege_commune','siege_adresse','responsable']) THEN RAISE EXCEPTION 'Les champs société ne concernent pas une personne physique.'; END IF;
  IF previous.id IS NULL THEN
    INSERT INTO public.snp_artisans_miniers(id,type_personne,type_artisan,nom,prenoms,raison_sociale,numero_registre_commerce,numero_ifu,date_naissance,lieu_naissance,nationalite,sexe,
      pays,region,commune,adresse,siege_pays,siege_region,siege_commune,siege_adresse,telephone,whatsapp,whatsapp_identique,email,artisanal_site_id,exploitant_id,
      type_piece_identite,numero_piece_identite,date_delivrance_piece,date_expiration_piece,lieu_delivrance_piece,observations,created_by,updated_by,creation_fingerprint,dossier_version)
    VALUES(target,v.type_personne,v.type_artisan,v.nom,v.prenoms,v.raison_sociale,v.numero_registre_commerce,v.numero_ifu,v.date_naissance,v.lieu_naissance,v.nationalite,v.sexe,
      v.pays,v.region,v.commune,v.adresse,v.siege_pays,v.siege_region,v.siege_commune,v.siege_adresse,v.telephone,v.whatsapp,coalesce(v.whatsapp_identique,false),v.email,v.artisanal_site_id,v.exploitant_id,
      v.type_piece_identite,v.numero_piece_identite,v.date_delivrance_piece,v.date_expiration_piece,v.lieu_delivrance_piece,v.observations,auth.uid(),auth.uid(),fingerprint,1) RETURNING * INTO v;
  ELSE
    UPDATE public.snp_artisans_miniers SET type_artisan=v.type_artisan,type_personne=v.type_personne,nom=v.nom,prenoms=v.prenoms,raison_sociale=v.raison_sociale,
      numero_registre_commerce=v.numero_registre_commerce,numero_ifu=v.numero_ifu,date_naissance=v.date_naissance,lieu_naissance=v.lieu_naissance,nationalite=v.nationalite,sexe=v.sexe,
      pays=v.pays,region=v.region,commune=v.commune,adresse=v.adresse,siege_pays=v.siege_pays,siege_region=v.siege_region,siege_commune=v.siege_commune,siege_adresse=v.siege_adresse,
      telephone=v.telephone,whatsapp=v.whatsapp,whatsapp_identique=v.whatsapp_identique,email=v.email,artisanal_site_id=v.artisanal_site_id,exploitant_id=v.exploitant_id,
      type_piece_identite=v.type_piece_identite,numero_piece_identite=v.numero_piece_identite,date_delivrance_piece=v.date_delivrance_piece,date_expiration_piece=v.date_expiration_piece,
      lieu_delivrance_piece=v.lieu_delivrance_piece,observations=v.observations,updated_by=auth.uid(),dossier_version=1 WHERE id=target RETURNING * INTO v;
    IF v.id IS NULL THEN RAISE EXCEPTION 'Modification non autorisée.' USING ERRCODE='42501'; END IF;
  END IF;
  IF v.type_personne='morale' THEN
    IF jsonb_typeof(p_dossier->'responsable') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Le responsable de la société est obligatoire.' USING ERRCODE='23514'; END IF;
    SELECT * INTO r FROM jsonb_populate_record(NULL::public.snp_artisan_responsables,p_dossier->'responsable');
    INSERT INTO public.snp_artisan_responsables(artisan_id,nom,prenoms,date_naissance,telephone,whatsapp,whatsapp_identique,email,fonction,type_piece_identite,numero_piece_identite,date_delivrance_piece,date_expiration_piece,lieu_delivrance_piece)
    VALUES(target,r.nom,r.prenoms,r.date_naissance,r.telephone,r.whatsapp,coalesce(r.whatsapp_identique,false),r.email,r.fonction,r.type_piece_identite,r.numero_piece_identite,r.date_delivrance_piece,r.date_expiration_piece,r.lieu_delivrance_piece)
    ON CONFLICT(artisan_id) DO UPDATE SET nom=EXCLUDED.nom,prenoms=EXCLUDED.prenoms,date_naissance=EXCLUDED.date_naissance,telephone=EXCLUDED.telephone,whatsapp=EXCLUDED.whatsapp,
      whatsapp_identique=EXCLUDED.whatsapp_identique,email=EXCLUDED.email,fonction=EXCLUDED.fonction,type_piece_identite=EXCLUDED.type_piece_identite,numero_piece_identite=EXCLUDED.numero_piece_identite,
      date_delivrance_piece=EXCLUDED.date_delivrance_piece,date_expiration_piece=EXCLUDED.date_expiration_piece,lieu_delivrance_piece=EXCLUDED.lieu_delivrance_piece RETURNING * INTO r;
  END IF;
  SELECT * INTO v FROM public.snp_artisans_miniers WHERE id=target;
  RETURN jsonb_build_object('artisan',to_jsonb(v),'responsable',CASE WHEN r.id IS NOT NULL THEN to_jsonb(r) END);
END $$;
REVOKE ALL ON FUNCTION public.snp_save_artisan_dossier(uuid,uuid,timestamptz,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_save_artisan_dossier(uuid,uuid,timestamptz,jsonb,boolean) TO authenticated;

CREATE FUNCTION public.snp_search_exploitants(p_query text,p_exclude_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid,nom text,prenoms text,raison_sociale text,type_personne text,numero_carte text,artisanal_site_id uuid,site_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT a.id,a.nom,a.prenoms,a.raison_sociale,a.type_personne,a.numero_carte,a.artisanal_site_id,s.name
  FROM public.snp_artisans_miniers a LEFT JOIN public.artisanal_sites s ON s.id=a.artisanal_site_id
  WHERE a.type_artisan='exploitant' AND a.actif AND a.id IS DISTINCT FROM p_exclude_id
    AND length(btrim(p_query)) BETWEEN 2 AND 100
    AND strpos(lower(concat_ws(' ',a.nom,a.prenoms,a.raison_sociale,a.numero_carte)),lower(btrim(p_query)))>0
  ORDER BY coalesce(a.raison_sociale,a.nom),a.id LIMIT 20;
$$;
REVOKE ALL ON FUNCTION public.snp_search_exploitants(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_search_exploitants(text,uuid) TO authenticated;
ALTER TABLE public.snp_artisan_documents
  ADD COLUMN owner_kind text NOT NULL DEFAULT 'artisan' CHECK(owner_kind IN ('artisan','societe','responsable')),
  ADD COLUMN responsable_id uuid,
  ADD COLUMN titre text,
  ADD COLUMN storage_bucket text NOT NULL DEFAULT 'artisan-documents',
  ADD COLUMN sha256 text,
  ADD COLUMN deleted_at timestamptz,
  ADD CONSTRAINT snp_document_responsable_fk FOREIGN KEY(responsable_id,artisan_id) REFERENCES public.snp_artisan_responsables(id,artisan_id) ON DELETE RESTRICT,
  ADD CONSTRAINT snp_document_owner_check CHECK((owner_kind='responsable')=(responsable_id IS NOT NULL));
ALTER TABLE public.snp_artisan_documents DROP CONSTRAINT snp_artisan_documents_type_document_check;
ALTER TABLE public.snp_artisan_documents ADD CONSTRAINT snp_artisan_documents_type_document_check
  CHECK(type_document IN ('photo','cni','passeport','permis','certificat','autre','rccm','ifu'));
CREATE INDEX snp_document_responsable_idx ON public.snp_artisan_documents(responsable_id) WHERE responsable_id IS NOT NULL;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('artisan-dossiers','artisan-dossiers',false,5242880,ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=5242880,allowed_mime_types=EXCLUDED.allowed_mime_types;

CREATE FUNCTION public.snp_artisan_document_allowed(p_artisan_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT public.snp_mfa_satisfaite() AND EXISTS(SELECT 1 FROM public.snp_artisans_miniers a WHERE a.id=p_artisan_id)
    AND (public.snp_peut_gerer_sites_artisanaux() OR public.snp_can_access_artisan(p_artisan_id));
$$;
REVOKE ALL ON FUNCTION public.snp_artisan_document_allowed(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_artisan_document_allowed(uuid) TO authenticated;
-- Objects can only be created/removed by the validated gateway, never by a browser Storage request.
CREATE POLICY snp_artisan_metadata_read_boundary ON public.snp_artisan_documents AS RESTRICTIVE FOR SELECT TO authenticated
  USING(storage_bucket<>'artisan-dossiers' OR (deleted_at IS NULL AND public.snp_artisan_document_allowed(artisan_id)));
CREATE POLICY snp_artisan_metadata_anon_boundary ON public.snp_artisan_documents AS RESTRICTIVE FOR ALL TO anon
  USING(storage_bucket<>'artisan-dossiers') WITH CHECK(storage_bucket<>'artisan-dossiers');
CREATE POLICY snp_artisan_private_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='artisan-dossiers' AND EXISTS(
  SELECT 1 FROM public.snp_artisan_documents d WHERE d.storage_bucket=bucket_id AND d.chemin_fichier=name AND d.deleted_at IS NULL));
CREATE POLICY snp_artisan_private_read_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'artisan-dossiers' OR EXISTS(
  SELECT 1 FROM public.snp_artisan_documents d WHERE d.storage_bucket=bucket_id AND d.chemin_fichier=name AND d.deleted_at IS NULL));
CREATE POLICY snp_artisan_private_insert_boundary ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'artisan-dossiers');
CREATE POLICY snp_artisan_private_anon_boundary ON storage.objects AS RESTRICTIVE FOR ALL TO anon USING(bucket_id<>'artisan-dossiers') WITH CHECK(bucket_id<>'artisan-dossiers');
CREATE POLICY snp_artisan_private_update_boundary ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'artisan-dossiers') WITH CHECK(bucket_id<>'artisan-dossiers');
CREATE POLICY snp_artisan_private_delete_boundary ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'artisan-dossiers');
CREATE POLICY snp_artisan_gateway_metadata_insert ON public.snp_artisan_documents AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(storage_bucket<>'artisan-dossiers');
CREATE POLICY snp_artisan_gateway_metadata_update ON public.snp_artisan_documents AS RESTRICTIVE FOR UPDATE TO authenticated USING(storage_bucket<>'artisan-dossiers') WITH CHECK(storage_bucket<>'artisan-dossiers');
CREATE POLICY snp_artisan_gateway_metadata_delete ON public.snp_artisan_documents AS RESTRICTIVE FOR DELETE TO authenticated USING(storage_bucket<>'artisan-dossiers');

CREATE FUNCTION public.snp_register_artisan_document(p_document jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.snp_artisan_documents; a public.snp_artisans_miniers; existing public.snp_artisan_documents; object_meta jsonb;
BEGIN
  SELECT * INTO d FROM jsonb_populate_record(NULL::public.snp_artisan_documents,p_document);
  IF NOT public.snp_artisan_document_allowed(d.artisan_id) THEN RAISE EXCEPTION 'Accès au dossier refusé.' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(60906111030);
  PERFORM pg_advisory_xact_lock(hashtextextended(d.id::text,1));
  SELECT * INTO a FROM public.snp_artisans_miniers WHERE id=d.artisan_id;
  IF d.owner_kind IS NULL OR d.owner_kind NOT IN ('artisan','societe','responsable') OR d.type_document IS NULL OR nullif(btrim(d.titre),'') IS NULL OR length(d.titre)>150
    OR (d.owner_kind='artisan' AND a.type_personne<>'physique') OR (d.owner_kind IN ('societe','responsable') AND a.type_personne<>'morale')
    OR (d.owner_kind='responsable' AND NOT EXISTS(SELECT 1 FROM public.snp_artisan_responsables r WHERE r.id=d.responsable_id AND r.artisan_id=a.id))
    OR (d.owner_kind<>'responsable' AND d.responsable_id IS NOT NULL)
    OR (d.type_document='photo' AND (d.owner_kind<>'artisan' OR d.type_mime NOT IN ('image/jpeg','image/png') OR d.taille_fichier>2097152))
    OR (d.owner_kind='societe' AND d.type_document NOT IN ('rccm','ifu','autre'))
    OR (d.owner_kind<>'societe' AND d.type_document IN ('rccm','ifu')) THEN RAISE EXCEPTION 'Le document ne correspond pas à son titulaire.'; END IF;
  IF d.id IS NULL OR d.chemin_fichier IS NULL OR d.sha256 IS NULL OR d.taille_fichier IS NULL OR d.type_mime IS NULL
    OR d.storage_bucket IS DISTINCT FROM 'artisan-dossiers' OR d.chemin_fichier !~ ('^'||d.artisan_id::text||'/'||d.id::text||'\.(pdf|jpg|jpeg|png)$')
    OR d.sha256 !~ '^[0-9a-f]{64}$' OR d.taille_fichier NOT BETWEEN 1 AND 5242880 OR d.type_mime NOT IN ('image/jpeg','image/png','application/pdf') THEN RAISE EXCEPTION 'Référence documentaire invalide.'; END IF;
  SELECT metadata INTO object_meta FROM storage.objects WHERE bucket_id='artisan-dossiers' AND name=d.chemin_fichier;
  IF object_meta IS NULL OR (object_meta->>'size')::bigint IS DISTINCT FROM d.taille_fichier OR object_meta->>'mimetype' IS DISTINCT FROM d.type_mime THEN RAISE EXCEPTION 'Le dépôt validé est introuvable.'; END IF;
  SELECT * INTO existing FROM public.snp_artisan_documents WHERE id=d.id;
  IF existing.id IS NOT NULL THEN
    IF ROW(existing.artisan_id,existing.sha256,existing.owner_kind,existing.responsable_id,existing.type_document,existing.titre) IS DISTINCT FROM ROW(d.artisan_id,d.sha256,d.owner_kind,d.responsable_id,d.type_document,d.titre) OR existing.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Une autre pièce utilise cet identifiant.'; END IF;
    RETURN to_jsonb(existing);
  END IF;
  IF (SELECT count(*) FROM public.snp_artisan_documents WHERE artisan_id=d.artisan_id AND deleted_at IS NULL)>=50 THEN RAISE EXCEPTION 'Le dossier accepte au maximum 50 pièces.'; END IF;
  INSERT INTO public.snp_artisan_documents(id,artisan_id,type_document,nom_fichier,chemin_fichier,taille_fichier,type_mime,uploaded_by,owner_kind,responsable_id,titre,storage_bucket,sha256)
  VALUES(d.id,d.artisan_id,d.type_document,d.nom_fichier,d.chemin_fichier,d.taille_fichier,d.type_mime,auth.uid(),d.owner_kind,d.responsable_id,d.titre,'artisan-dossiers',d.sha256) RETURNING * INTO d;
  IF d.type_document='photo' THEN UPDATE public.snp_artisans_miniers SET photo_url='artisan-dossiers/'||d.chemin_fichier WHERE id=d.artisan_id; END IF;
  INSERT INTO public.snp_artisan_dossier_audit(artisan_id,actor_id,action) VALUES(d.artisan_id,auth.uid(),'document_ajoute');
  RETURN to_jsonb(d);
END $$;
REVOKE ALL ON FUNCTION public.snp_register_artisan_document(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_register_artisan_document(jsonb) TO authenticated;

-- Invoked only after the gateway has verified the user, active session, scope and backed up the object.
CREATE FUNCTION public.snp_delete_artisan_document_gateway(p_document_id uuid,p_actor_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.snp_artisan_documents;
BEGIN
  SELECT * INTO d FROM public.snp_artisan_documents WHERE id=p_document_id AND storage_bucket='artisan-dossiers' FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Document introuvable.'; END IF;
  UPDATE public.snp_artisan_documents SET deleted_at=coalesce(deleted_at,clock_timestamp()) WHERE id=d.id;
  UPDATE public.snp_artisans_miniers SET photo_url=NULL WHERE id=d.artisan_id AND photo_url='artisan-dossiers/'||d.chemin_fichier;
  INSERT INTO public.snp_artisan_dossier_audit(artisan_id,actor_id,action) VALUES(d.artisan_id,p_actor_id,'document_retire');
  RETURN d.chemin_fichier;
END $$;
REVOKE ALL ON FUNCTION public.snp_delete_artisan_document_gateway(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.snp_delete_artisan_document_gateway(uuid,uuid) TO service_role;
-- Preserve production attribution separately; financial sales and their versions are not rewritten.
CREATE TABLE public.snp_artisan_vente_site_origins (
  vente_id uuid PRIMARY KEY REFERENCES public.snp_artisan_ventes_or(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.artisanal_sites(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX snp_artisan_vente_site_origins_site_idx ON public.snp_artisan_vente_site_origins(site_id);
ALTER TABLE public.snp_artisan_vente_site_origins ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.snp_artisan_vente_site_origins TO authenticated;
CREATE POLICY artisan_vente_origin_read ON public.snp_artisan_vente_site_origins FOR SELECT TO authenticated
  USING(EXISTS(SELECT 1 FROM public.snp_artisan_ventes_or v WHERE v.id=vente_id));
INSERT INTO public.snp_artisan_vente_site_origins(vente_id,site_id)
SELECT v.id,coalesce(a.artisanal_site_id,(SELECT s.id FROM public.artisanal_sites s WHERE lower(btrim(s.locality))=lower(btrim(a.commune)) ORDER BY s.id LIMIT 1))
FROM public.snp_artisan_ventes_or v JOIN public.snp_artisans_miniers a ON a.id=v.artisan_id;
CREATE FUNCTION public.snp_capture_artisan_vente_site() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.snp_artisans_miniers; origin uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(60906111030);
  SELECT * INTO a FROM public.snp_artisans_miniers WHERE id=NEW.artisan_id;
  IF a.type_artisan='aide_exploitant' THEN SELECT artisanal_site_id INTO origin FROM public.snp_artisans_miniers WHERE id=a.exploitant_id;
  ELSE origin:=a.artisanal_site_id; END IF;
  IF origin IS NULL AND a.dossier_version=0 THEN SELECT id INTO origin FROM public.artisanal_sites WHERE lower(btrim(locality))=lower(btrim(a.commune)) ORDER BY id LIMIT 1; END IF;
  INSERT INTO public.snp_artisan_vente_site_origins(vente_id,site_id) VALUES(NEW.id,origin);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.snp_capture_artisan_vente_site() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER capture_artisan_vente_site AFTER INSERT ON public.snp_artisan_ventes_or FOR EACH ROW EXECUTE FUNCTION public.snp_capture_artisan_vente_site();
NOTIFY pgrst,'reload schema';
COMMIT;
