-- ============================================================================
-- LOT 4B — séparation des fonctions et intégrité réglementaire
-- ============================================================================
-- Portée :
--   * rendre les transitions Contrat/Réquisition/Règlement non contournables
--     par DML PostgREST ;
--   * réserver cartes professionnelles et coordonnées de paiement à deux
--     capabilities dédiées, avec acteurs et audit dérivés côté serveur ;
--   * permettre à une Mine de soumettre une demande de licence sans jamais
--     administrer elle-même l'autorisation, son statut ou son quota ;
--   * conserver le ledger P0 comme seule source de consommation d'un quota.
--
-- Migration additive et réapplicable. Elle n'efface aucune ligne métier.
-- Rollback non destructif documenté en fin de fichier : il consiste à retirer
-- les grants RPC/columnaires ajoutés, sans supprimer demandes ni audit.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '0';

-- --------------------------------------------------------------------------
-- 0. Préflight fail-closed.
-- --------------------------------------------------------------------------
DO $preflight$
DECLARE
  v_object text;
BEGIN
  FOREACH v_object IN ARRAY ARRAY[
    'public.snp_contrats',
    'public.snp_requisitions',
    'public.snp_reglements_achat',
    'public.snp_reglements_affectations',
    'public.snp_reglements_preuves',
    'public.snp_cartes_professionnelles',
    'public.snp_artisan_moyens_paiement',
    'public.snp_artisans_miniers',
    'public.export_licenses',
    'public.export_license_documents',
    'public.snp_capability_catalog',
    'public.snp_role_capabilities',
    'public.snp_workflow_audit'
  ] LOOP
    IF to_regclass(v_object) IS NULL THEN
      RAISE EXCEPTION 'Préflight 4B : objet requis absent : %.', v_object;
    END IF;
  END LOOP;

  IF to_regprocedure('public.snp_actor_has_capability(text)') IS NULL
     OR to_regprocedure('public.snp_require_capability(text)') IS NULL
     OR to_regprocedure('public.snp_record_workflow_event(text,uuid,text,text,text,text,text,jsonb)') IS NULL
     OR to_regprocedure('public.snp_societe_compte_mine()') IS NULL
     OR to_regprocedure('public.snp_sync_shipping_license_reservation(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION
      'Préflight 4B : le socle capabilities, Portail Mine ou ledger P0 est absent.';
  END IF;
END;
$preflight$;

-- --------------------------------------------------------------------------
-- 1. Capabilities sensibles dédiées.
-- --------------------------------------------------------------------------
INSERT INTO public.snp_capability_catalog
  (code, domain, label, description, sensitive)
VALUES
  (
    'artisan.cards.manage', 'artisanat',
    'Administrer les cartes professionnelles',
    'Émettre, renouveler, valider, suspendre ou annuler une carte professionnelle.',
    true
  ),
  (
    'artisan.payment-methods.manage', 'artisanat',
    'Administrer les coordonnées de paiement artisan',
    'Créer, modifier, désactiver et vérifier les coordonnées de règlement des artisans.',
    true
  )
ON CONFLICT (code) DO UPDATE
SET domain = EXCLUDED.domain,
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    sensitive = true;

-- Le Propriétaire possède implicitement toutes les capabilities. L'Admin est
-- le seul rôle habilité par défaut ; toute délégation opérationnelle doit être
-- un override individuel, traçable et borné dans le temps.
INSERT INTO public.snp_role_capabilities(role, capability_code)
VALUES
  ('admin', 'artisan.cards.manage'),
  ('admin', 'artisan.payment-methods.manage')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- 2. Garde générique : une table RPC-only refuse même un grant accidentel.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_4b_require_trusted_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $fn$
BEGIN
  -- Dans une RPC SECURITY DEFINER, current_user est le propriétaire de la RPC.
  -- Dans un DML PostgREST direct, current_user vaut anon/authenticated.
  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Mutation directe interdite : utilisez la RPC métier dédiée.'
      USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_4b_require_trusted_mutation()
  FROM PUBLIC, anon, authenticated, service_role;

-- --------------------------------------------------------------------------
-- 3. Contrats et réquisitions : statut/acteurs hors DML direct.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_4b_guard_contrat_direct_dml()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_company uuid;
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF public.snp_actor_has_capability('sonasp.prepare') THEN
      NEW.statut := 'brouillon';
      NEW.created_by := auth.uid();
      NEW.updated_by := auth.uid();
      NEW.date_soumission := NULL;
    ELSIF public.snp_actor_has_capability('mine.operate') THEN
      v_company := public.snp_societe_compte_mine();
      NEW.mining_company_id := v_company;
      NEW.partenaire_type := 'mine_industrielle';
      NEW.statut := 'soumis';
      NEW.created_by := auth.uid();
      NEW.updated_by := auth.uid();
      NEW.date_soumission := now();
    ELSE
      RAISE EXCEPTION 'sonasp.prepare ou mine.operate requis pour créer un contrat.'
        USING ERRCODE = '42501';
    END IF;

    NEW.motif_statut := NULL;
    NEW.date_approbation := NULL;
    NEW.approuve_par := NULL;
    NEW.date_activation := NULL;
    NEW.date_cloture := NULL;
    RETURN NEW;
  END IF;

  IF ROW(
       NEW.statut, NEW.motif_statut, NEW.created_by,
       NEW.date_soumission, NEW.date_approbation, NEW.approuve_par,
       NEW.date_activation, NEW.date_cloture
     ) IS DISTINCT FROM ROW(
       OLD.statut, OLD.motif_statut, OLD.created_by,
       OLD.date_soumission, OLD.date_approbation, OLD.approuve_par,
       OLD.date_activation, OLD.date_cloture
     ) THEN
    RAISE EXCEPTION 'Les états et acteurs d''un contrat se modifient uniquement par RPC.'
      USING ERRCODE = '42501';
  END IF;

  IF public.snp_actor_has_capability('sonasp.prepare') THEN
    IF OLD.statut NOT IN ('brouillon', 'soumis', 'rejete') THEN
      RAISE EXCEPTION 'Un contrat % ne se corrige plus par édition directe.', OLD.statut
        USING ERRCODE = '42501';
    END IF;
  ELSIF public.snp_actor_has_capability('mine.operate') THEN
    v_company := public.snp_societe_compte_mine();
    IF OLD.mining_company_id <> v_company
       OR OLD.created_by <> auth.uid()
       OR OLD.statut <> 'soumis'
       OR NEW.mining_company_id IS DISTINCT FROM OLD.mining_company_id THEN
      RAISE EXCEPTION 'La Mine ne corrige que sa proposition soumise, dans son tenant.'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Capacité de préparation absente.' USING ERRCODE = '42501';
  END IF;

  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_4b_guard_requisition_direct_dml()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  PERFORM public.snp_require_capability('sonasp.prepare');

  IF TG_OP = 'INSERT' THEN
    NEW.statut := 'brouillon';
    NEW.created_by := auth.uid();
    NEW.updated_by := auth.uid();
    NEW.motif_statut := NULL;
    NEW.date_autorisation := NULL;
    NEW.autorisee_par := NULL;
    NEW.date_notification := NULL;
    NEW.date_executoire := NULL;
    NEW.date_cloture := NULL;
    NEW.imputation_decidee_par := NULL;
    NEW.imputation_decidee_le := NULL;
    RETURN NEW;
  END IF;

  IF ROW(
       NEW.statut, NEW.motif_statut, NEW.created_by,
       NEW.date_autorisation, NEW.autorisee_par,
       NEW.date_notification, NEW.date_executoire, NEW.date_cloture,
       NEW.imputation_decidee_par, NEW.imputation_decidee_le,
       NEW.accord_mine, NEW.accord_recu_le,
       NEW.contestation_motif, NEW.contestation_recue_le,
       NEW.observations_mine, NEW.observations_recues_le
     ) IS DISTINCT FROM ROW(
       OLD.statut, OLD.motif_statut, OLD.created_by,
       OLD.date_autorisation, OLD.autorisee_par,
       OLD.date_notification, OLD.date_executoire, OLD.date_cloture,
       OLD.imputation_decidee_par, OLD.imputation_decidee_le,
       OLD.accord_mine, OLD.accord_recu_le,
       OLD.contestation_motif, OLD.contestation_recue_le,
       OLD.observations_mine, OLD.observations_recues_le
     ) THEN
    RAISE EXCEPTION 'Les décisions et acteurs d''une réquisition se modifient uniquement par RPC.'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.statut NOT IN ('brouillon', 'verification_juridique') THEN
    RAISE EXCEPTION 'Une réquisition % ne se corrige plus par édition directe.', OLD.statut
      USING ERRCODE = '42501';
  END IF;

  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_4b_guard_contrat_direct_dml()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_4b_guard_requisition_direct_dml()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS snp_4b_guard_contrat_direct_dml ON public.snp_contrats;
CREATE TRIGGER snp_4b_guard_contrat_direct_dml
BEFORE INSERT OR UPDATE ON public.snp_contrats
FOR EACH ROW EXECUTE FUNCTION public.snp_4b_guard_contrat_direct_dml();

DROP TRIGGER IF EXISTS snp_4b_guard_requisition_direct_dml ON public.snp_requisitions;
CREATE TRIGGER snp_4b_guard_requisition_direct_dml
BEFORE INSERT OR UPDATE ON public.snp_requisitions
FOR EACH ROW EXECUTE FUNCTION public.snp_4b_guard_requisition_direct_dml();

-- Les fonctions historiques de transition restent le moteur de validation,
-- mais deviennent des implémentations privées derrière une nouvelle garde.
DO $rename_transitions$
BEGIN
  IF to_regprocedure('public.snp_changer_statut_contrat_legacy_4b(uuid,text,text,text)') IS NULL THEN
    ALTER FUNCTION public.snp_changer_statut_contrat(uuid,text,text,text)
      RENAME TO snp_changer_statut_contrat_legacy_4b;
  END IF;
  IF to_regprocedure('public.snp_changer_statut_requisition_legacy_4b(uuid,text,text,text)') IS NULL THEN
    ALTER FUNCTION public.snp_changer_statut_requisition(uuid,text,text,text)
      RENAME TO snp_changer_statut_requisition_legacy_4b;
  END IF;
END;
$rename_transitions$;

CREATE OR REPLACE FUNCTION public.snp_changer_statut_contrat(
  p_contrat_id uuid,
  p_statut text,
  p_motif text DEFAULT NULL,
  p_commentaire text DEFAULT NULL
)
RETURNS public.snp_contrats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_before public.snp_contrats%ROWTYPE;
  v_after public.snp_contrats%ROWTYPE;
  v_capability text;
BEGIN
  SELECT * INTO v_before
  FROM public.snp_contrats
  WHERE id = p_contrat_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrat introuvable.' USING ERRCODE = 'P0002';
  END IF;

  v_capability := CASE
    WHEN p_statut IN ('soumis', 'brouillon') THEN 'sonasp.prepare'
    WHEN p_statut IN (
      'revue_juridique', 'validation_metier', 'validation_financiere',
      'approuve', 'rejete', 'signe', 'actif', 'suspendu',
      'echu', 'resilie', 'cloture', 'annule'
    ) THEN 'sonasp.approve'
    ELSE NULL
  END;
  IF v_capability IS NULL THEN
    RAISE EXCEPTION 'État de contrat sans capability définie : %.', p_statut
      USING ERRCODE = '22023';
  END IF;
  PERFORM public.snp_require_capability(v_capability);

  IF v_capability = 'sonasp.approve'
     AND auth.uid() IS NOT NULL
     AND (auth.uid() = v_before.created_by OR auth.uid() = v_before.updated_by) THEN
    RAISE EXCEPTION 'Séparation des fonctions : le préparateur ne décide pas sur son contrat.'
      USING ERRCODE = '42501';
  END IF;

  v_after := public.snp_changer_statut_contrat_legacy_4b(
    p_contrat_id, p_statut, p_motif, p_commentaire
  );

  PERFORM public.snp_record_workflow_event(
    'contrat', p_contrat_id, 'status-changed', v_before.statut, v_after.statut,
    v_capability, p_motif,
    jsonb_build_object('mining_company_id', v_before.mining_company_id)
  );
  RETURN v_after;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_changer_statut_requisition(
  p_requisition_id uuid,
  p_statut text,
  p_motif text DEFAULT NULL,
  p_commentaire text DEFAULT NULL
)
RETURNS public.snp_requisitions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_before public.snp_requisitions%ROWTYPE;
  v_after public.snp_requisitions%ROWTYPE;
  v_capability text;
BEGIN
  SELECT * INTO v_before
  FROM public.snp_requisitions
  WHERE id = p_requisition_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réquisition introuvable.' USING ERRCODE = 'P0002';
  END IF;

  v_capability := CASE
    WHEN p_statut IN (
      'verification_juridique', 'brouillon', 'notifiee', 'accusee',
      'enlevement_planifie', 'en_cours_enlevement', 'collectee',
      'en_analyse', 'acceptee', 'facturee', 'payee', 'cloturee'
    ) THEN 'sonasp.prepare'
    WHEN p_statut IN (
      'validation_metier', 'validation_direction', 'autorisee', 'executoire',
      'contestee', 'suspendue', 'annulee'
    ) THEN 'sonasp.approve'
    ELSE NULL
  END;
  IF v_capability IS NULL THEN
    RAISE EXCEPTION 'État de réquisition sans capability définie : %.', p_statut
      USING ERRCODE = '22023';
  END IF;
  PERFORM public.snp_require_capability(v_capability);

  IF v_capability = 'sonasp.approve'
     AND auth.uid() IS NOT NULL
     AND (auth.uid() = v_before.created_by OR auth.uid() = v_before.updated_by) THEN
    RAISE EXCEPTION 'Séparation des fonctions : le préparateur ne décide pas sur sa réquisition.'
      USING ERRCODE = '42501';
  END IF;

  v_after := public.snp_changer_statut_requisition_legacy_4b(
    p_requisition_id, p_statut, p_motif, p_commentaire
  );

  PERFORM public.snp_record_workflow_event(
    'requisition', p_requisition_id, 'status-changed', v_before.statut, v_after.statut,
    v_capability, p_motif,
    jsonb_build_object('mining_company_id', v_before.mining_company_id)
  );
  RETURN v_after;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_changer_statut_contrat_legacy_4b(uuid,text,text,text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_changer_statut_requisition_legacy_4b(uuid,text,text,text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_changer_statut_contrat(uuid,text,text,text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.snp_changer_statut_requisition(uuid,text,text,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.snp_changer_statut_contrat(uuid,text,text,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_changer_statut_requisition(uuid,text,text,text)
  TO authenticated;

-- RLS explicite et grants columnaires. INSERT est conservé pour les formulaires
-- existants, mais les triggers imposent l'état initial et les acteurs serveur.
ALTER TABLE public.snp_contrats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_contrats FORCE ROW LEVEL SECURITY;
ALTER TABLE public.snp_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_requisitions FORCE ROW LEVEL SECURITY;

DO $drop_main_policies$
DECLARE v record;
BEGIN
  FOR v IN SELECT tablename, policyname FROM pg_policies
           WHERE schemaname='public'
             AND tablename IN ('snp_contrats','snp_requisitions')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v.policyname, v.tablename);
  END LOOP;
END;
$drop_main_policies$;

CREATE POLICY snp_4b_contrats_select ON public.snp_contrats
FOR SELECT TO authenticated USING (
  public.snp_est_agent_sonasp()
  OR public.snp_est_direction_lecture()
  OR CASE WHEN public.snp_actor_has_capability('mine.operate') THEN
       mining_company_id = public.snp_societe_compte_mine()
       AND (statut IN ('signe','actif','suspendu','echu','resilie','cloture')
            OR created_by = auth.uid())
     ELSE false END
);
CREATE POLICY snp_4b_contrats_insert ON public.snp_contrats
FOR INSERT TO authenticated WITH CHECK (
  public.snp_actor_has_capability('sonasp.prepare')
  OR CASE WHEN public.snp_actor_has_capability('mine.operate') THEN
       mining_company_id = public.snp_societe_compte_mine()
       AND partenaire_type = 'mine_industrielle'
       AND statut = 'soumis'
       AND created_by = auth.uid()
     ELSE false END
);
CREATE POLICY snp_4b_contrats_update_safe ON public.snp_contrats
FOR UPDATE TO authenticated USING (
  (public.snp_actor_has_capability('sonasp.prepare')
   AND statut IN ('brouillon','soumis','rejete'))
  OR CASE WHEN public.snp_actor_has_capability('mine.operate') THEN
       mining_company_id = public.snp_societe_compte_mine()
       AND statut = 'soumis' AND created_by = auth.uid()
     ELSE false END
) WITH CHECK (
  (public.snp_actor_has_capability('sonasp.prepare')
   AND statut IN ('brouillon','soumis','rejete'))
  OR CASE WHEN public.snp_actor_has_capability('mine.operate') THEN
       mining_company_id = public.snp_societe_compte_mine()
       AND statut = 'soumis' AND created_by = auth.uid()
     ELSE false END
);

CREATE POLICY snp_4b_requisitions_select ON public.snp_requisitions
FOR SELECT TO authenticated USING (
  public.snp_est_agent_sonasp()
  OR public.snp_est_direction_lecture()
  OR CASE WHEN public.snp_actor_has_capability('mine.operate') THEN
       mining_company_id = public.snp_societe_compte_mine()
       AND statut NOT IN (
         'brouillon','verification_juridique','validation_metier',
         'validation_direction','autorisee','annulee'
       )
     ELSE false END
);
CREATE POLICY snp_4b_requisitions_insert ON public.snp_requisitions
FOR INSERT TO authenticated WITH CHECK (
  public.snp_actor_has_capability('sonasp.prepare')
  AND statut = 'brouillon' AND created_by = auth.uid()
);
CREATE POLICY snp_4b_requisitions_update_safe ON public.snp_requisitions
FOR UPDATE TO authenticated
USING (public.snp_actor_has_capability('sonasp.prepare')
       AND statut IN ('brouillon','verification_juridique'))
WITH CHECK (public.snp_actor_has_capability('sonasp.prepare')
            AND statut IN ('brouillon','verification_juridique'));

REVOKE ALL PRIVILEGES ON TABLE public.snp_contrats, public.snp_requisitions
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.snp_contrats, public.snp_requisitions
  TO authenticated;

GRANT UPDATE (
  intitule, partenaire_type, mining_company_id, artisan_id, site_id,
  partenaire_libelle, representant_partenaire, representant_contact,
  type_contrat, contrat_parent_id, contrat_precedent_id, version,
  direction_responsable, gestionnaire_id, date_signature, date_debut, date_fin,
  reconduction, preavis_reconduction_jours, unite, quantite_totale,
  quantite_minimale, quantite_maximale, periodicite, tolerance_quantite_pct,
  report_reliquat, plafond_depassement_pct, livraison_anticipee_autorisee,
  teneur_reference_pct, teneur_minimale_pct, teneur_tolerance_pct,
  methode_echantillonnage, methode_analyse, laboratoire_initial,
  laboratoire_independant, delai_contestation_jours, frais_contre_expertise,
  teneur_faisant_foi, methode_prix, source_cours, devise_cours,
  devise_reglement, prix_fixe_fcfa, prime_pct, decote_pct, formule_prix,
  prix_ajuste_sur_teneur, conditions_livraison, conditions_enlevement,
  modalites_pesee, transfert_propriete, conditions_paiement,
  delai_paiement_jours, penalites, force_majeure, reglement_differends,
  confidentialite, obligations_fournisseur, obligations_sonasp, observations
) ON public.snp_contrats TO authenticated;

GRANT UPDATE (
  objet, partenaire_type, mining_company_id, site_id, contrat_id,
  type_requisition, regime_juridique, autorite_origine, nature_acte,
  reference_acte, date_signature_acte, date_effet, periode_debut, periode_fin,
  quantite_oz, unite, pourcentage_production, produits_concernes,
  teneur_estimee_pct, lieu_stockage, lieu_enlevement,
  delai_mise_a_disposition_jours, modalites_enlevement, conditions_transport,
  conditions_analyse, methode_prix, prix_once_fcfa, modalites_paiement,
  responsable_id, equipe, confidentialite, observations
) ON public.snp_requisitions TO authenticated;

-- --------------------------------------------------------------------------
-- 4. Règlements : agrégat RPC-only et wrappers capability minimaux.
-- --------------------------------------------------------------------------
DO $rename_payment_rpcs$
BEGIN
  IF to_regprocedure('public.snp_preparer_reglement_legacy_4b(uuid,uuid,numeric,jsonb,date,text,text,text)') IS NULL THEN
    ALTER FUNCTION public.snp_preparer_reglement(uuid,uuid,numeric,jsonb,date,text,text,text)
      RENAME TO snp_preparer_reglement_legacy_4b;
  END IF;
  IF to_regprocedure('public.snp_enregistrer_reglement_legacy_4b(uuid,numeric,date,text,text,text,text,boolean)') IS NULL THEN
    ALTER FUNCTION public.snp_enregistrer_reglement(uuid,numeric,date,text,text,text,text,boolean)
      RENAME TO snp_enregistrer_reglement_legacy_4b;
  END IF;
  IF to_regprocedure('public.snp_affecter_reglement_legacy_4b(uuid,uuid,numeric,text)') IS NULL THEN
    ALTER FUNCTION public.snp_affecter_reglement(uuid,uuid,numeric,text)
      RENAME TO snp_affecter_reglement_legacy_4b;
  END IF;
  IF to_regprocedure('public.snp_affecter_fifo_legacy_4b(uuid)') IS NULL THEN
    ALTER FUNCTION public.snp_affecter_fifo(uuid)
      RENAME TO snp_affecter_fifo_legacy_4b;
  END IF;
  IF to_regprocedure('public.snp_annuler_affectation_legacy_4b(uuid,text)') IS NULL THEN
    ALTER FUNCTION public.snp_annuler_affectation(uuid,text)
      RENAME TO snp_annuler_affectation_legacy_4b;
  END IF;
END;
$rename_payment_rpcs$;

CREATE OR REPLACE FUNCTION public.snp_preparer_reglement(
  p_mining_company_id uuid, p_compte_bancaire_id uuid, p_montant numeric,
  p_affectations jsonb, p_date_execution_prevue date DEFAULT NULL,
  p_objet text DEFAULT NULL, p_reference_interne text DEFAULT NULL,
  p_observations text DEFAULT NULL
)
RETURNS TABLE(r_reglement_id uuid, r_reference text, r_affecte numeric, r_non_affecte numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
  PERFORM public.snp_require_capability('sonasp.prepare');
  RETURN QUERY SELECT * FROM public.snp_preparer_reglement_legacy_4b(
    p_mining_company_id, p_compte_bancaire_id, p_montant, p_affectations,
    p_date_execution_prevue, p_objet, p_reference_interne, p_observations
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_enregistrer_reglement(
  p_mining_company_id uuid, p_montant numeric, p_date date DEFAULT CURRENT_DATE,
  p_mode text DEFAULT 'virement', p_banque text DEFAULT NULL,
  p_reference_bancaire text DEFAULT NULL, p_observations text DEFAULT NULL,
  p_affecter_fifo boolean DEFAULT false
)
RETURNS TABLE(reglement_id uuid, reference text, montant_affecte numeric, solde_non_affecte numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
  PERFORM public.snp_require_capability('sonasp.prepare');
  RETURN QUERY SELECT * FROM public.snp_enregistrer_reglement_legacy_4b(
    p_mining_company_id, p_montant, p_date, p_mode, p_banque,
    p_reference_bancaire, p_observations, p_affecter_fifo
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_affecter_reglement(
  p_reglement_id uuid, p_facture_id uuid, p_montant numeric,
  p_observations text DEFAULT NULL
)
RETURNS TABLE(affectation_id uuid, reste_facture numeric, solde_reglement numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
  PERFORM public.snp_require_capability('sonasp.prepare');
  RETURN QUERY SELECT * FROM public.snp_affecter_reglement_legacy_4b(
    p_reglement_id, p_facture_id, p_montant, p_observations
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_affecter_fifo(p_reglement_id uuid)
RETURNS TABLE(factures_soldees integer, montant_affecte numeric, solde_non_affecte numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
  PERFORM public.snp_require_capability('sonasp.prepare');
  RETURN QUERY SELECT * FROM public.snp_affecter_fifo_legacy_4b(p_reglement_id);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_annuler_affectation(
  p_affectation_id uuid, p_motif text
)
RETURNS TABLE(affectation_id uuid, reste_facture numeric, solde_reglement numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
  PERFORM public.snp_require_capability('sonasp.approve');
  RETURN QUERY SELECT * FROM public.snp_annuler_affectation_legacy_4b(
    p_affectation_id, p_motif
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_ajouter_preuve_reglement(
  p_reglement_id uuid, p_type_document text, p_fichier_url text,
  p_nom_origine text, p_type_mime text, p_taille_octets bigint,
  p_empreinte_sha256 text DEFAULT NULL, p_reference_document text DEFAULT NULL,
  p_date_emission date DEFAULT NULL, p_banque_emettrice text DEFAULT NULL,
  p_commentaire text DEFAULT NULL
)
RETURNS public.snp_reglements_preuves
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE
  v_reglement public.snp_reglements_achat%ROWTYPE;
  v_preuve public.snp_reglements_preuves%ROWTYPE;
BEGIN
  PERFORM public.snp_require_capability('sonasp.finance.execute');
  SELECT * INTO v_reglement FROM public.snp_reglements_achat
  WHERE id = p_reglement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Règlement introuvable.' USING ERRCODE='P0002'; END IF;
  IF v_reglement.statut NOT IN ('valide','en_execution') THEN
    RAISE EXCEPTION 'Une preuve bancaire ne s''ajoute qu''à un règlement validé ou en exécution.'
      USING ERRCODE='23514';
  END IF;
  IF auth.uid() IN (v_reglement.prepare_par, v_reglement.soumis_par, v_reglement.valide_par) THEN
    RAISE EXCEPTION 'Séparation des fonctions : l''exécutant est distinct du préparateur et de l''approbateur.'
      USING ERRCODE='42501';
  END IF;
  IF p_type_mime NOT IN ('application/pdf','image/png','image/jpeg')
     OR p_taille_octets <= 0 OR p_taille_octets > 10485760 THEN
    RAISE EXCEPTION 'Format ou taille de preuve bancaire invalide.' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.snp_reglements_preuves(
    reglement_id,type_document,fichier_url,nom_origine,type_mime,taille_octets,
    empreinte_sha256,reference_document,date_emission,banque_emettrice,
    commentaire,statut_verification,ajoute_par,ajoute_le
  ) VALUES (
    p_reglement_id,trim(p_type_document),p_fichier_url,p_nom_origine,p_type_mime,
    p_taille_octets,p_empreinte_sha256,p_reference_document,p_date_emission,
    p_banque_emettrice,p_commentaire,'a_verifier',auth.uid(),now()
  ) RETURNING * INTO v_preuve;
  PERFORM public.snp_record_workflow_event(
    'reglement-preuve', v_preuve.id, 'proof-added', NULL, 'a_verifier',
    'sonasp.finance.execute', NULL,
    jsonb_build_object('reglement_id',p_reglement_id,'mining_company_id',v_reglement.mining_company_id)
  );
  RETURN v_preuve;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_verifier_preuve_reglement(
  p_preuve_id uuid, p_decision text, p_motif text DEFAULT NULL
)
RETURNS public.snp_reglements_preuves
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE v_preuve public.snp_reglements_preuves%ROWTYPE;
BEGIN
  PERFORM public.snp_require_capability('sonasp.finance.reconcile');
  SELECT * INTO v_preuve FROM public.snp_reglements_preuves
  WHERE id=p_preuve_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Preuve introuvable.' USING ERRCODE='P0002'; END IF;
  IF p_decision NOT IN ('verifiee','rejetee') THEN
    RAISE EXCEPTION 'Décision de vérification invalide.' USING ERRCODE='22023';
  END IF;
  IF v_preuve.ajoute_par = auth.uid() THEN
    RAISE EXCEPTION 'Double contrôle requis : l''ajout et la vérification ont des acteurs distincts.'
      USING ERRCODE='42501';
  END IF;
  IF p_decision='rejetee' AND (p_motif IS NULL OR length(trim(p_motif)) < 10) THEN
    RAISE EXCEPTION 'Le rejet exige un motif d''au moins dix caractères.' USING ERRCODE='22023';
  END IF;
  UPDATE public.snp_reglements_preuves
  SET statut_verification=p_decision,
      motif_rejet=CASE WHEN p_decision='rejetee' THEN trim(p_motif) ELSE NULL END,
      verifiee_par=auth.uid(), verifiee_le=now()
  WHERE id=p_preuve_id RETURNING * INTO v_preuve;
  PERFORM public.snp_record_workflow_event(
    'reglement-preuve',p_preuve_id,'proof-reviewed','a_verifier',p_decision,
    'sonasp.finance.reconcile',p_motif,jsonb_build_object('reglement_id',v_preuve.reglement_id)
  );
  RETURN v_preuve;
END;
$fn$;

-- La fonction de transition P0 exige désormais une preuve effectivement
-- vérifiée (et non simplement « non rejetée »).
CREATE OR REPLACE FUNCTION public.snp_4b_verified_payment_proof(p_reglement_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.snp_reglements_preuves
    WHERE reglement_id=p_reglement_id AND statut_verification='verifiee'
  );
$fn$;
REVOKE ALL ON FUNCTION public.snp_4b_verified_payment_proof(uuid)
  FROM PUBLIC,anon,authenticated,service_role;

-- Une exécution sans preuve vérifiée est arrêtée en défense supplémentaire,
-- même si une ancienne version de la RPC de transition réapparaissait.
CREATE OR REPLACE FUNCTION public.snp_4b_guard_reglement_execution()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
  IF NEW.statut='execute' AND OLD.statut IS DISTINCT FROM 'execute'
     AND NOT public.snp_4b_verified_payment_proof(NEW.id) THEN
    RAISE EXCEPTION 'Une preuve bancaire vérifiée est requise avant exécution.'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.snp_4b_guard_reglement_execution()
  FROM PUBLIC,anon,authenticated,service_role;

DROP TRIGGER IF EXISTS snp_4b_guard_reglement_execution ON public.snp_reglements_achat;
CREATE TRIGGER snp_4b_guard_reglement_execution
BEFORE UPDATE OF statut ON public.snp_reglements_achat
FOR EACH ROW EXECUTE FUNCTION public.snp_4b_guard_reglement_execution();

DO $reglement_rpc_only$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'snp_reglements_achat','snp_reglements_affectations','snp_reglements_preuves'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',v_table);
    EXECUTE format('DROP TRIGGER IF EXISTS snp_4b_rpc_only ON public.%I',v_table);
    EXECUTE format(
      'CREATE TRIGGER snp_4b_rpc_only BEFORE INSERT OR UPDATE OR DELETE ON public.%I '
      || 'FOR EACH ROW EXECUTE FUNCTION public.snp_4b_require_trusted_mutation()',v_table
    );
    EXECUTE format(
      'REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.%I '
      || 'FROM PUBLIC,anon,authenticated',v_table
    );
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',v_table);
  END LOOP;
END;
$reglement_rpc_only$;

DO $payment_rpc_acl$
DECLARE v record; v_sig text;
BEGIN
  FOR v IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN (
      'snp_preparer_reglement_legacy_4b','snp_enregistrer_reglement_legacy_4b',
      'snp_affecter_reglement_legacy_4b','snp_affecter_fifo_legacy_4b',
      'snp_annuler_affectation_legacy_4b'
    )
  LOOP
    v_sig := format('public.%I(%s)',v.proname,v.args);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',v_sig);
  END LOOP;
END;
$payment_rpc_acl$;

REVOKE ALL ON FUNCTION public.snp_preparer_reglement(uuid,uuid,numeric,jsonb,date,text,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_enregistrer_reglement(uuid,numeric,date,text,text,text,text,boolean)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_affecter_reglement(uuid,uuid,numeric,text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_affecter_fifo(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_annuler_affectation(uuid,text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_ajouter_preuve_reglement(uuid,text,text,text,text,bigint,text,text,date,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_verifier_preuve_reglement(uuid,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.snp_preparer_reglement(uuid,uuid,numeric,jsonb,date,text,text,text),
  public.snp_enregistrer_reglement(uuid,numeric,date,text,text,text,text,boolean),
  public.snp_affecter_reglement(uuid,uuid,numeric,text),
  public.snp_affecter_fifo(uuid),
  public.snp_annuler_affectation(uuid,text),
  public.snp_ajouter_preuve_reglement(uuid,text,text,text,text,bigint,text,text,date,text,text),
  public.snp_verifier_preuve_reglement(uuid,text,text)
TO authenticated;

-- --------------------------------------------------------------------------
-- 5. Cartes professionnelles et moyens de paiement artisans.
-- --------------------------------------------------------------------------
ALTER TABLE public.snp_cartes_professionnelles
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS validee_le timestamptz,
  ADD COLUMN IF NOT EXISTS suspendue_le timestamptz,
  ADD COLUMN IF NOT EXISTS suspendue_par uuid;

DO $card_actor_fks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.snp_cartes_professionnelles'::regclass AND conname='snp_cartes_created_by_fkey') THEN
    ALTER TABLE public.snp_cartes_professionnelles ADD CONSTRAINT snp_cartes_created_by_fkey
      FOREIGN KEY(created_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.snp_cartes_professionnelles'::regclass AND conname='snp_cartes_updated_by_fkey') THEN
    ALTER TABLE public.snp_cartes_professionnelles ADD CONSTRAINT snp_cartes_updated_by_fkey
      FOREIGN KEY(updated_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END;
$card_actor_fks$;
ALTER TABLE public.snp_cartes_professionnelles VALIDATE CONSTRAINT snp_cartes_created_by_fkey;
ALTER TABLE public.snp_cartes_professionnelles VALIDATE CONSTRAINT snp_cartes_updated_by_fkey;

CREATE OR REPLACE FUNCTION public.snp_4b_can_manage_artisan(
  p_artisan_id uuid, p_capability text
)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  SELECT public.snp_actor_has_capability(p_capability)
     AND EXISTS (SELECT 1 FROM public.snp_artisans_miniers a WHERE a.id=p_artisan_id)
     AND (
       public.snp_role_utilisateur() IN ('owner','admin')
       OR public.snp_can_access_artisan(p_artisan_id)
     );
$fn$;
REVOKE ALL ON FUNCTION public.snp_4b_can_manage_artisan(uuid,text)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.snp_4b_payment_snapshot(
  p_row public.snp_artisan_moyens_paiement
)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER
SET search_path TO 'pg_catalog','pg_temp' AS $fn$
  SELECT CASE WHEN p_row IS NULL THEN NULL ELSE jsonb_build_object(
    'artisan_id',p_row.artisan_id,'type',p_row.type,'est_principal',p_row.est_principal,
    'actif',p_row.actif,'verifie',p_row.verifie_le IS NOT NULL,
    'mobile_last4',right(regexp_replace(coalesce(p_row.numero_telephone,''),'\s','','g'),4),
    'account_last4',right(regexp_replace(coalesce(p_row.numero_compte,''),'\s','','g'),4)
  ) END;
$fn$;
REVOKE ALL ON FUNCTION public.snp_4b_payment_snapshot(public.snp_artisan_moyens_paiement)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.snp_4b_card_snapshot(
  p_row public.snp_cartes_professionnelles
)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER
SET search_path TO 'pg_catalog','pg_temp' AS $fn$
  SELECT CASE WHEN p_row IS NULL THEN NULL ELSE jsonb_build_object(
    'artisan_id',p_row.artisan_id,'statut',p_row.statut,
    'date_emission',p_row.date_emission,'date_expiration',p_row.date_expiration,
    'validated',p_row.validee_le IS NOT NULL,'suspended',p_row.suspendue_le IS NOT NULL
  ) END;
$fn$;
REVOKE ALL ON FUNCTION public.snp_4b_card_snapshot(public.snp_cartes_professionnelles)
  FROM PUBLIC,anon,authenticated,service_role;

-- Le trigger historique de création automatique devient SECURITY DEFINER :
-- après révocation du DML client, la création de l'artisan reste atomique.
CREATE OR REPLACE FUNCTION public.create_carte_professionnelle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
  INSERT INTO public.snp_cartes_professionnelles(
    artisan_id,numero_carte,date_emission,date_expiration,statut,created_by,updated_by
  ) VALUES (
    NEW.id,NEW.numero_carte,CURRENT_DATE,CURRENT_DATE+730,'en_cours',auth.uid(),auth.uid()
  ) ON CONFLICT (numero_carte) DO NOTHING;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.create_carte_professionnelle()
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.snp_renouveler_carte_professionnelle(
  p_artisan_id uuid, p_date_expiration date DEFAULT NULL,
  p_observations text DEFAULT NULL
)
RETURNS public.snp_cartes_professionnelles
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE
  v_before public.snp_cartes_professionnelles%ROWTYPE;
  v_after public.snp_cartes_professionnelles%ROWTYPE;
BEGIN
  IF NOT public.snp_4b_can_manage_artisan(p_artisan_id,'artisan.cards.manage') THEN
    RAISE EXCEPTION 'artisan.cards.manage et périmètre artisan requis.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_before FROM public.snp_cartes_professionnelles
  WHERE artisan_id=p_artisan_id ORDER BY created_at DESC NULLS LAST,id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Carte professionnelle introuvable.' USING ERRCODE='P0002'; END IF;
  IF coalesce(p_date_expiration,CURRENT_DATE+730) <= CURRENT_DATE THEN
    RAISE EXCEPTION 'La nouvelle expiration doit être future.' USING ERRCODE='22023';
  END IF;
  UPDATE public.snp_cartes_professionnelles
  SET date_emission=CURRENT_DATE,
      date_expiration=coalesce(p_date_expiration,CURRENT_DATE+730),
      statut='en_cours',date_validation=NULL,validee_le=NULL,validee_par=NULL,
      date_suspension=NULL,suspendue_le=NULL,suspendue_par=NULL,motif_suspension=NULL,
      observations=p_observations,updated_by=auth.uid(),updated_at=now()
  WHERE id=v_before.id RETURNING * INTO v_after;
  PERFORM public.snp_record_workflow_event(
    'artisan-card',v_after.id,'renewed',v_before.statut,v_after.statut,
    'artisan.cards.manage',p_observations,
    jsonb_build_object('before',public.snp_4b_card_snapshot(v_before),'after',public.snp_4b_card_snapshot(v_after))
  );
  RETURN v_after;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_transition_carte_professionnelle(
  p_carte_id uuid, p_expected_statut text, p_nouveau_statut text,
  p_motif text DEFAULT NULL
)
RETURNS public.snp_cartes_professionnelles
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE
  v_before public.snp_cartes_professionnelles%ROWTYPE;
  v_after public.snp_cartes_professionnelles%ROWTYPE;
  v_allowed text[];
BEGIN
  SELECT * INTO v_before FROM public.snp_cartes_professionnelles
  WHERE id=p_carte_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Carte professionnelle introuvable.' USING ERRCODE='P0002'; END IF;
  IF NOT public.snp_4b_can_manage_artisan(v_before.artisan_id,'artisan.cards.manage') THEN
    RAISE EXCEPTION 'artisan.cards.manage et périmètre artisan requis.' USING ERRCODE='42501';
  END IF;
  IF v_before.statut IS DISTINCT FROM p_expected_statut THEN
    RAISE EXCEPTION 'Conflit optimiste : état attendu %, état courant %.',p_expected_statut,v_before.statut
      USING ERRCODE='40001';
  END IF;
  v_allowed := CASE v_before.statut
    WHEN 'en_cours' THEN ARRAY['validee','annulee']
    WHEN 'validee' THEN ARRAY['en_exploitation','suspendue','annulee']
    WHEN 'en_exploitation' THEN ARRAY['suspendue','expiree','annulee']
    WHEN 'suspendue' THEN ARRAY['validee','annulee']
    ELSE ARRAY[]::text[] END;
  IF NOT p_nouveau_statut=ANY(v_allowed) THEN
    RAISE EXCEPTION 'Transition de carte interdite : % vers %.',v_before.statut,p_nouveau_statut
      USING ERRCODE='22023';
  END IF;
  IF p_nouveau_statut IN ('suspendue','annulee')
     AND (p_motif IS NULL OR length(trim(p_motif))<10) THEN
    RAISE EXCEPTION 'Suspension/annulation : motif de dix caractères minimum.' USING ERRCODE='22023';
  END IF;
  IF p_nouveau_statut='validee'
     AND (auth.uid()=v_before.created_by OR auth.uid()=v_before.updated_by) THEN
    RAISE EXCEPTION 'Double contrôle requis : l''émetteur/éditeur ne valide pas sa carte.'
      USING ERRCODE='42501';
  END IF;
  UPDATE public.snp_cartes_professionnelles
  SET statut=p_nouveau_statut,
      validee_par=CASE WHEN p_nouveau_statut='validee' THEN auth.uid() ELSE validee_par END,
      validee_le=CASE WHEN p_nouveau_statut='validee' THEN now() ELSE validee_le END,
      date_validation=CASE WHEN p_nouveau_statut='validee' THEN CURRENT_DATE ELSE date_validation END,
      suspendue_par=CASE WHEN p_nouveau_statut='suspendue' THEN auth.uid()
                         WHEN p_nouveau_statut='validee' THEN NULL ELSE suspendue_par END,
      suspendue_le=CASE WHEN p_nouveau_statut='suspendue' THEN now()
                        WHEN p_nouveau_statut='validee' THEN NULL ELSE suspendue_le END,
      date_suspension=CASE WHEN p_nouveau_statut='suspendue' THEN CURRENT_DATE
                           WHEN p_nouveau_statut='validee' THEN NULL ELSE date_suspension END,
      motif_suspension=CASE WHEN p_nouveau_statut='suspendue' THEN trim(p_motif)
                            WHEN p_nouveau_statut='validee' THEN NULL ELSE motif_suspension END,
      updated_by=auth.uid(),updated_at=now()
  WHERE id=p_carte_id RETURNING * INTO v_after;
  PERFORM public.snp_record_workflow_event(
    'artisan-card',p_carte_id,'status-changed',v_before.statut,v_after.statut,
    'artisan.cards.manage',p_motif,
    jsonb_build_object('before',public.snp_4b_card_snapshot(v_before),'after',public.snp_4b_card_snapshot(v_after))
  );
  RETURN v_after;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_upsert_artisan_moyen_paiement(
  p_artisan_id uuid, p_type text, p_titulaire text,
  p_moyen_id uuid DEFAULT NULL, p_libelle text DEFAULT NULL,
  p_numero_telephone text DEFAULT NULL, p_banque text DEFAULT NULL,
  p_numero_compte text DEFAULT NULL, p_code_swift text DEFAULT NULL,
  p_est_principal boolean DEFAULT false, p_actif boolean DEFAULT true,
  p_observations text DEFAULT NULL
)
RETURNS public.snp_artisan_moyens_paiement
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE
  v_before public.snp_artisan_moyens_paiement%ROWTYPE;
  v_after public.snp_artisan_moyens_paiement%ROWTYPE;
  v_sensitive_changed boolean;
BEGIN
  IF NOT public.snp_4b_can_manage_artisan(p_artisan_id,'artisan.payment-methods.manage') THEN
    RAISE EXCEPTION 'artisan.payment-methods.manage et périmètre artisan requis.' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_artisan_id::text,4204));
  IF p_type NOT IN ('orange_money','moov_money','wave','mobile_money','virement_bancaire','cheque','especes') THEN
    RAISE EXCEPTION 'Type de moyen de paiement invalide.' USING ERRCODE='22023';
  END IF;
  IF p_titulaire IS NULL OR length(trim(p_titulaire))<2 THEN
    RAISE EXCEPTION 'Le titulaire est obligatoire.' USING ERRCODE='22023';
  END IF;
  IF p_type IN ('orange_money','moov_money','wave','mobile_money')
     AND coalesce(regexp_replace(p_numero_telephone,'\s','','g'),'') !~ '^\+?[0-9]{8,15}$' THEN
    RAISE EXCEPTION 'Numéro mobile invalide.' USING ERRCODE='22023';
  END IF;
  IF p_type IN ('virement_bancaire','cheque')
     AND (coalesce(length(trim(p_banque)),0)<2 OR coalesce(length(trim(p_numero_compte)),0)<4) THEN
    RAISE EXCEPTION 'Banque et numéro de compte sont obligatoires.' USING ERRCODE='22023';
  END IF;

  IF p_est_principal THEN
    UPDATE public.snp_artisan_moyens_paiement
    SET est_principal=false,updated_by=auth.uid(),updated_at=now()
    WHERE artisan_id=p_artisan_id AND est_principal AND actif
      AND (p_moyen_id IS NULL OR id<>p_moyen_id);
  END IF;

  IF p_moyen_id IS NULL THEN
    INSERT INTO public.snp_artisan_moyens_paiement(
      artisan_id,type,libelle,numero_telephone,banque,numero_compte,code_swift,
      titulaire,est_principal,actif,verifie_le,verifie_par,observations,
      created_by,updated_by,created_at,updated_at
    ) VALUES (
      p_artisan_id,p_type,nullif(trim(p_libelle),''),nullif(regexp_replace(p_numero_telephone,'\s','','g'),''),
      nullif(trim(p_banque),''),nullif(trim(p_numero_compte),''),nullif(trim(p_code_swift),''),
      trim(p_titulaire),p_est_principal,p_actif,NULL,NULL,p_observations,
      auth.uid(),auth.uid(),now(),now()
    ) RETURNING * INTO v_after;
  ELSE
    SELECT * INTO v_before FROM public.snp_artisan_moyens_paiement
    WHERE id=p_moyen_id FOR UPDATE;
    IF NOT FOUND OR v_before.artisan_id<>p_artisan_id THEN
      RAISE EXCEPTION 'Moyen de paiement introuvable dans le périmètre.' USING ERRCODE='P0002';
    END IF;
    v_sensitive_changed := ROW(
      v_before.type,v_before.numero_telephone,v_before.banque,
      v_before.numero_compte,v_before.code_swift,v_before.titulaire
    ) IS DISTINCT FROM ROW(
      p_type,nullif(regexp_replace(p_numero_telephone,'\s','','g'),''),
      nullif(trim(p_banque),''),nullif(trim(p_numero_compte),''),
      nullif(trim(p_code_swift),''),trim(p_titulaire)
    );
    UPDATE public.snp_artisan_moyens_paiement
    SET type=p_type,libelle=nullif(trim(p_libelle),''),
        numero_telephone=nullif(regexp_replace(p_numero_telephone,'\s','','g'),''),
        banque=nullif(trim(p_banque),''),numero_compte=nullif(trim(p_numero_compte),''),
        code_swift=nullif(trim(p_code_swift),''),titulaire=trim(p_titulaire),
        est_principal=p_est_principal,actif=p_actif,observations=p_observations,
        verifie_le=CASE WHEN v_sensitive_changed THEN NULL ELSE verifie_le END,
        verifie_par=CASE WHEN v_sensitive_changed THEN NULL ELSE verifie_par END,
        updated_by=auth.uid(),updated_at=now()
    WHERE id=p_moyen_id RETURNING * INTO v_after;
  END IF;

  PERFORM public.snp_record_workflow_event(
    'artisan-payment-method',v_after.id,
    CASE WHEN p_moyen_id IS NULL THEN 'created' ELSE 'updated' END,
    CASE WHEN v_before.verifie_le IS NOT NULL THEN 'verified' ELSE 'unverified' END,
    CASE WHEN v_after.verifie_le IS NOT NULL THEN 'verified' ELSE 'unverified' END,
    'artisan.payment-methods.manage',p_observations,
    jsonb_build_object('before',public.snp_4b_payment_snapshot(v_before),'after',public.snp_4b_payment_snapshot(v_after))
  );
  RETURN v_after;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_verifier_artisan_moyen_paiement(
  p_moyen_id uuid, p_approuve boolean, p_motif text DEFAULT NULL
)
RETURNS public.snp_artisan_moyens_paiement
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE
  v_before public.snp_artisan_moyens_paiement%ROWTYPE;
  v_after public.snp_artisan_moyens_paiement%ROWTYPE;
BEGIN
  SELECT * INTO v_before FROM public.snp_artisan_moyens_paiement
  WHERE id=p_moyen_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Moyen de paiement introuvable.' USING ERRCODE='P0002'; END IF;
  IF NOT public.snp_4b_can_manage_artisan(v_before.artisan_id,'artisan.payment-methods.manage') THEN
    RAISE EXCEPTION 'artisan.payment-methods.manage et périmètre artisan requis.' USING ERRCODE='42501';
  END IF;
  IF auth.uid()=v_before.created_by OR auth.uid()=v_before.updated_by THEN
    RAISE EXCEPTION 'Double contrôle requis : le saisissant ne vérifie pas sa coordonnée.'
      USING ERRCODE='42501';
  END IF;
  IF NOT p_approuve AND (p_motif IS NULL OR length(trim(p_motif))<10) THEN
    RAISE EXCEPTION 'Le rejet exige un motif d''au moins dix caractères.' USING ERRCODE='22023';
  END IF;
  UPDATE public.snp_artisan_moyens_paiement
  SET verifie_le=CASE WHEN p_approuve THEN now() ELSE NULL END,
      verifie_par=CASE WHEN p_approuve THEN auth.uid() ELSE NULL END,
      actif=CASE WHEN p_approuve THEN actif ELSE false END,
      est_principal=CASE WHEN p_approuve THEN est_principal ELSE false END,
      observations=CASE WHEN p_approuve THEN observations ELSE trim(p_motif) END,
      updated_at=now()
  WHERE id=p_moyen_id RETURNING * INTO v_after;
  PERFORM public.snp_record_workflow_event(
    'artisan-payment-method',p_moyen_id,'reviewed',
    CASE WHEN v_before.verifie_le IS NULL THEN 'unverified' ELSE 'verified' END,
    CASE WHEN p_approuve THEN 'verified' ELSE 'rejected' END,
    'artisan.payment-methods.manage',p_motif,
    jsonb_build_object('before',public.snp_4b_payment_snapshot(v_before),'after',public.snp_4b_payment_snapshot(v_after))
  );
  RETURN v_after;
END;
$fn$;

DO $artisan_rpc_only$
DECLARE v_table text; v record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['snp_cartes_professionnelles','snp_artisan_moyens_paiement'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',v_table);
    FOR v IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=v_table LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',v.policyname,v_table);
    END LOOP;
    EXECUTE format('DROP TRIGGER IF EXISTS snp_4b_rpc_only ON public.%I',v_table);
    EXECUTE format(
      'CREATE TRIGGER snp_4b_rpc_only BEFORE INSERT OR UPDATE OR DELETE ON public.%I '
      || 'FOR EACH ROW EXECUTE FUNCTION public.snp_4b_require_trusted_mutation()',v_table
    );
    EXECUTE format('REVOKE ALL PRIVILEGES ON public.%I FROM PUBLIC,anon,authenticated',v_table);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',v_table);
  END LOOP;
END;
$artisan_rpc_only$;

CREATE POLICY snp_4b_cards_select ON public.snp_cartes_professionnelles
FOR SELECT TO authenticated USING (
  public.snp_actor_has_capability('artisan.cards.manage')
  OR public.snp_can_access_artisan(artisan_id)
);
CREATE POLICY snp_4b_payment_methods_select ON public.snp_artisan_moyens_paiement
FOR SELECT TO authenticated USING (
  public.snp_actor_has_capability('artisan.payment-methods.manage')
  OR public.snp_can_access_artisan(artisan_id)
);

REVOKE ALL ON FUNCTION public.snp_renouveler_carte_professionnelle(uuid,date,text),
  public.snp_transition_carte_professionnelle(uuid,text,text,text),
  public.snp_upsert_artisan_moyen_paiement(uuid,text,text,uuid,text,text,text,text,text,boolean,boolean,text),
  public.snp_verifier_artisan_moyen_paiement(uuid,boolean,text)
FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.snp_renouveler_carte_professionnelle(uuid,date,text),
  public.snp_transition_carte_professionnelle(uuid,text,text,text),
  public.snp_upsert_artisan_moyen_paiement(uuid,text,text,uuid,text,text,text,text,text,boolean,boolean,text),
  public.snp_verifier_artisan_moyen_paiement(uuid,boolean,text)
TO authenticated;

-- --------------------------------------------------------------------------
-- 6. Demandes de licences Mine et décision réglementaire SONASP.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.snp_export_license_requests(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mining_company_id uuid NOT NULL REFERENCES public.mining_companies(id) ON DELETE RESTRICT,
  requested_quantity_grams numeric(18,6) NOT NULL CHECK(requested_quantity_grams>0),
  desired_export_date date NOT NULL,
  destination text NOT NULL CHECK(length(trim(destination))>=2),
  reason text NOT NULL CHECK(length(trim(reason))>=10),
  comment text,
  status text NOT NULL DEFAULT 'submitted'
    CHECK(status IN ('submitted','under_review','approved','rejected','cancelled')),
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  decision_reason text,
  license_id uuid REFERENCES public.export_licenses(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snp_export_license_request_decision_shape CHECK(
    (status IN ('submitted','under_review') AND reviewed_at IS NULL AND reviewed_by IS NULL AND license_id IS NULL)
    OR (status='approved' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND license_id IS NOT NULL)
    OR (status IN ('rejected','cancelled') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND license_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_snp_export_license_requests_company_status
  ON public.snp_export_license_requests(mining_company_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snp_export_license_requests_review
  ON public.snp_export_license_requests(status,submitted_at)
  WHERE status IN ('submitted','under_review');
CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_export_license_requests_license
  ON public.snp_export_license_requests(license_id) WHERE license_id IS NOT NULL;

ALTER TABLE public.snp_export_license_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_export_license_requests FORCE ROW LEVEL SECURITY;

DO $license_policies$
DECLARE v_table text; v record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'export_licenses','export_license_documents','snp_export_license_requests'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',v_table);
    FOR v IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=v_table LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',v.policyname,v_table);
    END LOOP;
    EXECUTE format('DROP TRIGGER IF EXISTS snp_4b_rpc_only ON public.%I',v_table);
    EXECUTE format(
      'CREATE TRIGGER snp_4b_rpc_only BEFORE INSERT OR UPDATE OR DELETE ON public.%I '
      || 'FOR EACH ROW EXECUTE FUNCTION public.snp_4b_require_trusted_mutation()',v_table
    );
    EXECUTE format('REVOKE ALL PRIVILEGES ON public.%I FROM PUBLIC,anon,authenticated',v_table);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',v_table);
  END LOOP;
END;
$license_policies$;

CREATE POLICY snp_4b_export_licenses_select ON public.export_licenses
FOR SELECT TO authenticated USING (
  public.snp_est_agent_sonasp()
  OR public.snp_est_direction_lecture()
  OR CASE WHEN public.snp_actor_has_capability('mine.operate') THEN
       mining_company_id=public.snp_societe_compte_mine()
     ELSE false END
);
CREATE POLICY snp_4b_export_license_documents_select ON public.export_license_documents
FOR SELECT TO authenticated USING (
  EXISTS(
    SELECT 1 FROM public.export_licenses l
    WHERE l.id=license_id AND (
      public.snp_est_agent_sonasp()
      OR public.snp_est_direction_lecture()
      OR CASE WHEN public.snp_actor_has_capability('mine.operate') THEN
           l.mining_company_id=public.snp_societe_compte_mine()
         ELSE false END
    )
  )
);
CREATE POLICY snp_4b_export_license_requests_select ON public.snp_export_license_requests
FOR SELECT TO authenticated USING (
  public.snp_est_agent_sonasp()
  OR public.snp_est_direction_lecture()
  OR CASE WHEN public.snp_actor_has_capability('mine.operate') THEN
       mining_company_id=public.snp_societe_compte_mine()
     ELSE false END
);

-- Le helper historique ne doit plus autoriser la Mine à modifier une licence.
CREATE OR REPLACE FUNCTION public.snp_peut_modifier_licence_export(p_license_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  SELECT EXISTS(
    SELECT 1 FROM public.export_licenses l WHERE l.id=p_license_id
  ) AND (
    public.snp_actor_has_capability('sonasp.prepare')
    OR public.snp_actor_has_capability('sonasp.approve')
  );
$fn$;
REVOKE ALL ON FUNCTION public.snp_peut_modifier_licence_export(uuid)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.snp_portail_mine_soumettre_demande_licence_export(
  p_quantite_demandee_grammes numeric,
  p_date_export_souhaitee date,
  p_destination text,
  p_motif text,
  p_commentaire text
)
RETURNS public.snp_export_license_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE
  v_company uuid;
  v_request public.snp_export_license_requests%ROWTYPE;
BEGIN
  PERFORM public.snp_require_capability('mine.operate');
  v_company := public.snp_societe_compte_mine();
  IF p_quantite_demandee_grammes IS NULL OR p_quantite_demandee_grammes<=0 THEN
    RAISE EXCEPTION 'La quantité demandée doit être strictement positive.' USING ERRCODE='22023';
  END IF;
  IF p_date_export_souhaitee IS NULL OR p_date_export_souhaitee<CURRENT_DATE THEN
    RAISE EXCEPTION 'La date d''export souhaitée ne peut être passée.' USING ERRCODE='22023';
  END IF;
  IF p_destination IS NULL OR length(trim(p_destination))<2 OR length(p_destination)>200 THEN
    RAISE EXCEPTION 'Destination invalide.' USING ERRCODE='22023';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif))<10 OR length(p_motif)>2000 THEN
    RAISE EXCEPTION 'Le motif doit contenir entre 10 et 2 000 caractères.' USING ERRCODE='22023';
  END IF;
  IF p_commentaire IS NOT NULL AND length(p_commentaire)>4000 THEN
    RAISE EXCEPTION 'Commentaire trop long.' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.snp_export_license_requests(
    mining_company_id,requested_quantity_grams,desired_export_date,
    destination,reason,comment,status,submitted_by,submitted_at,created_at,updated_at
  ) VALUES (
    v_company,round(p_quantite_demandee_grammes,6),p_date_export_souhaitee,
    trim(p_destination),trim(p_motif),nullif(trim(p_commentaire),''),
    'submitted',auth.uid(),now(),now(),now()
  ) RETURNING * INTO v_request;
  PERFORM public.snp_record_workflow_event(
    'export-license-request',v_request.id,'submitted',NULL,'submitted',
    'mine.operate',p_motif,
    jsonb_build_object('mining_company_id',v_company,'requested_quantity_grams',v_request.requested_quantity_grams)
  );
  RETURN v_request;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sonasp_decider_demande_licence_export(
  p_demande_id uuid, p_decision text,
  p_numero_licence text DEFAULT NULL, p_date_debut date DEFAULT NULL,
  p_date_fin date DEFAULT NULL, p_institution_emettrice text DEFAULT NULL,
  p_quantite_autorisee_grammes numeric DEFAULT NULL,
  p_motif_decision text DEFAULT NULL, p_commentaires text DEFAULT NULL
)
RETURNS public.snp_export_license_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE
  v_request public.snp_export_license_requests%ROWTYPE;
  v_license public.export_licenses%ROWTYPE;
  v_status text;
BEGIN
  PERFORM public.snp_require_capability('sonasp.approve');
  SELECT * INTO v_request FROM public.snp_export_license_requests
  WHERE id=p_demande_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande de licence introuvable.' USING ERRCODE='P0002'; END IF;
  IF p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Décision attendue : approved ou rejected.' USING ERRCODE='22023';
  END IF;
  IF v_request.status=p_decision THEN
    RETURN v_request;
  END IF;
  IF v_request.status NOT IN ('submitted','under_review') THEN
    RAISE EXCEPTION 'Une demande % ne peut plus être décidée.',v_request.status USING ERRCODE='23514';
  END IF;
  IF auth.uid()=v_request.submitted_by THEN
    RAISE EXCEPTION 'Le demandeur ne peut décider sa propre demande.' USING ERRCODE='42501';
  END IF;

  IF p_decision='rejected' THEN
    IF p_motif_decision IS NULL OR length(trim(p_motif_decision))<10 THEN
      RAISE EXCEPTION 'Le rejet exige un motif d''au moins dix caractères.' USING ERRCODE='22023';
    END IF;
    UPDATE public.snp_export_license_requests
    SET status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),
        decision_reason=trim(p_motif_decision),updated_at=now()
    WHERE id=p_demande_id RETURNING * INTO v_request;
  ELSE
    IF p_numero_licence IS NULL OR length(trim(p_numero_licence))<4
       OR p_date_debut IS NULL OR p_date_fin IS NULL OR p_date_fin<p_date_debut
       OR p_institution_emettrice IS NULL OR length(trim(p_institution_emettrice))<3
       OR p_quantite_autorisee_grammes IS NULL OR p_quantite_autorisee_grammes<=0
       OR p_quantite_autorisee_grammes>v_request.requested_quantity_grams THEN
      RAISE EXCEPTION 'Paramètres d''autorisation incomplets ou hors de la demande.' USING ERRCODE='22023';
    END IF;
    v_status := CASE
      WHEN CURRENT_DATE<p_date_debut THEN 'pending'
      WHEN CURRENT_DATE>p_date_fin THEN 'expired'
      ELSE 'active' END;
    INSERT INTO public.export_licenses(
      license_number,mining_company_id,request_date,start_date,end_date,
      issuing_institution,authorized_quantity_grams,used_quantity_grams,
      remaining_quantity_grams,status,comments,notes,created_by,updated_by,
      created_at,updated_at
    ) VALUES (
      trim(p_numero_licence),v_request.mining_company_id,v_request.submitted_at::date,
      p_date_debut,p_date_fin,trim(p_institution_emettrice),
      round(p_quantite_autorisee_grammes,6),0,round(p_quantite_autorisee_grammes,6),
      v_status,p_commentaires,p_motif_decision,auth.uid(),auth.uid(),now(),now()
    ) RETURNING * INTO v_license;
    UPDATE public.snp_export_license_requests
    SET status='approved',reviewed_by=auth.uid(),reviewed_at=now(),
        decision_reason=p_motif_decision,license_id=v_license.id,updated_at=now()
    WHERE id=p_demande_id RETURNING * INTO v_request;
  END IF;
  PERFORM public.snp_record_workflow_event(
    'export-license-request',p_demande_id,'decided',
    'submitted',v_request.status,'sonasp.approve',p_motif_decision,
    jsonb_build_object('mining_company_id',v_request.mining_company_id,'license_id',v_request.license_id)
  );
  RETURN v_request;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_sonasp_modifier_licence_export(
  p_license_id uuid, p_expected_updated_at timestamptz,
  p_authorized_quantity_grams numeric DEFAULT NULL,
  p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL,
  p_status text DEFAULT NULL, p_issuing_institution text DEFAULT NULL,
  p_comments text DEFAULT NULL, p_notes text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS public.export_licenses
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE
  v_before public.export_licenses%ROWTYPE;
  v_after public.export_licenses%ROWTYPE;
  v_authorized numeric;
  v_start date;
  v_end date;
  v_status text;
  v_allowed text[];
BEGIN
  PERFORM public.snp_require_capability('sonasp.approve');
  SELECT * INTO v_before FROM public.export_licenses WHERE id=p_license_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Licence introuvable.' USING ERRCODE='P0002'; END IF;
  IF p_expected_updated_at IS NULL OR v_before.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Conflit optimiste : la licence a changé.' USING ERRCODE='40001';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason))<10 THEN
    RAISE EXCEPTION 'Toute modification réglementaire exige un motif de dix caractères.' USING ERRCODE='22023';
  END IF;
  v_authorized:=coalesce(p_authorized_quantity_grams,v_before.authorized_quantity_grams);
  v_start:=coalesce(p_start_date,v_before.start_date);
  v_end:=coalesce(p_end_date,v_before.end_date);
  v_status:=coalesce(p_status,v_before.status);
  IF v_authorized<v_before.used_quantity_grams OR v_authorized<=0 OR v_end<v_start THEN
    RAISE EXCEPTION 'Autorisation inférieure au consommé ou dates invalides.' USING ERRCODE='23514';
  END IF;
  v_allowed:=CASE v_before.status
    WHEN 'pending' THEN ARRAY['pending','active','suspended','cancelled']
    WHEN 'active' THEN ARRAY['active','suspended','cancelled']
    WHEN 'suspended' THEN ARRAY['suspended','active','cancelled']
    WHEN 'exhausted' THEN ARRAY['exhausted','active']
    WHEN 'expired' THEN ARRAY['expired']
    WHEN 'cancelled' THEN ARRAY['cancelled']
    ELSE ARRAY[]::text[] END;
  IF NOT v_status=ANY(v_allowed) THEN
    RAISE EXCEPTION 'Transition de licence interdite : % vers %.',v_before.status,v_status USING ERRCODE='22023';
  END IF;
  IF v_status='active' AND (CURRENT_DATE<v_start OR CURRENT_DATE>v_end OR v_authorized<=v_before.used_quantity_grams) THEN
    RAISE EXCEPTION 'Une licence active doit être en période et disposer d''un reliquat.' USING ERRCODE='23514';
  END IF;
  UPDATE public.export_licenses
  SET authorized_quantity_grams=v_authorized,start_date=v_start,end_date=v_end,
      status=v_status,issuing_institution=coalesce(nullif(trim(p_issuing_institution),''),issuing_institution),
      comments=coalesce(p_comments,comments),notes=coalesce(p_notes,notes),
      updated_by=auth.uid(),updated_at=clock_timestamp()
  WHERE id=p_license_id RETURNING * INTO v_after;
  PERFORM public.snp_record_workflow_event(
    'export-license',p_license_id,'regulatory-update',v_before.status,v_after.status,
    'sonasp.approve',p_reason,
    jsonb_build_object(
      'mining_company_id',v_before.mining_company_id,
      'authorized_before',v_before.authorized_quantity_grams,
      'authorized_after',v_after.authorized_quantity_grams,
      'used_quantity_grams',v_after.used_quantity_grams
    )
  );
  RETURN v_after;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_portail_mine_soumettre_demande_licence_export(numeric,date,text,text,text),
  public.snp_sonasp_decider_demande_licence_export(uuid,text,text,date,date,text,numeric,text,text),
  public.snp_sonasp_modifier_licence_export(uuid,timestamptz,numeric,date,date,text,text,text,text,text)
FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.snp_portail_mine_soumettre_demande_licence_export(numeric,date,text,text,text),
  public.snp_sonasp_decider_demande_licence_export(uuid,text,text,date,date,text,numeric,text,text),
  public.snp_sonasp_modifier_licence_export(uuid,timestamptz,numeric,date,date,text,text,text,text,text)
TO authenticated;

-- --------------------------------------------------------------------------
-- 7. Postflight structurel.
-- --------------------------------------------------------------------------
DO $postflight$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN (
    'snp_contrats','snp_requisitions','snp_reglements_achat',
    'snp_cartes_professionnelles','snp_artisan_moyens_paiement',
    'export_licenses','snp_export_license_requests'
  ) AND c.relrowsecurity AND c.relforcerowsecurity;
  IF v_count<>7 THEN RAISE EXCEPTION 'Postflight 4B : FORCE RLS incomplet (%/7).',v_count; END IF;

  IF has_table_privilege('authenticated','public.export_licenses','UPDATE')
     OR has_table_privilege('authenticated','public.snp_reglements_achat','UPDATE')
     OR has_table_privilege('authenticated','public.snp_cartes_professionnelles','UPDATE')
     OR has_table_privilege('authenticated','public.snp_artisan_moyens_paiement','UPDATE') THEN
    RAISE EXCEPTION 'Postflight 4B : un DML RPC-only reste accordé à authenticated.';
  END IF;
  IF NOT has_function_privilege(
    'authenticated','public.snp_portail_mine_soumettre_demande_licence_export(numeric,date,text,text,text)','EXECUTE'
  ) OR has_function_privilege(
    'anon','public.snp_portail_mine_soumettre_demande_licence_export(numeric,date,text,text,text)','EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Postflight 4B : ACL de la RPC Mine incorrecte.';
  END IF;
  IF position('FOR UPDATE' IN pg_get_functiondef(
    'public.snp_sonasp_decider_demande_licence_export(uuid,text,text,date,date,text,numeric,text,text)'::regprocedure
  ))=0 THEN
    RAISE EXCEPTION 'Postflight 4B : la décision de licence n''est pas verrouillée.';
  END IF;
END;
$postflight$;

COMMENT ON FUNCTION public.snp_portail_mine_soumettre_demande_licence_export(numeric,date,text,text,text) IS
  'Soumet une demande de licence pour le tenant Mine JWT ; auteur et statut sont dérivés, AAL2 + mine.operate requis.';
COMMENT ON TABLE public.snp_export_license_requests IS
  'Demandes de licences déposées par les Mines ; seule une décision SONASP crée une export_licenses.';
COMMENT ON FUNCTION public.snp_upsert_artisan_moyen_paiement(uuid,text,text,uuid,text,text,text,text,text,boolean,boolean,text) IS
  'Écriture atomique des coordonnées artisan ; acteur serveur, sérialisation par artisan, changement sensible => vérification réinitialisée.';

COMMIT;

-- Rollback non destructif (procédure opératoire, ne pas automatiser) :
--   1. REVOKE EXECUTE sur les RPC `snp_*` créées par ce fichier ;
--   2. rétablir, après revue de risque, les anciens grants columnaires ;
--   3. ne pas supprimer snp_export_license_requests ni snp_workflow_audit ;
--   4. ne jamais réaccorder UPDATE(used_quantity_grams) : la consommation reste
--      exclusivement celle du ledger P0 et de ses RPC de réservation/libération.
