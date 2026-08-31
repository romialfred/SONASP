-- Retour arrière contrôlé de la séparation des fonctions workflow.
-- À appliquer avant le rollback 20260827230000, après sauvegarde.
BEGIN;

DROP TRIGGER IF EXISTS snp_approval_request_decision_guard ON public.approval_requests;
DROP FUNCTION IF EXISTS public.snp_guard_approval_request_decision();

DROP TRIGGER IF EXISTS snp_refining_approval_guard ON public.refining_records;
DROP FUNCTION IF EXISTS public.snp_guard_refining_approval();

DROP TRIGGER IF EXISTS snp_achat_mine_transition_guard ON public.snp_achats_mines;
DROP FUNCTION IF EXISTS public.snp_guard_achat_mine_transition();

DROP TRIGGER IF EXISTS snp_interdire_derogation_conciliation_trg ON public.snp_conciliations;
DROP FUNCTION IF EXISTS public.snp_interdire_derogation_conciliation();
ALTER TABLE public.snp_conciliations
  DROP CONSTRAINT IF EXISTS snp_conciliations_separation_check;

DO $restore_submit$
DECLARE v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.snp_soumettre_plan(uuid)'::regprocedure)
  INTO v_definition;
  IF position('public.snp_actor_has_capability(''sonasp.prepare'')' IN v_definition)>0 THEN
    v_definition:=replace(
      v_definition,
      'public.snp_actor_has_capability(''sonasp.prepare'')',
      'snp_peut_valider()'
    );
    EXECUTE v_definition;
  END IF;
END;
$restore_submit$;

-- Le registre est conservé comme preuve d’audit ; sa suppression éventuelle
-- relève d’une politique de rétention séparée.
COMMIT;
