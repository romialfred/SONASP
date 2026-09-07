-- New receipts require a private verified proof. Historic receipts remain intact.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.snp_affiliation_require(uuid,text)') IS NULL
 OR to_regprocedure('public.snp_claim_affiliation_render(uuid)') IS NULL THEN
  RAISE EXCEPTION 'Le socle des affiliations doit être installé avant ce correctif.';
 END IF;
END $$;

CREATE TABLE public.snp_adhesion_preuves(
 paiement_id uuid PRIMARY KEY,
 droit_id uuid NOT NULL REFERENCES public.snp_adhesion_droits(id),
 artisan_id uuid NOT NULL REFERENCES public.snp_artisans_miniers(id),
 path text NOT NULL UNIQUE,
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 180),
 mime_type text NOT NULL CHECK(mime_type IN ('application/pdf','image/png','image/jpeg')),
 file_size integer NOT NULL CHECK(file_size BETWEEN 1 AND 5242880),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(path=artisan_id::text||'/'||droit_id::text||'/'||paiement_id::text||CASE mime_type WHEN 'application/pdf' THEN '.pdf' WHEN 'image/png' THEN '.png' ELSE '.jpg' END)
);
CREATE INDEX adhesion_preuves_droit ON public.snp_adhesion_preuves(droit_id);
CREATE INDEX adhesion_preuves_artisan ON public.snp_adhesion_preuves(artisan_id);
ALTER TABLE public.snp_adhesion_preuves ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.snp_adhesion_preuves FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.snp_adhesion_preuves TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.snp_adhesion_preuves TO service_role;
CREATE POLICY adhesion_preuves_read ON public.snp_adhesion_preuves FOR SELECT TO authenticated
 USING(public.snp_affiliation_readable(artisan_id) AND
 (uploaded_by=(SELECT auth.uid()) OR public.snp_actor_has_capability('artisan.membership.confirm') OR public.snp_actor_has_capability('artisan.membership.manage') OR public.snp_actor_has_capability('artisan.cards.activate')));

ALTER TABLE public.snp_adhesion_encaissements
 ADD COLUMN annee_adhesion integer CHECK(annee_adhesion BETWEEN 1900 AND 2200),
 ADD COLUMN lieu_paiement text CHECK(length(trim(lieu_paiement)) BETWEEN 2 AND 160),
 ADD COLUMN preuve_path text REFERENCES public.snp_adhesion_preuves(path);
ALTER TABLE public.snp_adhesion_encaissements ADD CONSTRAINT adhesion_receipt_evidence_complete
 CHECK((annee_adhesion IS NULL AND lieu_paiement IS NULL AND preuve_path IS NULL)
 OR (annee_adhesion IS NOT NULL AND lieu_paiement IS NOT NULL AND preuve_path IS NOT NULL));

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('affiliation-payment-proofs','affiliation-payment-proofs',false,5242880,ARRAY['image/jpeg','image/png','application/pdf']);
CREATE POLICY adhesion_proofs_download ON storage.objects FOR SELECT TO authenticated USING(
 bucket_id='affiliation-payment-proofs' AND EXISTS(SELECT 1 FROM public.snp_adhesion_preuves p WHERE p.path=name));
CREATE POLICY adhesion_proofs_download_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(
 bucket_id<>'affiliation-payment-proofs' OR EXISTS(SELECT 1 FROM public.snp_adhesion_preuves p WHERE p.path=name));
CREATE POLICY adhesion_proofs_insert_boundary ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'affiliation-payment-proofs');
CREATE POLICY adhesion_proofs_update_boundary ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'affiliation-payment-proofs') WITH CHECK(bucket_id<>'affiliation-payment-proofs');
CREATE POLICY adhesion_proofs_delete_boundary ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'affiliation-payment-proofs');
CREATE POLICY adhesion_proofs_anon_boundary ON storage.objects AS RESTRICTIVE FOR ALL TO anon USING(bucket_id<>'affiliation-payment-proofs') WITH CHECK(bucket_id<>'affiliation-payment-proofs');

-- Called using the verified user's JWT by the upload worker. No browser-provided tenant.
CREATE FUNCTION public.snp_adhesion_preuve_allowed(p_droit uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
DECLARE d public.snp_adhesion_droits;
BEGIN
 SELECT * INTO d FROM public.snp_adhesion_droits WHERE id=p_droit;
 PERFORM public.snp_affiliation_require(d.artisan_id,'artisan.membership.manage');
 IF d.statut IS DISTINCT FROM 'ouvert' THEN RAISE EXCEPTION 'Ces droits ne peuvent pas recevoir de paiement.'; END IF;
 RETURN jsonb_build_object('artisan_id',d.artisan_id,'droit_id',d.id,'actor_id',auth.uid());
END $$;

-- The old six-argument endpoint cannot bypass the required evidence.
CREATE OR REPLACE FUNCTION public.snp_enregistrer_adhesion_encaissement(p_id uuid,p_droit uuid,p_montant numeric,p_reference text,p_mode text,p_date date)
RETURNS public.snp_adhesion_encaissements LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
BEGIN RAISE EXCEPTION 'Renseignez l’année, le lieu et la preuve du paiement dans le formulaire actualisé.'; END $$;

CREATE FUNCTION public.snp_enregistrer_adhesion_encaissement(p_id uuid,p_droit uuid,p_montant numeric,p_reference text,p_mode text,p_date date,p_annee integer,p_lieu text,p_preuve text)
RETURNS public.snp_adhesion_encaissements LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
DECLARE d public.snp_adhesion_droits; r public.snp_adhesion_encaissements; proof public.snp_adhesion_preuves;
BEGIN
 SELECT * INTO d FROM public.snp_adhesion_droits WHERE id=p_droit;
 PERFORM public.snp_affiliation_require(d.artisan_id,'artisan.membership.manage');
 PERFORM 1 FROM public.snp_cartes_professionnelles WHERE id=d.carte_id FOR UPDATE;
 SELECT * INTO d FROM public.snp_adhesion_droits WHERE id=p_droit FOR UPDATE;
 SELECT * INTO r FROM public.snp_adhesion_encaissements WHERE id=p_id;
 IF FOUND THEN
  IF (r.droit_id,r.montant,r.reference,r.mode,r.date_paiement,r.annee_adhesion,r.lieu_paiement,r.preuve_path)
  IS DISTINCT FROM(p_droit,p_montant,trim(p_reference),p_mode,p_date,p_annee,trim(p_lieu),p_preuve) THEN
   RAISE EXCEPTION 'Clé de paiement déjà utilisée.' USING ERRCODE='40001';
  END IF;
  RETURN r;
 END IF;
 IF d.statut<>'ouvert' OR p_date IS NULL OR p_date>(clock_timestamp() AT TIME ZONE d.fuseau)::date
 OR p_date<DATE '1900-01-01' THEN RAISE EXCEPTION 'Droits annulés ou date de paiement invalide.'; END IF;
 IF p_annee IS NULL OR p_annee<>EXTRACT(YEAR FROM d.debut)::integer OR coalesce(length(trim(p_lieu)),0) NOT BETWEEN 2 AND 160 THEN
  RAISE EXCEPTION 'Précisez l’année des droits et le lieu du paiement.';
 END IF;
 SELECT * INTO proof FROM public.snp_adhesion_preuves WHERE paiement_id=p_id AND droit_id=d.id AND artisan_id=d.artisan_id AND path=p_preuve AND uploaded_by=auth.uid();
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='affiliation-payment-proofs' AND name=proof.path
  AND metadata->>'mimetype'=proof.mime_type AND (metadata->>'size')::integer=proof.file_size) THEN
  RAISE EXCEPTION 'Joignez une preuve de paiement vérifiée pour ce dossier.';
 END IF;
 IF p_montant IS NULL OR p_montant<=0 OR p_montant>='Infinity'::numeric OR p_montant<>round(p_montant,2)
 OR p_montant+coalesce((SELECT sum(montant) FROM public.snp_adhesion_encaissements WHERE droit_id=d.id AND statut IN ('en_attente','confirme')),0)>d.montant THEN
  RAISE EXCEPTION 'Le montant est invalide ou dépasse le solde disponible de ces droits.';
 END IF;
 INSERT INTO public.snp_adhesion_encaissements(id,droit_id,montant,reference,mode,date_paiement,annee_adhesion,lieu_paiement,preuve_path,created_by)
 VALUES(p_id,p_droit,p_montant,trim(p_reference),p_mode,p_date,p_annee,trim(p_lieu),p_preuve,auth.uid()) RETURNING * INTO r;
 PERFORM public.snp_record_workflow_event('artisan-card',d.carte_id,'payment-recorded',NULL,'en_attente','artisan.membership.manage',NULL,
  jsonb_build_object('paiement_id',r.id,'droit_id',d.id,'annee',p_annee));
 RETURN r;
END $$;

-- Internal prerequisite shared by claim and completion to close payment reversal races.
CREATE FUNCTION public.snp_affiliation_require_paid(c public.snp_cartes_professionnelles)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
DECLARE d public.snp_adhesion_droits; paid numeric;
BEGIN
 SELECT * INTO d FROM public.snp_adhesion_droits WHERE carte_id=coalesce(c.dues_source_card_id,c.id) FOR SHARE;
 SELECT coalesce(sum(montant),0) INTO paid FROM public.snp_adhesion_encaissements WHERE droit_id=d.id AND statut='confirme';
 IF d.id IS NULL OR d.artisan_id<>c.artisan_id OR d.statut<>'ouvert' OR paid<>d.montant THEN
  RAISE EXCEPTION 'La carte est générée après le paiement intégral et la confirmation des droits d’affiliation.';
 END IF;
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
 PERFORM public.snp_affiliation_require_paid(c);
 IF c.render_status='ready' THEN RETURN jsonb_build_object('ready',true); END IF;
 IF c.render_status='rendering' AND c.render_started_at>now()-interval '3 minutes' THEN RAISE EXCEPTION 'Génération déjà en cours. Réessayez dans quelques instants.' USING ERRCODE='40001'; END IF;
 UPDATE public.snp_cartes_professionnelles SET render_status='rendering',render_lease=gen_random_uuid(),render_started_at=now()
 WHERE id=c.id RETURNING * INTO c;
 PERFORM public.snp_record_workflow_event('artisan-card',c.id,'render-requested',NULL,'rendering',NULL,NULL,jsonb_build_object('version',c.affiliation_version,'render_revision',c.render_revision));
 RETURN jsonb_build_object('lease',c.render_lease,'card',public.snp_affiliation_card_json(c));
END $$;

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
 PERFORM public.snp_affiliation_require_paid(c);
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

CREATE OR REPLACE FUNCTION public.snp_affiliation_card_json(c public.snp_cartes_professionnelles)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
 SELECT jsonb_build_object('id',c.id,'artisan_id',c.artisan_id,'numero_carte',c.numero_carte,
  'site_name',coalesce(c.identity_snapshot->>'site_nom', (SELECT s.name FROM public.snp_artisans_miniers a LEFT JOIN public.snp_artisans_miniers parent ON a.type_artisan='aide_exploitant' AND parent.id=a.exploitant_id LEFT JOIN public.artisanal_sites s ON s.id=CASE WHEN a.type_artisan='aide_exploitant' THEN parent.artisanal_site_id ELSE a.artisanal_site_id END WHERE a.id=c.artisan_id),'Non rattaché'),
  'artisan_role',coalesce(c.identity_snapshot->>'role',(SELECT type_artisan FROM public.snp_artisans_miniers WHERE id=c.artisan_id)),
  'identity_ready',c.identity_snapshot IS NOT NULL,
  'adhesion_status',CASE WHEN d.id IS NULL THEN 'non_renseigne' WHEN d.statut='annule' THEN 'annule' WHEN totals.paid=d.montant THEN 'paye' WHEN totals.paid>0 THEN 'partiel' ELSE 'en_attente' END,
  'adhesion_amount',CASE WHEN permissions.can_finance THEN d.montant END,
  'adhesion_paid',CASE WHEN permissions.can_finance AND d.id IS NOT NULL THEN totals.paid END,
  'adhesion_pending',CASE WHEN permissions.can_finance AND d.id IS NOT NULL THEN totals.pending END,
  'adhesion_currency',CASE WHEN permissions.can_finance THEN d.devise END,
  'adhesion_year',EXTRACT(YEAR FROM d.debut)::integer,'adhesion_start',d.debut,'adhesion_end',d.fin,
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
 FROM (SELECT 1) seed LEFT JOIN public.snp_adhesion_droits d ON d.carte_id=coalesce(c.dues_source_card_id,c.id)
 CROSS JOIN LATERAL (SELECT coalesce(sum(montant) FILTER(WHERE statut='confirme'),0) AS paid,coalesce(sum(montant) FILTER(WHERE statut='en_attente'),0) AS pending FROM public.snp_adhesion_encaissements WHERE droit_id=d.id) totals
 CROSS JOIN LATERAL (SELECT public.snp_actor_has_capability('artisan.membership.manage') OR public.snp_actor_has_capability('artisan.membership.confirm') OR public.snp_actor_has_capability('artisan.cards.activate') AS can_finance) permissions
$$;

CREATE OR REPLACE FUNCTION public.snp_preparer_carte_affiliation(p_carte uuid)
RETURNS public.snp_cartes_professionnelles LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','pg_temp' AS $$
DECLARE c public.snp_cartes_professionnelles; a public.snp_artisans_miniers; r public.snp_artisan_responsables; v_site uuid; v_nom text; v_photo text; v_snapshot jsonb;
BEGIN
 SELECT * INTO c FROM public.snp_cartes_professionnelles WHERE id=p_carte;
 IF public.snp_4b_can_manage_artisan(c.artisan_id,'artisan.cards.manage') THEN PERFORM public.snp_affiliation_require(c.artisan_id,'artisan.cards.manage'); ELSE PERFORM public.snp_affiliation_require(c.artisan_id,'artisan.membership.manage'); END IF;
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

REVOKE ALL ON FUNCTION public.snp_adhesion_preuve_allowed(uuid), public.snp_affiliation_require_paid(public.snp_cartes_professionnelles), public.snp_enregistrer_adhesion_encaissement(uuid,uuid,numeric,text,text,date,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.snp_adhesion_preuve_allowed(uuid), public.snp_enregistrer_adhesion_encaissement(uuid,uuid,numeric,text,text,date,integer,text,text) TO authenticated;
DO $$ BEGIN
 IF has_table_privilege('authenticated','public.snp_adhesion_preuves','INSERT') OR has_function_privilege('anon','public.snp_adhesion_preuve_allowed(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'Les écritures et preuves d’adhésion doivent rester privées.';
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
