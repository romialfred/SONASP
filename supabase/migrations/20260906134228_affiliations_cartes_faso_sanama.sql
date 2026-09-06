-- Additive membership workflow. Historical dates and financial records are preserved.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.snp_4b_can_manage_artisan(uuid,text)') IS NULL
     OR to_regclass('public.snp_artisan_responsables') IS NULL
     OR to_regprocedure('public.snp_record_workflow_event(text,uuid,text,text,text,text,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Prérequis cartes, dossier artisan et audit manquants.';
  END IF;
END $$;

INSERT INTO public.snp_capability_catalog(code,domain,label,description,sensitive) VALUES
 ('artisan.membership.manage','artisanat','Gérer les droits d’adhésion','Établir les échéances et enregistrer les encaissements.',true),
 ('artisan.membership.confirm','artisanat','Contrôler les droits d’adhésion','Confirmer ou annuler un encaissement après contrôle.',true),
 ('artisan.cards.activate','artisanat','Activer les cartes d’affiliation','Activer manuellement un titre validé dont les droits sont soldés.',true)
ON CONFLICT(code) DO NOTHING;
INSERT INTO public.snp_role_capabilities(role,capability_code) VALUES
 ('admin','artisan.membership.manage'),('admin','artisan.membership.confirm'),('admin','artisan.cards.activate')
ON CONFLICT DO NOTHING;

ALTER TABLE public.snp_cartes_professionnelles
 ADD COLUMN IF NOT EXISTS numero_affiliation text,
 ADD COLUMN IF NOT EXISTS affiliation_version integer,
 ADD COLUMN IF NOT EXISTS template_version text NOT NULL DEFAULT 'faso-sanama-id1-v1',
 ADD COLUMN IF NOT EXISTS identity_snapshot jsonb,
 ADD COLUMN IF NOT EXISTS prepared_at timestamptz,
 ADD COLUMN IF NOT EXISTS activated_at timestamptz,
 ADD COLUMN IF NOT EXISTS activated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS valid_from date,
 ADD COLUMN IF NOT EXISTS valid_until date,
 ADD COLUMN IF NOT EXISTS validity_timezone text,
 ADD COLUMN IF NOT EXISTS previous_card_id uuid REFERENCES public.snp_cartes_professionnelles(id),
 ADD COLUMN IF NOT EXISTS dues_source_card_id uuid REFERENCES public.snp_cartes_professionnelles(id),
 ADD COLUMN IF NOT EXISTS replaced_by uuid REFERENCES public.snp_cartes_professionnelles(id),
 ADD COLUMN IF NOT EXISTS verification_token uuid NOT NULL DEFAULT gen_random_uuid(),
 ADD COLUMN IF NOT EXISTS render_status text NOT NULL DEFAULT 'pending',
 ADD COLUMN IF NOT EXISTS render_revision integer NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS render_lease uuid,
 ADD COLUMN IF NOT EXISTS render_started_at timestamptz,
 ADD COLUMN IF NOT EXISTS render_completed_at timestamptz,
 ADD COLUMN IF NOT EXISTS recto_path text,
 ADD COLUMN IF NOT EXISTS verso_path text,
 ADD COLUMN IF NOT EXISTS pdf_path text,
 ADD COLUMN IF NOT EXISTS portrait_path text,
 ADD COLUMN IF NOT EXISTS render_hashes jsonb;

-- Adding metadata must not fire legacy expiry side effects on existing dossiers.
ALTER TABLE public.snp_cartes_professionnelles DISABLE TRIGGER trigger_carte_expiration_desactivation;
WITH numbered AS (
 SELECT c.id,coalesce(a.numero_carte,c.numero_carte) AS affiliation,
 row_number() OVER(PARTITION BY c.artisan_id ORDER BY c.created_at NULLS FIRST,c.id)::integer AS version
 FROM public.snp_cartes_professionnelles c JOIN public.snp_artisans_miniers a ON a.id=c.artisan_id
)
UPDATE public.snp_cartes_professionnelles c SET numero_affiliation=n.affiliation,affiliation_version=n.version
FROM numbered n WHERE c.id=n.id AND c.affiliation_version IS NULL;
ALTER TABLE public.snp_cartes_professionnelles ENABLE TRIGGER trigger_carte_expiration_desactivation;
ALTER TABLE public.snp_cartes_professionnelles
 ADD CONSTRAINT affiliation_card_period CHECK(valid_from IS NULL AND valid_until IS NULL OR valid_from IS NOT NULL AND valid_until>=valid_from),
 ADD CONSTRAINT affiliation_card_render CHECK(render_status IN ('pending','rendering','ready','failed')),
 ADD CONSTRAINT affiliation_card_version CHECK(affiliation_version>0 AND render_revision>0);
CREATE UNIQUE INDEX affiliation_card_version_unique ON public.snp_cartes_professionnelles(artisan_id,affiliation_version);
CREATE UNIQUE INDEX affiliation_card_token_unique ON public.snp_cartes_professionnelles(verification_token);
CREATE INDEX affiliation_card_expiry ON public.snp_cartes_professionnelles(valid_until) WHERE activated_at IS NOT NULL AND replaced_by IS NULL;

CREATE TABLE public.snp_adhesion_baremes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), libelle text NOT NULL CHECK(length(trim(libelle)) BETWEEN 3 AND 120),
 role_artisan text NOT NULL CHECK(role_artisan IN ('exploitant','fournisseur','aide_exploitant','intermediaire','collecteur')),
 montant numeric(18,2) NOT NULL CHECK(montant>0 AND montant<'Infinity'::numeric), devise text NOT NULL CHECK(devise ~ '^[A-Z]{3}$'),
 duree_jours integer NOT NULL CHECK(duree_jours BETWEEN 1 AND 3660),
 fuseau text NOT NULL, alerte_jours integer NOT NULL CHECK(alerte_jours BETWEEN 0 AND 365),
 actif boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE TABLE public.snp_adhesion_droits(
 id uuid PRIMARY KEY, carte_id uuid NOT NULL UNIQUE REFERENCES public.snp_cartes_professionnelles(id),
 artisan_id uuid NOT NULL REFERENCES public.snp_artisans_miniers(id),
 bareme_id uuid NOT NULL REFERENCES public.snp_adhesion_baremes(id),
 montant numeric(18,2) NOT NULL CHECK(montant>0 AND montant<'Infinity'::numeric), devise text NOT NULL, duree_jours integer NOT NULL,
 fuseau text NOT NULL, alerte_jours integer NOT NULL,
 debut date NOT NULL, fin date NOT NULL, statut text NOT NULL DEFAULT 'ouvert' CHECK(statut IN ('ouvert','annule')),
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(fin>=debut AND fin-debut+1=duree_jours)
);
CREATE INDEX adhesion_droits_artisan ON public.snp_adhesion_droits(artisan_id,debut,fin);
CREATE TABLE public.snp_adhesion_encaissements(
 id uuid PRIMARY KEY, droit_id uuid NOT NULL REFERENCES public.snp_adhesion_droits(id),
 montant numeric(18,2) NOT NULL CHECK(montant>0 AND montant<'Infinity'::numeric), reference text NOT NULL CHECK(length(trim(reference)) BETWEEN 3 AND 120),
 mode text NOT NULL CHECK(mode IN ('virement_bancaire','cash','orange_money','mobile_money','moov_money','wave','cheque')),
 date_paiement date NOT NULL, statut text NOT NULL DEFAULT 'en_attente' CHECK(statut IN ('en_attente','confirme','annule','rembourse')),
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(),
 confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, confirmed_at timestamptz,
 revised_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, revised_at timestamptz, motif text,
 UNIQUE(mode,reference)
);
CREATE INDEX adhesion_encaissement_droit ON public.snp_adhesion_encaissements(droit_id,statut);
CREATE UNIQUE INDEX adhesion_receipt_reference_normalized ON public.snp_adhesion_encaissements(mode,upper(trim(reference)));

CREATE OR REPLACE FUNCTION public.snp_affiliation_require(p_artisan uuid,p_capability text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
BEGIN
 IF auth.uid() IS NULL OR public.snp_mfa_satisfaite() IS NOT TRUE OR public.snp_session_est_active() IS NOT TRUE
    OR public.snp_4b_can_manage_artisan(p_artisan,p_capability) IS NOT TRUE THEN
   RAISE EXCEPTION 'Habilitation, session forte et périmètre artisan requis.' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_artisan::text,0));
END $$;

CREATE OR REPLACE FUNCTION public.snp_affiliation_readable(p_artisan uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
 SELECT auth.uid() IS NOT NULL AND public.snp_session_est_active() AND public.snp_mfa_satisfaite()
 AND (public.snp_can_access_artisan(p_artisan) OR public.snp_4b_can_manage_artisan(p_artisan,'artisan.cards.manage'))
$$;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['snp_adhesion_baremes','snp_adhesion_droits','snp_adhesion_encaissements'] LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
   EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
   EXECUTE format('CREATE TRIGGER affiliation_rpc_only BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.snp_4b_require_trusted_mutation()',t);
 END LOOP;
END $$;
CREATE POLICY adhesion_tarifs_read ON public.snp_adhesion_baremes FOR SELECT TO authenticated
 USING(public.snp_actor_has_capability('artisan.membership.manage') OR public.snp_actor_has_capability('artisan.cards.manage') OR public.snp_actor_has_capability('platform.settings.manage'));
CREATE POLICY adhesion_droits_read ON public.snp_adhesion_droits FOR SELECT TO authenticated
 USING(public.snp_affiliation_readable(artisan_id) AND (public.snp_actor_has_capability('artisan.membership.manage') OR public.snp_actor_has_capability('artisan.membership.confirm') OR public.snp_actor_has_capability('artisan.cards.activate')));
CREATE POLICY adhesion_encaissements_read ON public.snp_adhesion_encaissements FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.snp_adhesion_droits d WHERE d.id=droit_id));

CREATE OR REPLACE FUNCTION public.snp_configurer_adhesion_bareme(p_id uuid,p_libelle text,p_role text,p_montant numeric,p_devise text,p_duree integer,p_fuseau text,p_alerte integer)
RETURNS public.snp_adhesion_baremes LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
DECLARE r public.snp_adhesion_baremes;
BEGIN
 IF auth.uid() IS NULL OR NOT public.snp_actor_has_capability('platform.settings.manage') OR NOT public.snp_session_est_active() OR NOT public.snp_mfa_satisfaite() THEN
   RAISE EXCEPTION 'Administration des paramètres et session forte requises.' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_fuseau) THEN RAISE EXCEPTION 'Fuseau métier invalide.'; END IF;
 SELECT * INTO r FROM public.snp_adhesion_baremes WHERE id=p_id;
 IF FOUND THEN
   IF (r.libelle,r.role_artisan,r.montant,r.devise,r.duree_jours,r.fuseau,r.alerte_jours)
      IS DISTINCT FROM(trim(p_libelle),p_role,p_montant,p_devise,p_duree,p_fuseau,p_alerte) THEN RAISE EXCEPTION 'Clé de barème déjà utilisée.' USING ERRCODE='40001'; END IF;
   RETURN r;
 END IF;
 INSERT INTO public.snp_adhesion_baremes(id,libelle,role_artisan,montant,devise,duree_jours,fuseau,alerte_jours,created_by)
 VALUES(p_id,trim(p_libelle),p_role,p_montant,p_devise,p_duree,p_fuseau,p_alerte,auth.uid()) RETURNING * INTO r;
 PERFORM public.snp_record_workflow_event('membership-tariff',r.id,'created',NULL,'actif','platform.settings.manage',NULL,to_jsonb(r)-'created_by');
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.snp_etablir_adhesion_droit(p_id uuid,p_carte uuid,p_bareme uuid,p_debut date,p_fin date)
RETURNS public.snp_adhesion_droits LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
DECLARE c public.snp_cartes_professionnelles; b public.snp_adhesion_baremes; d public.snp_adhesion_droits;
BEGIN
 SELECT * INTO c FROM public.snp_cartes_professionnelles WHERE id=p_carte;
 PERFORM public.snp_affiliation_require(c.artisan_id,'artisan.membership.manage');
 SELECT * INTO c FROM public.snp_cartes_professionnelles WHERE id=p_carte FOR UPDATE;
 SELECT * INTO d FROM public.snp_adhesion_droits WHERE id=p_id;
 IF FOUND THEN
  IF (d.carte_id,d.bareme_id,d.debut,d.fin) IS DISTINCT FROM(p_carte,p_bareme,p_debut,p_fin) THEN RAISE EXCEPTION 'Clé de droits déjà utilisée.' USING ERRCODE='40001'; END IF;
  RETURN d;
 END IF;
 IF c.activated_at IS NOT NULL OR c.dues_source_card_id IS NOT NULL OR c.replaced_by IS NOT NULL OR c.statut IN ('annulee','expiree') THEN RAISE EXCEPTION 'Cette émission ne peut plus recevoir de nouveaux droits.'; END IF;
 SELECT * INTO b FROM public.snp_adhesion_baremes WHERE id=p_bareme AND actif FOR SHARE;
 IF NOT FOUND OR b.role_artisan IS DISTINCT FROM(c.identity_snapshot->>'role') THEN RAISE EXCEPTION 'Préparez la carte et choisissez un barème applicable à son rôle.'; END IF;
 IF p_debut IS NULL OR p_fin IS NULL OR p_fin-p_debut+1<>b.duree_jours OR p_fin < (clock_timestamp() AT TIME ZONE b.fuseau)::date THEN RAISE EXCEPTION 'Période incohérente avec la durée du barème.'; END IF;
 PERFORM 1 FROM public.snp_artisans_miniers WHERE id=c.artisan_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.snp_adhesion_droits WHERE artisan_id=c.artisan_id AND statut='ouvert' AND daterange(debut,fin,'[]') && daterange(p_debut,p_fin,'[]')) THEN RAISE EXCEPTION 'Une autre période d’adhésion recouvre ces dates.'; END IF;
 INSERT INTO public.snp_adhesion_droits(id,carte_id,artisan_id,bareme_id,montant,devise,duree_jours,fuseau,alerte_jours,debut,fin,created_by)
 VALUES(p_id,c.id,c.artisan_id,b.id,b.montant,b.devise,b.duree_jours,b.fuseau,b.alerte_jours,p_debut,p_fin,auth.uid()) RETURNING * INTO d;
 PERFORM public.snp_record_workflow_event('artisan-card',c.id,'dues-established',NULL,'ouvert','artisan.membership.manage',NULL,jsonb_build_object('droit_id',d.id,'debut',d.debut,'fin',d.fin));
 RETURN d;
END $$;

CREATE OR REPLACE FUNCTION public.snp_enregistrer_adhesion_encaissement(p_id uuid,p_droit uuid,p_montant numeric,p_reference text,p_mode text,p_date date)
RETURNS public.snp_adhesion_encaissements LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
DECLARE d public.snp_adhesion_droits; r public.snp_adhesion_encaissements;
BEGIN
 SELECT * INTO d FROM public.snp_adhesion_droits WHERE id=p_droit;
 PERFORM public.snp_affiliation_require(d.artisan_id,'artisan.membership.manage');
 PERFORM 1 FROM public.snp_cartes_professionnelles WHERE id=d.carte_id FOR UPDATE;
 SELECT * INTO d FROM public.snp_adhesion_droits WHERE id=p_droit FOR UPDATE;
 SELECT * INTO r FROM public.snp_adhesion_encaissements WHERE id=p_id;
 IF FOUND THEN
  IF (r.droit_id,r.montant,r.reference,r.mode,r.date_paiement) IS DISTINCT FROM(p_droit,p_montant,trim(p_reference),p_mode,p_date) THEN RAISE EXCEPTION 'Clé de paiement déjà utilisée.' USING ERRCODE='40001'; END IF;
  RETURN r;
 END IF;
 IF d.statut<>'ouvert' OR p_date>(clock_timestamp() AT TIME ZONE d.fuseau)::date THEN RAISE EXCEPTION 'Droits annulés ou date de paiement future.'; END IF;
 IF p_montant+coalesce((SELECT sum(montant) FROM public.snp_adhesion_encaissements WHERE droit_id=d.id AND statut IN ('en_attente','confirme')),0)>d.montant THEN RAISE EXCEPTION 'Le paiement dépasse le solde disponible de ces droits.'; END IF;
 INSERT INTO public.snp_adhesion_encaissements(id,droit_id,montant,reference,mode,date_paiement,created_by)
 VALUES(p_id,p_droit,p_montant,trim(p_reference),p_mode,p_date,auth.uid()) RETURNING * INTO r;
 PERFORM public.snp_record_workflow_event('artisan-card',d.carte_id,'payment-recorded',NULL,'en_attente','artisan.membership.manage',NULL,jsonb_build_object('paiement_id',r.id,'droit_id',d.id));
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.snp_preparer_carte_affiliation(p_carte uuid)
RETURNS public.snp_cartes_professionnelles LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
DECLARE c public.snp_cartes_professionnelles; a public.snp_artisans_miniers; r public.snp_artisan_responsables; v_site uuid; v_nom text; v_photo text; v_snapshot jsonb;
BEGIN
 SELECT * INTO c FROM public.snp_cartes_professionnelles WHERE id=p_carte;
 PERFORM public.snp_affiliation_require(c.artisan_id,'artisan.cards.manage');
 SELECT * INTO c FROM public.snp_cartes_professionnelles WHERE id=p_carte FOR UPDATE;
 IF c.identity_snapshot IS NOT NULL THEN RETURN c; END IF;
 IF c.statut<>'en_cours' THEN RAISE EXCEPTION 'Une carte historique contrôlée nécessite une nouvelle émission.'; END IF;
 SELECT * INTO a FROM public.snp_artisans_miniers WHERE id=c.artisan_id FOR SHARE;
 IF NOT coalesce(a.actif,false) THEN RAISE EXCEPTION 'Le dossier du membre est désactivé.'; END IF;
 v_site:=a.artisanal_site_id;
 IF a.type_artisan='aide_exploitant' THEN
   SELECT artisanal_site_id INTO v_site FROM public.snp_artisans_miniers WHERE id=a.exploitant_id AND type_artisan='exploitant' AND actif;
   IF NOT FOUND THEN RAISE EXCEPTION 'Exploitant de rattachement actif requis.'; END IF;
 END IF;
 SELECT name INTO v_nom FROM public.artisanal_sites WHERE id=v_site;
 IF a.type_personne='morale' THEN
   SELECT * INTO r FROM public.snp_artisan_responsables WHERE artisan_id=a.id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Le titulaire responsable de la société doit être renseigné.'; END IF;
 END IF;
 v_photo:=a.photo_url;
 IF nullif(trim(v_photo),'') IS NULL THEN RAISE EXCEPTION 'Ajoutez la photographie du titulaire au dossier avant de préparer la carte.'; END IF;
 v_snapshot:=jsonb_build_object('nom',CASE WHEN a.type_personne='morale' THEN r.nom ELSE a.nom END,
  'prenoms',CASE WHEN a.type_personne='morale' THEN r.prenoms ELSE coalesce(a.prenoms,'') END,
  'societe',CASE WHEN a.type_personne='morale' THEN a.raison_sociale END,'titulaire_id',r.id,
  'role',a.type_artisan,'photo_reference',v_photo,'site_nom',coalesce(v_nom,'Non rattaché'),
  'commune',coalesce(a.commune,''),'numero_affiliation',c.numero_affiliation);
 IF nullif(trim(v_snapshot->>'nom'),'') IS NULL OR nullif(trim(c.numero_affiliation),'') IS NULL THEN RAISE EXCEPTION 'Identité et numéro d’affiliation requis.'; END IF;
 UPDATE public.snp_cartes_professionnelles SET identity_snapshot=v_snapshot,prepared_at=now(),render_status='pending',updated_by=auth.uid()
 WHERE id=c.id RETURNING * INTO c;
 PERFORM public.snp_record_workflow_event('artisan-card',c.id,'prepared',NULL,'en_cours','artisan.cards.manage',NULL,jsonb_build_object('version',c.affiliation_version));
 RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.create_carte_professionnelle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
BEGIN
 INSERT INTO public.snp_cartes_professionnelles(artisan_id,numero_carte,numero_affiliation,affiliation_version,date_emission,date_expiration,statut,created_by,updated_by)
 VALUES(NEW.id,NEW.numero_carte,NEW.numero_carte,1,CURRENT_DATE,CURRENT_DATE,'en_cours',auth.uid(),auth.uid()) ON CONFLICT(numero_carte) DO NOTHING;
 -- Legacy mandatory dates are never used as effective validity; valid_from/until remain NULL.
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.snp_renouveler_carte_professionnelle(p_artisan_id uuid,p_date_expiration date DEFAULT NULL,p_observations text DEFAULT NULL)
RETURNS public.snp_cartes_professionnelles LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
DECLARE c public.snp_cartes_professionnelles; n public.snp_cartes_professionnelles; v_version integer;
BEGIN
 PERFORM public.snp_affiliation_require(p_artisan_id,'artisan.cards.manage');
 PERFORM 1 FROM public.snp_artisans_miniers WHERE id=p_artisan_id FOR UPDATE;
 SELECT * INTO c FROM public.snp_cartes_professionnelles WHERE artisan_id=p_artisan_id ORDER BY affiliation_version DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Carte professionnelle introuvable.'; END IF;
 IF c.statut='en_cours' THEN RETURN c; END IF;
 IF p_date_expiration IS NOT NULL THEN RAISE EXCEPTION 'Définissez la période dans les droits d’adhésion de la nouvelle émission.'; END IF;
 v_version:=c.affiliation_version+1;
 INSERT INTO public.snp_cartes_professionnelles(artisan_id,numero_carte,numero_affiliation,affiliation_version,previous_card_id,date_emission,date_expiration,statut,observations,created_by,updated_by)
 VALUES(p_artisan_id,c.numero_affiliation||'-V'||v_version,c.numero_affiliation,v_version,c.id,CURRENT_DATE,CURRENT_DATE,'en_cours',p_observations,auth.uid(),auth.uid()) RETURNING * INTO n;
 PERFORM public.snp_record_workflow_event('artisan-card',n.id,'reissued',NULL,'en_cours','artisan.cards.manage',p_observations,jsonb_build_object('previous_card_id',c.id,'version',v_version));
 RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.snp_transition_carte_professionnelle(p_carte_id uuid,p_expected_statut text,p_nouveau_statut text,p_motif text DEFAULT NULL)
RETURNS public.snp_cartes_professionnelles LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
DECLARE c public.snp_cartes_professionnelles; before_status text;
BEGIN
 SELECT * INTO c FROM public.snp_cartes_professionnelles WHERE id=p_carte_id;
 PERFORM public.snp_affiliation_require(c.artisan_id,'artisan.cards.manage');
 SELECT * INTO c FROM public.snp_cartes_professionnelles WHERE id=p_carte_id FOR UPDATE;
 IF c.statut=p_nouveau_statut THEN RETURN c; END IF;
 IF c.statut IS DISTINCT FROM p_expected_statut THEN RAISE EXCEPTION 'Conflit optimiste : la carte a changé.' USING ERRCODE='40001'; END IF;
 IF p_nouveau_statut='en_exploitation' THEN RAISE EXCEPTION 'Utilisez l’activation manuelle après contrôle des droits d’adhésion.'; END IF;
 IF c.replaced_by IS NOT NULL OR NOT (
  (c.statut='en_cours' AND p_nouveau_statut IN ('validee','annulee')) OR
  (c.statut IN ('validee','en_exploitation') AND p_nouveau_statut IN ('suspendue','annulee')) OR
  (c.statut='suspendue' AND p_nouveau_statut IN ('validee','annulee')) OR
  (c.statut='en_exploitation' AND p_nouveau_statut='expiree' AND c.valid_until < (clock_timestamp() AT TIME ZONE c.validity_timezone)::date)
 ) THEN RAISE EXCEPTION 'Transition de carte interdite.'; END IF;
 IF p_nouveau_statut IN ('suspendue','annulee') AND coalesce(length(trim(p_motif)),0)<10 THEN RAISE EXCEPTION 'Un motif de dix caractères minimum est requis.'; END IF;
 IF p_nouveau_statut='validee' THEN
  IF auth.uid()=c.created_by OR auth.uid()=c.updated_by THEN RAISE EXCEPTION 'Double contrôle requis : l’émetteur ne valide pas sa carte.' USING ERRCODE='42501'; END IF;
  IF c.identity_snapshot IS NULL OR c.render_status<>'ready' THEN RAISE EXCEPTION 'Préparez la carte et générez les deux faces avant validation.'; END IF;
 END IF;
 before_status:=c.statut;
 UPDATE public.snp_cartes_professionnelles SET statut=p_nouveau_statut,
  validee_par=CASE WHEN p_nouveau_statut='validee' THEN auth.uid() ELSE validee_par END,
  validee_le=CASE WHEN p_nouveau_statut='validee' THEN now() ELSE validee_le END,
  date_validation=CASE WHEN p_nouveau_statut='validee' THEN CURRENT_DATE ELSE date_validation END,
  suspendue_par=CASE WHEN p_nouveau_statut='suspendue' THEN auth.uid() ELSE suspendue_par END,
  suspendue_le=CASE WHEN p_nouveau_statut='suspendue' THEN now() ELSE suspendue_le END,
  motif_suspension=CASE WHEN p_nouveau_statut='suspendue' THEN trim(p_motif) ELSE motif_suspension END,
  updated_by=auth.uid()
 WHERE id=c.id RETURNING * INTO c;
 PERFORM public.snp_record_workflow_event('artisan-card',c.id,'status-changed',before_status,c.statut,'artisan.cards.manage',p_motif,jsonb_build_object('version',c.affiliation_version));
 RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.snp_corriger_carte_affiliation(p_id uuid,p_carte uuid,p_motif text)
RETURNS public.snp_cartes_professionnelles LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
DECLARE c public.snp_cartes_professionnelles; n public.snp_cartes_professionnelles; v integer; source uuid;
BEGIN
 SELECT * INTO c FROM public.snp_cartes_professionnelles WHERE id=p_carte;
 PERFORM public.snp_affiliation_require(c.artisan_id,'artisan.cards.manage');
 SELECT * INTO c FROM public.snp_cartes_professionnelles WHERE id=p_carte FOR UPDATE;
 SELECT * INTO n FROM public.snp_cartes_professionnelles WHERE id=p_id;
 IF FOUND THEN
  IF n.previous_card_id IS DISTINCT FROM p_carte OR n.observations IS DISTINCT FROM trim(p_motif) THEN RAISE EXCEPTION 'Clé de correction déjà utilisée.' USING ERRCODE='40001'; END IF;
  RETURN n;
 END IF;
 IF c.replaced_by IS NOT NULL OR coalesce(length(trim(p_motif)),0) NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'Choisissez une carte non remplacée et précisez le motif de correction.'; END IF;
 IF EXISTS(SELECT 1 FROM public.snp_cartes_professionnelles WHERE artisan_id=c.artisan_id AND id<>c.id AND statut='en_cours' AND replaced_by IS NULL) THEN RAISE EXCEPTION 'Une émission est déjà en cours : terminez ou annulez son contrôle.'; END IF;
 SELECT max(affiliation_version)+1 INTO v FROM public.snp_cartes_professionnelles WHERE artisan_id=c.artisan_id;
 SELECT carte_id INTO source FROM public.snp_adhesion_droits WHERE carte_id=coalesce(c.dues_source_card_id,c.id) AND statut='ouvert';
 INSERT INTO public.snp_cartes_professionnelles(id,artisan_id,numero_carte,numero_affiliation,affiliation_version,previous_card_id,dues_source_card_id,date_emission,date_expiration,statut,created_by,updated_by,observations)
 VALUES(p_id,c.artisan_id,c.numero_affiliation||'-V'||v,c.numero_affiliation,v,c.id,source,CURRENT_DATE,CURRENT_DATE,'en_cours',auth.uid(),auth.uid(),trim(p_motif)) RETURNING * INTO n;
 IF c.statut='en_cours' THEN UPDATE public.snp_cartes_professionnelles SET statut='annulee',updated_by=auth.uid() WHERE id=c.id; END IF;
 PERFORM public.snp_record_workflow_event('artisan-card',c.id,'correction-requested',c.statut,CASE WHEN c.statut='en_cours' THEN 'annulee' ELSE c.statut END,'artisan.cards.manage',p_motif,jsonb_build_object('next_card_id',n.id));
 PERFORM public.snp_record_workflow_event('artisan-card',n.id,'correction-created',NULL,'en_cours','artisan.cards.manage',p_motif,jsonb_build_object('previous_card_id',c.id,'dues_source_card_id',source));
 RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.snp_affiliation_effective_status(p_card public.snp_cartes_professionnelles)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
DECLARE d public.snp_adhesion_droits; today date; paid numeric;
BEGIN
 IF p_card.replaced_by IS NOT NULL THEN RETURN 'remplacee'; END IF;
 IF p_card.statut='annulee' THEN RETURN 'annulee'; END IF;
 IF p_card.statut='suspendue' THEN RETURN 'suspendue'; END IF;
 IF p_card.statut='expiree' THEN RETURN 'expiree'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.snp_artisans_miniers a WHERE a.id=p_card.artisan_id AND a.actif) THEN RETURN 'suspendue'; END IF;
 IF p_card.validee_le IS NULL OR p_card.identity_snapshot IS NULL OR p_card.statut='en_cours' THEN RETURN 'non_validee'; END IF;
 IF p_card.activated_at IS NULL OR p_card.statut<>'en_exploitation' THEN RETURN 'inactive'; END IF;
 SELECT * INTO d FROM public.snp_adhesion_droits WHERE carte_id=coalesce(p_card.dues_source_card_id,p_card.id);
 IF NOT FOUND OR d.statut<>'ouvert' OR p_card.valid_from IS NULL OR p_card.valid_until IS NULL OR p_card.validity_timezone IS NULL THEN RETURN 'inactive'; END IF;
 today:=(statement_timestamp() AT TIME ZONE p_card.validity_timezone)::date;
 IF today>p_card.valid_until THEN RETURN 'expiree'; END IF;
 SELECT coalesce(sum(montant),0) INTO paid FROM public.snp_adhesion_encaissements WHERE droit_id=d.id AND statut='confirme';
 IF paid<d.montant THEN RETURN 'a_reexaminer'; END IF;
 IF today<p_card.valid_from THEN RETURN 'programmee'; END IF;
 RETURN 'active';
END $$;

CREATE OR REPLACE FUNCTION public.snp_affiliation_card_json(c public.snp_cartes_professionnelles)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
 SELECT jsonb_build_object('id',c.id,'artisan_id',c.artisan_id,'numero_carte',c.numero_carte,
  'holder_name',coalesce(nullif(trim(concat_ws(' ',c.identity_snapshot->>'prenoms',c.identity_snapshot->>'nom')),''),
    (SELECT coalesce(nullif(a.raison_sociale,''),trim(concat_ws(' ',a.prenoms,a.nom))) FROM public.snp_artisans_miniers a WHERE a.id=c.artisan_id)),
  'numero_affiliation',c.numero_affiliation,'version',c.affiliation_version,'template_version',c.template_version,'dues_card_id',coalesce(c.dues_source_card_id,c.id),
  'statut',c.statut,'statut_effectif',public.snp_affiliation_effective_status(c),'snapshot',c.identity_snapshot,
  'validated_at',c.validee_le,'activated_at',c.activated_at,'valid_from',c.valid_from,'valid_until',c.valid_until,
  'issued_on',(c.activated_at AT TIME ZONE c.validity_timezone)::date,
  'expires_soon',public.snp_affiliation_effective_status(c)='active' AND c.valid_until-(statement_timestamp() AT TIME ZONE c.validity_timezone)::date <= (SELECT alerte_jours FROM public.snp_adhesion_droits WHERE carte_id=coalesce(c.dues_source_card_id,c.id)),
  'jours_restants',CASE WHEN public.snp_affiliation_effective_status(c)='active' THEN c.valid_until-(statement_timestamp() AT TIME ZONE c.validity_timezone)::date END,
  'server_date',(statement_timestamp() AT TIME ZONE coalesce(c.validity_timezone,'Africa/Ouagadougou'))::date,
  'render_status',c.render_status,'render_revision',c.render_revision,'recto_path',c.recto_path,'verso_path',c.verso_path,'pdf_path',c.pdf_path,'portrait_path',c.portrait_path,
  'verification_token',c.verification_token,'created_at',c.created_at,'replaced_by',c.replaced_by)
$$;

CREATE OR REPLACE FUNCTION public.snp_lister_affiliations(p_artisan uuid DEFAULT NULL)
RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
 SELECT public.snp_affiliation_card_json(c) FROM public.snp_cartes_professionnelles c
 WHERE (p_artisan IS NULL OR c.artisan_id=p_artisan) AND public.snp_affiliation_readable(c.artisan_id)
 ORDER BY c.created_at DESC NULLS LAST,c.affiliation_version DESC
$$;

CREATE OR REPLACE FUNCTION public.snp_affiliation_history(p_carte uuid)
RETURNS TABLE(id bigint,action text,occurred_at timestamptz,reason text,status_after text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
 SELECT e.id,e.action,e.occurred_at,e.reason,e.status_after FROM public.snp_workflow_audit e
 JOIN public.snp_cartes_professionnelles c ON c.id=e.aggregate_id
 WHERE e.aggregate_type='artisan-card' AND c.id=p_carte AND public.snp_affiliation_readable(c.artisan_id)
 ORDER BY e.occurred_at DESC,e.id DESC
$$;

CREATE OR REPLACE FUNCTION public.snp_controler_adhesion_encaissement(p_id uuid,p_statut text,p_motif text DEFAULT NULL)
RETURNS public.snp_adhesion_encaissements LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
DECLARE r public.snp_adhesion_encaissements; d public.snp_adhesion_droits; old_status text;
BEGIN
 SELECT * INTO r FROM public.snp_adhesion_encaissements WHERE id=p_id;
 SELECT * INTO d FROM public.snp_adhesion_droits WHERE id=r.droit_id;
 PERFORM public.snp_affiliation_require(d.artisan_id,'artisan.membership.confirm');
 PERFORM 1 FROM public.snp_cartes_professionnelles WHERE id=d.carte_id FOR UPDATE;
 PERFORM 1 FROM public.snp_adhesion_droits WHERE id=d.id FOR UPDATE;
 SELECT * INTO r FROM public.snp_adhesion_encaissements WHERE id=p_id FOR UPDATE;
 IF r.statut=p_statut THEN RETURN r; END IF;
 IF NOT((r.statut='en_attente' AND p_statut IN ('confirme','annule')) OR (r.statut='confirme' AND p_statut IN ('annule','rembourse'))) THEN RAISE EXCEPTION 'Transition d’encaissement interdite.'; END IF;
 IF r.created_by=auth.uid() THEN RAISE EXCEPTION 'Double contrôle requis : le déclarant ne confirme pas son encaissement.' USING ERRCODE='42501'; END IF;
 IF p_statut IN ('annule','rembourse') AND coalesce(length(trim(p_motif)),0)<10 THEN RAISE EXCEPTION 'Un motif explicite de dix caractères est requis.'; END IF;
 IF p_statut='confirme' AND (d.statut<>'ouvert' OR r.montant+coalesce((SELECT sum(montant) FROM public.snp_adhesion_encaissements WHERE droit_id=d.id AND statut='confirme'),0)>d.montant) THEN RAISE EXCEPTION 'Encaissement incompatible avec le solde des droits.'; END IF;
 old_status:=r.statut;
 UPDATE public.snp_adhesion_encaissements SET statut=p_statut,
  confirmed_by=CASE WHEN p_statut='confirme' THEN auth.uid() ELSE confirmed_by END,
  confirmed_at=CASE WHEN p_statut='confirme' THEN now() ELSE confirmed_at END,
  revised_by=CASE WHEN p_statut<>'confirme' THEN auth.uid() END,
  revised_at=CASE WHEN p_statut<>'confirme' THEN now() END,motif=nullif(trim(p_motif),'') WHERE id=p_id RETURNING * INTO r;
 PERFORM public.snp_record_workflow_event('artisan-card',d.carte_id,'payment-'||p_statut,old_status,p_statut,'artisan.membership.confirm',p_motif,jsonb_build_object('paiement_id',r.id,'droit_id',d.id));
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.snp_activer_carte_affiliation(p_carte uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
DECLARE c public.snp_cartes_professionnelles; d public.snp_adhesion_droits; paid numeric; a public.snp_artisans_miniers; replaced public.snp_cartes_professionnelles;
BEGIN
 SELECT * INTO c FROM public.snp_cartes_professionnelles WHERE id=p_carte;
 PERFORM public.snp_affiliation_require(c.artisan_id,'artisan.cards.activate');
 SELECT * INTO a FROM public.snp_artisans_miniers WHERE id=c.artisan_id FOR UPDATE;
 SELECT * INTO c FROM public.snp_cartes_professionnelles WHERE id=p_carte FOR UPDATE;
 IF c.statut='en_exploitation' AND c.activated_at IS NOT NULL AND c.replaced_by IS NULL THEN RETURN public.snp_affiliation_card_json(c); END IF;
 IF c.statut<>'validee' OR c.validee_le IS NULL OR c.identity_snapshot IS NULL OR c.replaced_by IS NOT NULL OR NOT coalesce(a.actif,false) THEN RAISE EXCEPTION 'Carte validée et dossier éligible requis.'; END IF;
 SELECT * INTO d FROM public.snp_adhesion_droits WHERE carte_id=coalesce(c.dues_source_card_id,c.id) FOR UPDATE;
 IF NOT FOUND OR d.statut<>'ouvert' OR d.montant<=0 THEN RAISE EXCEPTION 'Des droits d’adhésion applicables doivent être établis.'; END IF;
 IF d.artisan_id<>c.artisan_id OR NOT EXISTS(SELECT 1 FROM public.snp_adhesion_baremes WHERE id=d.bareme_id AND role_artisan=c.identity_snapshot->>'role') THEN RAISE EXCEPTION 'Les droits ne correspondent pas au membre et au rôle contrôlés.'; END IF;
 IF d.fin < (clock_timestamp() AT TIME ZONE d.fuseau)::date OR d.fin-d.debut+1<>d.duree_jours THEN RAISE EXCEPTION 'La période d’adhésion est échue ou incohérente.'; END IF;
 SELECT coalesce(sum(montant),0) INTO paid FROM public.snp_adhesion_encaissements WHERE droit_id=d.id AND statut='confirme';
 IF paid<>d.montant THEN RAISE EXCEPTION 'Les droits d’adhésion doivent être intégralement réglés et confirmés.'; END IF;
 IF EXISTS(SELECT 1 FROM public.snp_cartes_professionnelles other WHERE other.artisan_id=c.artisan_id AND other.id<>c.id AND other.replaced_by IS NULL
  AND other.activated_at IS NOT NULL AND other.statut='en_exploitation' AND daterange(other.valid_from,other.valid_until,'[]') && daterange(d.debut,d.fin,'[]')
  AND NOT(c.dues_source_card_id IS NOT NULL AND coalesce(other.dues_source_card_id,other.id)=c.dues_source_card_id)) THEN RAISE EXCEPTION 'Une autre carte couvre déjà cette période.'; END IF;
 -- A correction replaces the title for the same paid period; it does not allocate its receipt twice.
 IF c.dues_source_card_id IS NOT NULL THEN
  FOR replaced IN UPDATE public.snp_cartes_professionnelles SET replaced_by=c.id
    WHERE artisan_id=c.artisan_id AND id<>c.id AND replaced_by IS NULL AND coalesce(dues_source_card_id,id)=c.dues_source_card_id RETURNING * LOOP
   PERFORM public.snp_record_workflow_event('artisan-card',replaced.id,'replaced',replaced.statut,'remplacee','artisan.cards.activate','Correction contrôlée activée.',jsonb_build_object('replacement_id',c.id));
  END LOOP;
 END IF;
 UPDATE public.snp_cartes_professionnelles SET statut='en_exploitation',activated_at=now(),activated_by=auth.uid(),
  valid_from=d.debut,valid_until=d.fin,validity_timezone=d.fuseau,date_emission=(clock_timestamp() AT TIME ZONE d.fuseau)::date,date_expiration=d.fin,
  verification_token=gen_random_uuid(),render_revision=render_revision+1,render_status='pending',render_lease=NULL,
  recto_path=NULL,verso_path=NULL,pdf_path=NULL,render_hashes=NULL,updated_by=auth.uid() WHERE id=c.id RETURNING * INTO c;
 -- A provisional token is invalidated at definitive issue; the old print can never appear active.
 PERFORM public.snp_record_workflow_event('artisan-card',c.id,'activated','validee','en_exploitation','artisan.cards.activate',NULL,jsonb_build_object('version',c.affiliation_version,'droit_id',d.id,'debut',d.debut,'fin',d.fin));
 RETURN public.snp_affiliation_card_json(c);
END $$;

CREATE OR REPLACE FUNCTION public.snp_claim_affiliation_render(p_carte uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
DECLARE c public.snp_cartes_professionnelles;
BEGIN
 SELECT * INTO c FROM public.snp_cartes_professionnelles WHERE id=p_carte;
 IF public.snp_4b_can_manage_artisan(c.artisan_id,'artisan.cards.manage') THEN
  PERFORM public.snp_affiliation_require(c.artisan_id,'artisan.cards.manage');
 ELSE
  PERFORM public.snp_affiliation_require(c.artisan_id,'artisan.cards.activate');
 END IF;
 SELECT * INTO c FROM public.snp_cartes_professionnelles WHERE id=p_carte FOR UPDATE;
 IF c.identity_snapshot IS NULL THEN RAISE EXCEPTION 'Préparez l’instantané du titulaire avant la génération.'; END IF;
 IF c.render_status='ready' THEN RETURN jsonb_build_object('ready',true); END IF;
 IF c.render_status='rendering' AND c.render_started_at>now()-interval '3 minutes' THEN RAISE EXCEPTION 'Génération déjà en cours. Réessayez dans quelques instants.' USING ERRCODE='40001'; END IF;
 UPDATE public.snp_cartes_professionnelles SET render_status='rendering',render_lease=gen_random_uuid(),render_started_at=now()
 WHERE id=c.id RETURNING * INTO c;
 PERFORM public.snp_record_workflow_event('artisan-card',c.id,'render-requested',NULL,'rendering',NULL,NULL,jsonb_build_object('version',c.affiliation_version,'render_revision',c.render_revision));
 RETURN jsonb_build_object('lease',c.render_lease,'card',public.snp_affiliation_card_json(c));
END $$;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('affiliation-cards','affiliation-cards',false,10485760,ARRAY['image/png','application/pdf']) ON CONFLICT(id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.snp_complete_affiliation_render(p_carte uuid,p_lease uuid,p_revision integer,p_files jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
DECLARE c public.snp_cartes_professionnelles; face text; path text;
BEGIN
 -- Only the rendering worker can attest actual files; browser writes are never trusted.
 IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service de rendu requis.' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.snp_cartes_professionnelles WHERE id=p_carte FOR UPDATE;
 IF c.render_lease IS DISTINCT FROM p_lease OR c.render_revision<>p_revision OR c.render_status<>'rendering' THEN RAISE EXCEPTION 'Rendu obsolète.' USING ERRCODE='40001'; END IF;
 IF p_files IS NULL THEN
  UPDATE public.snp_cartes_professionnelles SET render_status='failed',render_lease=NULL WHERE id=c.id;
  RETURN;
 END IF;
 FOREACH face IN ARRAY ARRAY['recto','verso','pdf','portrait'] LOOP
  path:=c.artisan_id||'/'||c.id||'/v'||c.affiliation_version||'-r'||p_revision||'/'||p_lease||'/'||face||CASE WHEN face='pdf' THEN '.pdf' ELSE '.png' END;
  IF p_files->face->>'path' IS DISTINCT FROM path OR coalesce(p_files->face->>'sha256','') !~ '^[a-f0-9]{64}$'
   OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='affiliation-cards' AND name=path
     AND (metadata->>'size')::bigint BETWEEN 1 AND 10485760
     AND metadata->>'mimetype'=CASE WHEN face='pdf' THEN 'application/pdf' ELSE 'image/png' END) THEN RAISE EXCEPTION 'Fichier de carte absent ou invalide.'; END IF;
 END LOOP;
 UPDATE public.snp_cartes_professionnelles SET render_status='ready',render_completed_at=now(),render_lease=NULL,
  recto_path=p_files->'recto'->>'path',verso_path=p_files->'verso'->>'path',pdf_path=p_files->'pdf'->>'path',
  portrait_path=coalesce(portrait_path,p_files->'portrait'->>'path'),render_hashes=p_files WHERE id=c.id;
 PERFORM public.snp_record_workflow_event('artisan-card',c.id,'rendered',NULL,'ready','artisan.cards.manage',NULL,jsonb_build_object('version',c.affiliation_version,'render_revision',p_revision));
END $$;

CREATE POLICY affiliation_cards_download ON storage.objects FOR SELECT TO authenticated USING(
 bucket_id='affiliation-cards' AND EXISTS(SELECT 1 FROM public.snp_cartes_professionnelles c
 WHERE name IN (c.recto_path,c.verso_path,c.pdf_path) AND public.snp_affiliation_readable(c.artisan_id))
);
CREATE POLICY affiliation_cards_download_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(
 bucket_id<>'affiliation-cards' OR EXISTS(SELECT 1 FROM public.snp_cartes_professionnelles c
 WHERE name IN(c.recto_path,c.verso_path,c.pdf_path) AND public.snp_affiliation_readable(c.artisan_id))
);
CREATE POLICY affiliation_cards_insert_boundary ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'affiliation-cards');
CREATE POLICY affiliation_cards_update_boundary ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'affiliation-cards') WITH CHECK(bucket_id<>'affiliation-cards');
CREATE POLICY affiliation_cards_delete_boundary ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'affiliation-cards');
CREATE POLICY affiliation_cards_anon_boundary ON storage.objects AS RESTRICTIVE FOR ALL TO anon USING(bucket_id<>'affiliation-cards') WITH CHECK(bucket_id<>'affiliation-cards');

CREATE OR REPLACE FUNCTION public.snp_verifier_affiliation(p_reference uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
 SELECT jsonb_build_object('numero_affiliation',c.numero_affiliation,'version',c.affiliation_version,
 'statut_effectif',public.snp_affiliation_effective_status(c),'valid_from',c.valid_from,'valid_until',c.valid_until,
 'verified_at',statement_timestamp()) FROM public.snp_cartes_professionnelles c WHERE c.verification_token=p_reference
$$;

CREATE OR REPLACE FUNCTION public.snp_artisan_affiliation_eligible(p_artisan uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
 SELECT public.snp_affiliation_readable(p_artisan) AND EXISTS(SELECT 1 FROM public.snp_artisans_miniers a JOIN public.snp_cartes_professionnelles c ON c.artisan_id=a.id
 WHERE a.id=p_artisan AND a.actif AND public.snp_affiliation_effective_status(c)='active')
$$;
CREATE OR REPLACE FUNCTION public.snp_artisans_eligibles_operations()
RETURNS SETOF public.snp_artisans_miniers LANGUAGE sql STABLE SECURITY INVOKER SET search_path='pg_catalog','pg_temp' AS $$
 SELECT a.* FROM public.snp_artisans_miniers a WHERE public.snp_artisan_affiliation_eligible(a.id)
 ORDER BY a.nom,a.raison_sociale
$$;
CREATE OR REPLACE FUNCTION public.snp_guard_affiliation_operation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
BEGIN
 -- The scope/finance guards still run. Cancellation and settlement history remain available.
 IF TG_OP='UPDATE' AND NEW.artisan_id IS NOT DISTINCT FROM OLD.artisan_id THEN RETURN NEW; END IF;
 IF NOT public.snp_artisan_affiliation_eligible(NEW.artisan_id) THEN RAISE EXCEPTION 'Une carte activée et des droits d’adhésion valides sont requis pour cette opération.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER affiliation_sale_eligibility BEFORE INSERT OR UPDATE OF artisan_id ON public.snp_artisan_ventes_or FOR EACH ROW EXECUTE FUNCTION public.snp_guard_affiliation_operation();
CREATE TRIGGER affiliation_payment_eligibility BEFORE INSERT ON public.snp_artisan_paiements FOR EACH ROW EXECUTE FUNCTION public.snp_guard_affiliation_operation();

-- New validity is checked on every read, independently of the historical expiration job.
CREATE OR REPLACE FUNCTION public.trigger_check_carte_expiration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
BEGIN
 -- Do not turn a regulatory expiry into an administrative dossier deactivation.
 -- Operation guards use current server validity; historical administrative decisions stay intact.
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.auto_desactiver_artisan_carte_expiree()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
BEGIN
 INSERT INTO public.snp_workflow_notification_outbox(event_key,event_type,aggregate_type,aggregate_id,payload)
 SELECT 'affiliation:'||c.id||':'||c.valid_until||':expiry-warning','affiliation.expiry-warning','artisan-card',c.id,
  jsonb_build_object('card_id',c.id,'artisan_id',c.artisan_id,'valid_until',c.valid_until,'threshold_days',d.alerte_jours)
 FROM public.snp_cartes_professionnelles c JOIN public.snp_adhesion_droits d ON d.carte_id=coalesce(c.dues_source_card_id,c.id)
 WHERE public.snp_affiliation_effective_status(c)='active' AND c.valid_until-(statement_timestamp() AT TIME ZONE d.fuseau)::date<=d.alerte_jours
 ON CONFLICT(event_key) DO NOTHING;
 INSERT INTO public.snp_workflow_notification_outbox(event_key,event_type,aggregate_type,aggregate_id,payload)
 SELECT 'affiliation:'||id||':'||valid_until||':expired','affiliation.expired','artisan-card',id,jsonb_build_object('card_id',id,'artisan_id',artisan_id,'valid_until',valid_until)
 FROM public.snp_cartes_professionnelles WHERE activated_at IS NOT NULL AND statut='en_exploitation' AND replaced_by IS NULL AND valid_until<(statement_timestamp() AT TIME ZONE validity_timezone)::date
 ON CONFLICT(event_key) DO NOTHING;
 PERFORM public.snp_record_workflow_event('artisan-card',id,'expired',statut,'expiree',NULL,NULL,jsonb_build_object('valid_until',valid_until))
 FROM public.snp_cartes_professionnelles WHERE activated_at IS NOT NULL AND statut='en_exploitation' AND replaced_by IS NULL AND valid_until<(statement_timestamp() AT TIME ZONE validity_timezone)::date;
 UPDATE public.snp_cartes_professionnelles SET statut='expiree'
 WHERE activated_at IS NOT NULL AND statut='en_exploitation' AND valid_until<(statement_timestamp() AT TIME ZONE validity_timezone)::date;
END $$;

CREATE OR REPLACE FUNCTION public.snp_annuler_adhesion_droit(p_id uuid,p_motif text)
RETURNS public.snp_adhesion_droits LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
DECLARE d public.snp_adhesion_droits;
BEGIN
 SELECT * INTO d FROM public.snp_adhesion_droits WHERE id=p_id;
 PERFORM public.snp_affiliation_require(d.artisan_id,'artisan.membership.confirm');
 SELECT * INTO d FROM public.snp_adhesion_droits WHERE id=p_id FOR UPDATE;
 IF d.statut='annule' THEN RETURN d; END IF;
 IF coalesce(length(trim(p_motif)),0) NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'Un motif explicite de dix caractères est requis.'; END IF;
 IF EXISTS(SELECT 1 FROM public.snp_adhesion_encaissements WHERE droit_id=d.id AND statut IN ('en_attente','confirme')) THEN RAISE EXCEPTION 'Contrôlez puis annulez ou remboursez les encaissements avant d’annuler ces droits.'; END IF;
 UPDATE public.snp_adhesion_droits SET statut='annule' WHERE id=d.id RETURNING * INTO d;
 PERFORM public.snp_record_workflow_event('artisan-card',d.carte_id,'dues-cancelled','ouvert','annule','artisan.membership.confirm',p_motif,jsonb_build_object('droit_id',d.id));
 RETURN d;
END $$;
REVOKE ALL ON FUNCTION public.auto_desactiver_artisan_carte_expiree() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.auto_desactiver_artisan_carte_expiree() TO service_role;
DO $$ BEGIN
 IF to_regprocedure('cron.schedule(text,text,text)') IS NOT NULL THEN
  EXECUTE $job$SELECT cron.schedule('affiliation-card-expiry','15 * * * *','SELECT public.auto_desactiver_artisan_carte_expiree()')$job$;
 ELSE
  RAISE NOTICE 'pg_cron absent : planifier auto_desactiver_artisan_carte_expiree() dans cet environnement. La validité serveur reste immédiate.';
 END IF;
END $$;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND
 (p.proname LIKE 'snp_%affiliation%' OR p.proname LIKE 'snp_%adhesion%' OR p.proname IN ('snp_lister_affiliations','snp_artisans_eligibles_operations')) LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.snp_affiliation_readable(uuid),public.snp_artisan_affiliation_eligible(uuid),
 public.snp_lister_affiliations(uuid),public.snp_affiliation_history(uuid),public.snp_preparer_carte_affiliation(uuid),
 public.snp_configurer_adhesion_bareme(uuid,text,text,numeric,text,integer,text,integer),
 public.snp_etablir_adhesion_droit(uuid,uuid,uuid,date,date),public.snp_enregistrer_adhesion_encaissement(uuid,uuid,numeric,text,text,date),
 public.snp_controler_adhesion_encaissement(uuid,text,text),public.snp_activer_carte_affiliation(uuid),
 public.snp_corriger_carte_affiliation(uuid,uuid,text),
 public.snp_annuler_adhesion_droit(uuid,text),
 public.snp_claim_affiliation_render(uuid),public.snp_artisans_eligibles_operations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_complete_affiliation_render(uuid,uuid,integer,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.snp_verifier_affiliation(uuid) TO anon,authenticated;
DO $$ BEGIN
 IF has_table_privilege('authenticated','public.snp_adhesion_droits','INSERT') OR has_function_privilege('anon','public.snp_activer_carte_affiliation(uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public.snp_complete_affiliation_render(uuid,uuid,integer,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Postflight : privilèges excessifs.'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
