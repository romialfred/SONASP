-- ============================================================================
-- LOT 5E — transition réglementaire atomique des productions minières
-- ============================================================================
-- La validation `prepared -> ready_for_customs` était réalisable par UPDATE
-- PostgREST, puis les notes d'historique étaient modifiées dans une seconde
-- requête. Cette migration rend le statut et l'audit RPC-only et apporte :
-- tenant dérivé, AAL2/capability, séparation créateur-validateur, verrou
-- optimiste et idempotence par identifiant de requête.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '0';

DO $preflight$
DECLARE
  v_object text;
BEGIN
  FOREACH v_object IN ARRAY ARRAY[
    'public.daily_production',
    'public.unified_status_history',
    'public.user_profiles',
    'public.snp_workflow_audit'
  ] LOOP
    IF to_regclass(v_object) IS NULL THEN
      RAISE EXCEPTION 'Préflight 5E : objet requis absent : %.', v_object;
    END IF;
  END LOOP;

  IF to_regprocedure('public.snp_actor_has_capability(text)') IS NULL
     OR to_regprocedure('public.snp_societe_compte_mine()') IS NULL
     OR to_regprocedure('public.snp_record_workflow_event(text,uuid,text,text,text,text,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Préflight 5E : socle capability, tenant Mine ou audit absent.';
  END IF;
END;
$preflight$;

-- Une même clé ne peut produire qu'un événement réglementaire. L'index est
-- partiel pour ne pas modifier les événements historiques des autres agrégats.
CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_production_transition_request
  ON public.snp_workflow_audit ((context ->> 'request_id'))
  WHERE aggregate_type = 'daily_production'
    AND action = 'status-transition'
    AND context ? 'request_id';

CREATE OR REPLACE FUNCTION public.snp_5e_require_trusted_production_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $fn$
DECLARE
  v_entity_type text;
BEGIN
  IF TG_TABLE_NAME = 'unified_status_history' THEN
    v_entity_type := CASE
      WHEN TG_OP = 'DELETE' THEN OLD.entity_type
      ELSE NEW.entity_type
    END;
    IF v_entity_type IS DISTINCT FROM 'production' THEN
      RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;
  END IF;

  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Mutation directe interdite : utilisez la RPC de transition de production.'
      USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_5e_require_trusted_production_transition()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS snp_5e_daily_production_status_rpc_only
  ON public.daily_production;
CREATE TRIGGER snp_5e_daily_production_status_rpc_only
BEFORE UPDATE OF status ON public.daily_production
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.snp_5e_require_trusted_production_transition();

-- Les lignes d'historique sont produites par les triggers/RPC. Un client ne
-- peut ni fabriquer une approbation ni réécrire les notes ou l'acteur.
DROP TRIGGER IF EXISTS snp_5e_production_history_rpc_only
  ON public.unified_status_history;
CREATE TRIGGER snp_5e_production_history_rpc_only
BEFORE INSERT OR UPDATE OR DELETE ON public.unified_status_history
FOR EACH ROW
EXECUTE FUNCTION public.snp_5e_require_trusted_production_transition();

CREATE OR REPLACE FUNCTION public.snp_transition_daily_production(
  p_production_id uuid,
  p_expected_status text,
  p_new_status text,
  p_request_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_company uuid;
  v_capability text;
  v_production public.daily_production%ROWTYPE;
  v_existing public.snp_workflow_audit%ROWTYPE;
  v_audit_id bigint;
  v_history_updated integer;
  v_result jsonb;
BEGIN
  IF v_actor IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'Authentification et identifiant de requête obligatoires.'
      USING ERRCODE = '42501';
  END IF;

  -- L'autorisation courante précède aussi les rejeux idempotents : une clé
  -- ancienne ne doit jamais contourner une révocation de capability ou l'AAL2.
  SELECT p.mining_company_id INTO v_actor_company
  FROM public.user_profiles p
  WHERE p.id = v_actor AND p.is_active;

  IF v_actor_company IS NOT NULL
     AND public.snp_actor_has_capability('mine.operate') THEN
    v_actor_company := public.snp_societe_compte_mine();
    v_capability := 'mine.operate';
  ELSIF public.snp_actor_has_capability('sonasp.approve') THEN
    v_actor_company := NULL;
    v_capability := 'sonasp.approve';
  ELSE
    RAISE EXCEPTION 'Capability mine.operate ou sonasp.approve avec AAL2 requise.'
      USING ERRCODE = '42501';
  END IF;

  -- Sérialise les rejeux concurrents d'une même intention avant toute lecture.
  PERFORM pg_advisory_xact_lock(hashtext(p_request_id::text));

  SELECT * INTO v_existing
  FROM public.snp_workflow_audit a
  WHERE a.aggregate_type = 'daily_production'
    AND a.action = 'status-transition'
    AND a.context ->> 'request_id' = p_request_id::text
  ORDER BY a.id DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.actor_id IS DISTINCT FROM v_actor
       OR v_existing.aggregate_id IS DISTINCT FROM p_production_id
       OR v_existing.status_before IS DISTINCT FROM p_expected_status
       OR v_existing.status_after IS DISTINCT FROM p_new_status
       OR (
         v_actor_company IS NOT NULL
         AND v_existing.context ->> 'mining_company_id'
             IS DISTINCT FROM v_actor_company::text
       ) THEN
      RAISE EXCEPTION 'La clé d’idempotence est déjà liée à une autre transition.'
        USING ERRCODE = '22023';
    END IF;
    RETURN COALESCE(v_existing.context -> 'result', '{}'::jsonb)
      || jsonb_build_object(
        'audit_id', v_existing.id,
        'idempotent_replay', true
      );
  END IF;

  IF p_expected_status IS NULL OR p_new_status IS NULL THEN
    RAISE EXCEPTION 'Les statuts attendu et cible sont obligatoires.'
      USING ERRCODE = '22023';
  END IF;
  IF p_new_status <> 'ready_for_customs' THEN
    RAISE EXCEPTION 'Seule la validation vers ready_for_customs est autorisée par cette RPC.'
      USING ERRCODE = '22023';
  END IF;
  IF p_notes IS NOT NULL AND length(trim(p_notes)) > 2000 THEN
    RAISE EXCEPTION 'Les notes de validation dépassent 2000 caractères.'
      USING ERRCODE = '22023';
  END IF;

  SELECT dp.* INTO v_production
  FROM public.daily_production dp
  WHERE dp.id = p_production_id
    AND (v_actor_company IS NULL OR dp.mining_company_id = v_actor_company)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production introuvable dans votre périmètre.'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_production.created_by IS NULL
     OR v_production.created_by = v_actor THEN
    RAISE EXCEPTION 'Le validateur doit être distinct du créateur identifié de la production.'
      USING ERRCODE = '42501';
  END IF;
  IF v_production.status::text IS DISTINCT FROM p_expected_status THEN
    RAISE EXCEPTION 'Conflit optimiste : la production est désormais au statut %.',
      v_production.status::text
      USING ERRCODE = '40001';
  END IF;
  IF p_expected_status <> 'prepared' THEN
    RAISE EXCEPTION 'Transition invalide : % vers %.', p_expected_status, p_new_status
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.daily_production
  SET status = 'ready_for_customs'::public.production_status_v2,
      updated_at = now()
  WHERE id = p_production_id;

  -- Le trigger historique existant crée la ligne ; la RPC, exécutée avec les
  -- droits du propriétaire, enrichit atomiquement la dernière transition.
  UPDATE public.unified_status_history h
  SET notes = NULLIF(trim(p_notes), ''),
      metadata = COALESCE(h.metadata, '{}'::jsonb) || jsonb_build_object(
        'request_id', p_request_id,
        'capability', v_capability
      )
  WHERE h.id = (
    SELECT candidate.id
    FROM public.unified_status_history candidate
    WHERE candidate.entity_type = 'production'
      AND candidate.entity_id = p_production_id
      AND candidate.old_status = p_expected_status
      AND candidate.new_status = p_new_status
      AND candidate.changed_by = v_actor
    ORDER BY candidate.changed_at DESC, candidate.id DESC
    LIMIT 1
  );
  GET DIAGNOSTICS v_history_updated = ROW_COUNT;
  IF v_history_updated <> 1 THEN
    RAISE EXCEPTION 'La transition a été annulée car son historique réglementaire n’a pas été créé.'
      USING ERRCODE = 'P0001';
  END IF;

  v_result := jsonb_build_object(
    'production_id', p_production_id,
    'previous_status', p_expected_status,
    'status', p_new_status,
    'request_id', p_request_id,
    'idempotent_replay', false
  );

  v_audit_id := public.snp_record_workflow_event(
    'daily_production', p_production_id, 'status-transition',
    p_expected_status, p_new_status, v_capability,
    NULLIF(trim(p_notes), ''),
    jsonb_build_object(
      'request_id', p_request_id,
      'mining_company_id', v_production.mining_company_id,
      'result', v_result
    )
  );

  RETURN v_result || jsonb_build_object('audit_id', v_audit_id);
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_transition_daily_production(uuid,text,text,uuid,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.snp_transition_daily_production(uuid,text,text,uuid,text)
  TO authenticated;

COMMENT ON FUNCTION public.snp_transition_daily_production(uuid,text,text,uuid,text) IS
  'Valide atomiquement une production : tenant dérivé, AAL2/capability, SoD, verrou optimiste, idempotence et audit serveur.';

COMMIT;
