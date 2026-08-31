-- Convergence additive du socle partiellement publié.
-- Ne rejoue pas les catalogues ni les migrations de comptes historiques.
-- Les définitions IAM Owner/Admin les plus récentes sont conservées.
-- Prérequis : 20260830120000 fournit le prédicat de conciliation courant.
BEGIN;
CREATE OR REPLACE FUNCTION public.snp_actor_can_access_organization(p_organization_id uuid)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  SELECT p_organization_id IS NOT NULL
    AND public.snp_session_est_active()
    AND EXISTS(SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.is_active)
    AND (
      EXISTS(
        SELECT 1 FROM public.snp_user_organization_memberships m
        WHERE m.user_id=auth.uid() AND m.organization_id=p_organization_id
          AND m.valid_from<=clock_timestamp()
          AND (m.valid_until IS NULL OR m.valid_until>clock_timestamp())
      )
      OR public.snp_actor_has_capability('accounts.manage')
    );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_authorize_scoped_action(
  p_capability_code text,p_organization_id uuid
) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  SELECT public.snp_actor_has_capability(p_capability_code)
    AND public.snp_actor_can_access_organization(p_organization_id);
$fn$;


REVOKE ALL ON FUNCTION public.snp_actor_can_access_organization(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.snp_authorize_scoped_action(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_actor_can_access_organization(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_authorize_scoped_action(text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.snp_solde_commercial(
  p_contrepartie_type text,
  p_contrepartie_id uuid
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $fn$
  SELECT coalesce(sum(
    CASE WHEN sens = 'credit' THEN montant ELSE -montant END
  ), 0)
  FROM public.snp_grand_livre_commercial
  WHERE contrepartie_type = p_contrepartie_type
    AND contrepartie_id = p_contrepartie_id
    AND public.snp_can_read_reconciliation_scope(mining_company_id);
$fn$;

CREATE OR REPLACE FUNCTION public.snp_solde_fiscal(
  p_mining_company_id uuid,
  p_code_taxe text
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $fn$
  SELECT coalesce(sum(
    CASE WHEN sens = 'credit' THEN montant ELSE -montant END
  ), 0)
  FROM public.snp_grand_livre_fiscal
  WHERE mining_company_id = p_mining_company_id
    AND code_taxe = p_code_taxe
    AND public.snp_can_read_reconciliation_scope(mining_company_id);
$fn$;

REVOKE ALL ON FUNCTION public.snp_solde_commercial(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.snp_solde_fiscal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snp_solde_commercial(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_solde_fiscal(uuid, text) TO authenticated;


-- =============================================================================
-- Séparation des fonctions : fermetures des chemins historiques contournant
-- les responsabilités du nouveau modèle d'accès.
-- =============================================================================


-- Toute décision générique doit venir d'un approbateur autorisé, affecté et
-- distinct du demandeur. Le trigger s'exécute aussi sous SECURITY DEFINER ; une
-- exception annule donc les mutations de la ressource faites plus tôt par le RPC.
CREATE OR REPLACE FUNCTION public.snp_guard_approval_request_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected') THEN
    PERFORM public.snp_require_capability('sonasp.approve');
    IF OLD.requested_by=auth.uid() THEN
      RAISE EXCEPTION 'Le demandeur ne peut pas décider sa propre demande.' USING ERRCODE='42501';
    END IF;
    IF OLD.assigned_to IS NOT NULL AND OLD.assigned_to<>auth.uid() THEN
      RAISE EXCEPTION 'La demande est affectée à un autre approbateur.' USING ERRCODE='42501';
    END IF;
    IF NEW.approved_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'L’identité de décision doit être celle de la session.' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS snp_approval_request_decision_guard ON public.approval_requests;
CREATE TRIGGER snp_approval_request_decision_guard
BEFORE UPDATE OF status,approved_by ON public.approval_requests
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_approval_request_decision();

-- Le service historique de raffinage envoyait approved_by depuis le navigateur.
CREATE OR REPLACE FUNCTION public.snp_guard_refining_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
  IF NEW.approved_at IS DISTINCT FROM OLD.approved_at OR NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
    PERFORM public.snp_require_capability('sonasp.approve');
    IF NEW.approved_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Identité d’approbation raffinage forgée.' USING ERRCODE='42501';
    END IF;
    IF NOT EXISTS(
      SELECT 1 FROM public.approval_requests ar
      WHERE ar.entity_id=NEW.id AND ar.request_type='refining_process'
        AND ar.status IN ('pending','escalated')
        AND ar.requested_by IS DISTINCT FROM auth.uid()
        AND (ar.assigned_to IS NULL OR ar.assigned_to=auth.uid())
    ) THEN RAISE EXCEPTION 'Demande de raffinage autorisée introuvable.' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS snp_refining_approval_guard ON public.refining_records;
CREATE TRIGGER snp_refining_approval_guard
BEFORE UPDATE OF approved_at,approved_by ON public.refining_records
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_refining_approval();

-- Cycle d'achat aux mines : l'auteur prépare, un autre acteur approuve, la
-- finance exécute. Les montants deviennent immuables dès la validation.
CREATE OR REPLACE FUNCTION public.snp_guard_achat_mine_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
  IF OLD.statut<>'en_attente' AND (
    NEW.mining_company_id IS DISTINCT FROM OLD.mining_company_id OR
    NEW.quantite_oz IS DISTINCT FROM OLD.quantite_oz OR
    NEW.prix_once_fcfa IS DISTINCT FROM OLD.prix_once_fcfa OR
    NEW.montant_total_fcfa IS DISTINCT FROM OLD.montant_total_fcfa
  ) THEN RAISE EXCEPTION 'Les données financières validées sont immuables.' USING ERRCODE='42501'; END IF;

  IF NEW.statut IS DISTINCT FROM OLD.statut THEN
    IF OLD.statut='en_attente' AND NEW.statut='validee' THEN
      PERFORM public.snp_require_capability('sonasp.approve');
      IF OLD.created_by=auth.uid() THEN RAISE EXCEPTION 'Auto-approbation de l’achat interdite.' USING ERRCODE='42501'; END IF;
    ELSIF OLD.statut='validee' AND NEW.statut='payee' THEN
      PERFORM public.snp_require_capability('sonasp.finance.execute');
      IF OLD.created_by=auth.uid() THEN RAISE EXCEPTION 'Le préparateur ne peut pas exécuter son achat.' USING ERRCODE='42501'; END IF;
    ELSIF NEW.statut='annulee' THEN
      PERFORM public.snp_require_capability('sonasp.approve');
    ELSE
      RAISE EXCEPTION 'Transition d’achat minier interdite : % -> %.',OLD.statut,NEW.statut USING ERRCODE='22023';
    END IF;
  ELSIF OLD.statut='en_attente' THEN
    PERFORM public.snp_require_capability('sonasp.prepare');
    IF OLD.created_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Seul le préparateur peut corriger son brouillon.' USING ERRCODE='42501';
    END IF;
  END IF;
  NEW.updated_by:=auth.uid();
  NEW.updated_at:=now();
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS snp_achat_mine_transition_guard ON public.snp_achats_mines;
CREATE TRIGGER snp_achat_mine_transition_guard
BEFORE UPDATE ON public.snp_achats_mines
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_achat_mine_transition();

-- Corrige l'inversion historique « soumettre = approuver » sans recopier la
-- fonction métier : la définition versionnée est transformée et contrôlée.
DO $patch_submit$
DECLARE v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.snp_soumettre_plan(uuid)'::regprocedure) INTO v_definition;
  IF position('snp_actor_has_capability(''sonasp.prepare'')' IN v_definition)>0 THEN RETURN; END IF;
  IF position('IF NOT snp_peut_valider()' IN v_definition)=0 THEN
    RAISE EXCEPTION 'Préflight : garde historique de snp_soumettre_plan introuvable.';
  END IF;
  v_definition:=replace(v_definition,
    'IF NOT snp_peut_valider()',
    'IF NOT public.snp_actor_has_capability(''sonasp.prepare'')');
  EXECUTE v_definition;
END;
$patch_submit$;

-- La dérogation Owner « sans second regard » est fermée. Les anciennes lignes
-- restent lisibles pour audit grâce à NOT VALID, mais aucune nouvelle écriture
-- ne peut reproduire cette exception.
CREATE TABLE IF NOT EXISTS public.snp_sod_legacy_review(
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  issue text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  PRIMARY KEY(aggregate_type,aggregate_id,issue)
);
ALTER TABLE public.snp_sod_legacy_review ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS snp_sod_legacy_review_read ON public.snp_sod_legacy_review;
CREATE POLICY snp_sod_legacy_review_read ON public.snp_sod_legacy_review
FOR SELECT TO authenticated
USING (
  public.snp_actor_has_capability('accounts.manage')
  OR public.snp_actor_has_capability('reports.read')
);
INSERT INTO public.snp_sod_legacy_review(aggregate_type,aggregate_id,issue)
SELECT 'conciliation',id,'validation_sans_second_regard historique'
FROM public.snp_conciliations WHERE validation_sans_second_regard
ON CONFLICT DO NOTHING;
ALTER TABLE public.snp_conciliations DROP CONSTRAINT IF EXISTS snp_conciliations_separation_check;
ALTER TABLE public.snp_conciliations ADD CONSTRAINT snp_conciliations_separation_check
CHECK(valide_par IS NULL OR soumis_par IS NULL OR valide_par<>soumis_par) NOT VALID;
CREATE OR REPLACE FUNCTION public.snp_interdire_derogation_conciliation()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.validation_sans_second_regard THEN
    RAISE EXCEPTION 'La validation sans second regard est interdite.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS snp_interdire_derogation_conciliation_trg ON public.snp_conciliations;
CREATE TRIGGER snp_interdire_derogation_conciliation_trg
BEFORE INSERT OR UPDATE OF validation_sans_second_regard ON public.snp_conciliations
FOR EACH ROW EXECUTE FUNCTION public.snp_interdire_derogation_conciliation();


-- Ces fonctions ne sont appelées que par les triggers, jamais par l'API.
-- La clé d'idempotence export référence son acteur : cette dépendance doit
-- être recensée pour préserver le contrôle fail-closed des suppressions.
INSERT INTO public.snp_account_deletion_dependency_registry(
 schema_name,table_name,column_name,classification,constraint_name,
 referenced_schema_name,referenced_table_name,referenced_column_name,delete_action,source
)
SELECT i.schema_name,i.table_name,i.column_name,i.classification,i.constraint_name,
 i.referenced_schema_name,i.referenced_table_name,i.referenced_column_name,i.delete_action,i.source
FROM public.snp_2m_current_dependency_inventory() i
WHERE i.schema_name='public' AND i.table_name='snp_export_sale_idempotency' AND i.column_name='actor_id'
ON CONFLICT(schema_name,table_name,column_name) DO UPDATE SET
 classification=excluded.classification,constraint_name=excluded.constraint_name,
 referenced_schema_name=excluded.referenced_schema_name,
 referenced_table_name=excluded.referenced_table_name,
 referenced_column_name=excluded.referenced_column_name,
 delete_action=excluded.delete_action,source=excluded.source;
SELECT public.snp_2m_assert_dependency_registry_complete();

REVOKE ALL ON FUNCTION public.snp_guard_approval_request_decision() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.snp_guard_refining_approval() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.snp_guard_achat_mine_transition() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.snp_interdire_derogation_conciliation() FROM PUBLIC,anon,authenticated;

COMMIT;
