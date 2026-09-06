-- Test-only schema additions from read-only catalogue. No production records.
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "type_personne" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "type_artisan" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "nom" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "prenoms" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "date_naissance" date;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "lieu_naissance" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "sexe" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "nationalite" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "raison_sociale" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "telephone" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "adresse" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "commune" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "region" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "type_piece_identite" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "numero_piece_identite" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "date_delivrance_piece" date;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "date_expiration_piece" date;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "lieu_delivrance_piece" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "photo_url" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "piece_identite_url" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "collecteur_id" uuid;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "numero_carte" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "observations" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "pays" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "telephone_secondaire" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "numero_registre_commerce" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "quantite_or_vendu_grammes" numeric;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "chiffre_affaires_fcfa" numeric;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "nombre_transactions" integer;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "derniere_transaction_date" date;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "actif" boolean;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "desactive_le" timestamp with time zone;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "desactive_par" uuid;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "motif_desactivation" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "artisanal_site_id" uuid;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "dossier_version" smallint;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "numero_ifu" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "whatsapp" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "whatsapp_identique" boolean;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "siege_pays" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "siege_region" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "siege_commune" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "siege_adresse" text;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "exploitant_id" uuid;
ALTER TABLE public.snp_artisans_miniers ADD COLUMN IF NOT EXISTS "creation_fingerprint" text;
ALTER TABLE public.snp_artisans_miniers ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.snp_artisans_miniers ALTER COLUMN whatsapp_identique SET DEFAULT false;
CREATE TABLE public.artisanal_sites(id uuid PRIMARY KEY,name text,locality text,region text);
CREATE TABLE public.snp_collector_accounts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id),collector_id uuid,comptoir_organization_id uuid,is_active boolean DEFAULT true,linked_by uuid,linked_at timestamptz DEFAULT now(),unlinked_at timestamptz,reason text);
CREATE UNIQUE INDEX test_collector_active ON public.snp_collector_accounts(user_id) WHERE is_active;
CREATE TABLE public.snp_responsibility_catalog(code text PRIMARY KEY,capability_code text,label text,description text,requires_explicit_assignment boolean);
CREATE TABLE public.snp_role_responsibility_ceiling(role text,responsibility_code text,required boolean,PRIMARY KEY(role,responsibility_code));
CREATE TABLE public.snp_user_responsibilities(user_id uuid,responsibility_code text);
CREATE TABLE public.snp_role_module_ceilings(role text,access_domain text,can_view boolean,can_create boolean,can_edit boolean,can_delete boolean,can_approve boolean,PRIMARY KEY(role,access_domain));
CREATE TABLE public.modules(id uuid PRIMARY KEY,name text,access_domain text);
ALTER TABLE public.user_profiles ADD COLUMN mining_company_id uuid;
CREATE FUNCTION public.snp_access_action_to_legacy(text) RETURNS text LANGUAGE sql AS $$ SELECT lower($1) $$;
CREATE TABLE public.snp_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),destinataire_id uuid NOT NULL,type text,gravite text,titre text,message text,objet_domaine text,objet_id uuid,chemin text,faits jsonb,cle_dedoublonnage text,emise_par uuid,created_at timestamptz DEFAULT now());
CREATE UNIQUE INDEX notification_dedup ON public.snp_notifications(destinataire_id,cle_dedoublonnage) WHERE cle_dedoublonnage IS NOT NULL;
CREATE TABLE public.snp_notifications_livraisons(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),notification_id uuid REFERENCES public.snp_notifications(id),canal text,destinataire text,statut text,envoye_le timestamptz,tentatives integer DEFAULT 0,created_at timestamptz DEFAULT now());
CREATE TABLE public.snp_artisan_responsables(id uuid PRIMARY KEY,artisan_id uuid,nom text,prenoms text);
CREATE FUNCTION public.snp_session_est_active() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.session',true)='active' $$;
CREATE FUNCTION public.snp_current_collector_id() RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$ SELECT collector_id FROM public.snp_collector_accounts WHERE user_id=auth.uid() AND is_active LIMIT 1 $$;
CREATE FUNCTION public.snp_peut_gerer_sites_artisanaux() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT public.snp_session_est_active() AND public.snp_mfa_satisfaite() AND EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND is_active AND role IN('owner','admin','dgmg')) $$;
-- Membership calculation is separately exercised by 56 actual-migration contracts.
-- Here the boundary can be toggled to check enforcement at submission/approval.
CREATE TABLE public.test_member_eligibility(artisan_id uuid PRIMARY KEY,eligible boolean NOT NULL);
CREATE FUNCTION public.snp_artisan_affiliation_eligible(uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT coalesce((SELECT eligible FROM public.test_member_eligibility WHERE artisan_id=$1),false) $$;
GRANT SELECT ON public.user_profiles,public.snp_user_responsibilities,public.modules TO authenticated;
CREATE OR REPLACE FUNCTION public.snp_notifier(p_destinataire_id uuid, p_titre text, p_message text, p_type text DEFAULT 'information'::text, p_gravite text DEFAULT 'normale'::text, p_objet_domaine text DEFAULT NULL::text, p_objet_id uuid DEFAULT NULL::uuid, p_chemin text DEFAULT NULL::text, p_faits jsonb DEFAULT NULL::jsonb, p_cle_dedoublonnage text DEFAULT NULL::text, p_par_courriel boolean DEFAULT true)
 RETURNS snp_notifications
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'storage', 'extensions', 'pg_temp'
AS $function$
DECLARE
  n snp_notifications%ROWTYPE;
  v_courriel text;
  v_actif boolean;
BEGIN
  IF p_destinataire_id IS NULL THEN
    RAISE EXCEPTION 'Une notification demande un destinataire.';
  END IF;
  IF p_titre IS NULL OR length(trim(p_titre)) = 0 THEN
    RAISE EXCEPTION 'Une notification demande un titre.';
  END IF;

  SELECT email, is_active INTO v_courriel, v_actif
  FROM user_profiles WHERE id = p_destinataire_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Destinataire introuvable.'; END IF;
  -- Notifier un compte desactive encombre la boite de quelqu'un qui n'a plus
  -- a agir : on s'arrete la, sans erreur.
  IF NOT COALESCE(v_actif, false) THEN RETURN NULL; END IF;

  INSERT INTO snp_notifications (
    destinataire_id, type, gravite, titre, message,
    objet_domaine, objet_id, chemin, faits, cle_dedoublonnage, emise_par)
  VALUES (
    p_destinataire_id, p_type, p_gravite, trim(p_titre), p_message,
    p_objet_domaine, p_objet_id, p_chemin, p_faits, p_cle_dedoublonnage, auth.uid())
  ON CONFLICT (destinataire_id, cle_dedoublonnage) WHERE cle_dedoublonnage IS NOT NULL
  DO NOTHING
  RETURNING * INTO n;

  IF n.id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO snp_notifications_livraisons (notification_id, canal, destinataire, statut, envoye_le)
  VALUES (n.id, 'plateforme', p_destinataire_id::text, 'envoye', now());

  IF p_par_courriel AND v_courriel IS NOT NULL AND length(trim(v_courriel)) > 0 THEN
    INSERT INTO snp_notifications_livraisons (notification_id, canal, destinataire, statut)
    VALUES (n.id, 'courriel', trim(v_courriel), 'en_attente');
  END IF;

  RETURN n;
END $function$;

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

CREATE FUNCTION public.snp_permission_allowed(text,uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION public.generate_numero_recu_vente_or() RETURNS text LANGUAGE sql AS $$ SELECT gen_random_uuid()::text $$;
