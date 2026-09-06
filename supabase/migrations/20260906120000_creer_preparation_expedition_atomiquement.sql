-- P0-3 : rend la CRÉATION d'une préparation d'expédition atomique.
--
-- Historique : le formulaire créait la préparation puis, dans des requêtes REST
-- séparées, ajoutait les lignes de production, les signataires et réservait le
-- quota de licence. Une coupure entre ces appels laissait une préparation
-- orpheline (invisible dans la liste car filtrée par `shipping_production_items`
-- !inner) mais TENANT un quota de licence réservé — un « fantôme » de quota.
--
-- Cette migration introduit un point d'écriture unique et transactionnel
-- `snp_create_shipping_preparation_atomic`, sur le modèle de
-- `snp_create_freight_shipment_atomic` (lot fret). Le parent, ses lignes et ses
-- signataires sont insérés dans une seule transaction : soit tout est validé,
-- soit rien ne l'est. Le quota reste réservé par le trigger existant
-- `snp_shipping_90_sync_quota` (déjà présent, idempotent) au sein de la même
-- transaction. Les pièces jointes et le PDF de colisage (Storage) demeurent
-- post-commit et restent gérés de façon reprenable par le client.
--
-- La fonction NE DUPLIQUE PAS la validation métier : les triggers et contraintes
-- existants (garde tenant `snp_4a_shipping_item_tenant_guard`, garde
-- d'allocation physique P0-4 `snp_shipping_physical_allocation_guard`, CHECK de
-- poids/pureté, unicité (préparation, production), canonicalisation de la
-- licence, synchronisation du quota) s'appliquent inchangés. Les lignes sont
-- insérées une à une pour reproduire exactement la visibilité inter-lignes des
-- gardes cumulatives, comme le faisait le client.
--
-- Idempotence : clé fournie par le client + table d'opérations + empreinte de la
-- requête, exactement comme le fret. Un rejeu renvoie la préparation créée.
--
-- Migration additive, exécutée dans la transaction fournie par le runner.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- --------------------------------------------------------------------------
-- 0. Préflight : relations, triggers et helpers requis doivent exister.
-- --------------------------------------------------------------------------
DO $preflight$
DECLARE
  v_relation text;
BEGIN
  FOREACH v_relation IN ARRAY ARRAY[
    'public.shipping_preparations',
    'public.shipping_production_items',
    'public.shipping_signatories',
    'public.export_licenses',
    'public.mining_companies',
    'public.expedition_lot_counters'
  ] LOOP
    IF to_regclass(v_relation) IS NULL THEN
      RAISE EXCEPTION 'Préflight préparation atomique : relation % absente.', v_relation;
    END IF;
  END LOOP;

  IF to_regprocedure('public.snp_mfa_satisfaite()') IS NULL
     OR to_regprocedure('public.snp_sec_can_prepare_company(uuid)') IS NULL
     OR to_regprocedure('public.get_next_expedition_lot_number(uuid,integer)') IS NULL
     OR to_regprocedure(
       'public.snp_record_workflow_event(text,uuid,text,text,text,text,text,jsonb)'
     ) IS NULL THEN
    RAISE EXCEPTION
      'Préflight préparation atomique : un helper de sécurité ou d''audit est absent.';
  END IF;

  -- Le trigger de réservation du quota doit être présent : c'est lui qui
  -- garantit l'atomicité prep+quota au sein de la transaction de la fonction.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.shipping_preparations'::regclass
      AND tgname = 'snp_shipping_90_sync_quota'
  ) THEN
    RAISE EXCEPTION
      'Préflight préparation atomique : trigger de synchronisation du quota absent.';
  END IF;
END;
$preflight$;

-- --------------------------------------------------------------------------
-- 1. Table d'opérations idempotentes (modèle : snp_freight_create_operations).
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.snp_shipping_prep_create_operations (
  idempotency_key uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  mining_company_id uuid NOT NULL
    REFERENCES public.mining_companies(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{32}$'),
  shipping_preparation_id uuid
    REFERENCES public.shipping_preparations(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  CONSTRAINT snp_shipping_prep_ops_completion_coherent CHECK (
    (shipping_preparation_id IS NULL AND response IS NULL AND completed_at IS NULL)
    OR (shipping_preparation_id IS NOT NULL AND response IS NOT NULL AND completed_at IS NOT NULL)
  )
);

ALTER TABLE public.snp_shipping_prep_create_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_shipping_prep_create_operations FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.snp_shipping_prep_create_operations
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.snp_shipping_prep_create_operations
  TO service_role;

-- Policy explicite service_role (miroir de snp_freight_create_operations) : la
-- table reste inaccessible aux clients JWT (aucun grant, aucune policy pour eux),
-- seule la fonction SECURITY DEFINER l'écrit. Rend la posture RLS explicite.
DROP POLICY IF EXISTS snp_shipping_prep_create_operations_service
  ON public.snp_shipping_prep_create_operations;
CREATE POLICY snp_shipping_prep_create_operations_service
  ON public.snp_shipping_prep_create_operations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.snp_shipping_prep_create_operations IS
  'Journal d''idempotence de snp_create_shipping_preparation_atomic (clé client + empreinte + réponse).';

-- --------------------------------------------------------------------------
-- 2. Point d'écriture atomique unique.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_create_shipping_preparation_atomic(
  p_idempotency_key uuid,
  p_mining_company_id uuid,
  p_export_license_id uuid,
  p_freight_company_id uuid,
  p_refinery_id uuid,
  p_prepared_at timestamptz,
  p_items jsonb,
  p_signatories jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'storage', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_existing public.snp_shipping_prep_create_operations%ROWTYPE;
  v_prep public.shipping_preparations%ROWTYPE;
  v_fingerprint text;
  v_reference text;
  v_first_seal text;
  v_total_net numeric := 0;
  v_total_gross numeric := 0;
  v_boxes integer := 0;
  v_item_count integer := 0;
  v_signatory_count integer := 0;
  v_item jsonb;
  v_sig jsonb;
  v_seen_productions uuid[] := ARRAY[]::uuid[];
  v_production uuid;
  v_response jsonb;
BEGIN
  -- 2.1 Garde d'entrée (miroir de la policy INSERT : forte auth + périmètre).
  IF v_actor IS NULL OR p_idempotency_key IS NULL
     OR p_mining_company_id IS NULL OR p_export_license_id IS NULL
     OR p_freight_company_id IS NULL OR p_refinery_id IS NULL
     OR p_prepared_at IS NULL
     OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION
      'Clé, société, licence, transport, raffinerie et au moins une ligne sont requis.'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_items) > 200 THEN
    RAISE EXCEPTION 'Une préparation ne peut pas contenir plus de 200 lignes.'
      USING ERRCODE = '22023';
  END IF;
  IF p_signatories IS NULL OR jsonb_typeof(p_signatories) <> 'array'
     OR jsonb_array_length(p_signatories) > 50 THEN
    RAISE EXCEPTION 'Liste de signataires invalide.' USING ERRCODE = '22023';
  END IF;

  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'Authentification forte requise pour préparer une expédition.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT public.snp_sec_can_prepare_company(p_mining_company_id) THEN
    RAISE EXCEPTION 'Préparation interdite dans ce tenant.' USING ERRCODE = '42501';
  END IF;

  -- 2.2 Empreinte canonique de la requête (idempotence).
  v_fingerprint := md5(jsonb_build_object(
    'mining_company_id', p_mining_company_id,
    'export_license_id', p_export_license_id,
    'freight_company_id', p_freight_company_id,
    'refinery_id', p_refinery_id,
    'prepared_at_utc', to_char(p_prepared_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    'items', p_items,
    'signatories', p_signatories
  )::text);

  -- 2.3 Sérialisation stricte de deux appels concurrents de même clé.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('snp-shipping-prep-create:' || p_idempotency_key::text, 0)
  );

  SELECT * INTO v_existing
  FROM public.snp_shipping_prep_create_operations
  WHERE idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.actor_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Cette clé d''idempotence appartient à un autre acteur.'
        USING ERRCODE = '42501';
    END IF;
    IF v_existing.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Cette clé d''idempotence est déjà liée à une autre requête.'
        USING ERRCODE = '23505';
    END IF;
    IF v_existing.response IS NULL OR v_existing.completed_at IS NULL THEN
      RAISE EXCEPTION 'L''opération idempotente est incomplète ; veuillez réessayer.'
        USING ERRCODE = '40001';
    END IF;
    RETURN v_existing.response || jsonb_build_object('replayed', true);
  END IF;

  -- 2.4 Contrôle de structure des lignes + totaux dérivés côté serveur.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF v_item->>'daily_production_id' IS NULL
       OR nullif(btrim(coalesce(v_item->>'ingot_box_number','')), '') IS NULL
       OR nullif(btrim(coalesce(v_item->>'seal_number_1','')), '') IS NULL
       OR (v_item->>'net_weight_grams') IS NULL
       OR (v_item->>'gross_weight_grams') IS NULL
       OR (v_item->>'fineness_pct') IS NULL
       OR (v_item->>'pure_gold_grams') IS NULL THEN
      RAISE EXCEPTION 'Une ligne de production est incomplète.' USING ERRCODE = '22023';
    END IF;
    v_production := (v_item->>'daily_production_id')::uuid;
    IF v_production = ANY(v_seen_productions) THEN
      RAISE EXCEPTION 'Le même lot de production est présent deux fois.'
        USING ERRCODE = '23505';
    END IF;
    v_seen_productions := v_seen_productions || v_production;
    v_total_net := v_total_net + (v_item->>'net_weight_grams')::numeric;
    v_total_gross := v_total_gross + (v_item->>'gross_weight_grams')::numeric;
    v_boxes := v_boxes + 1;
    IF v_first_seal IS NULL THEN
      v_first_seal := btrim(v_item->>'seal_number_1');
    END IF;
  END LOOP;

  -- 2.5 Référence canonique générée dans la transaction (compteur atomique).
  v_reference := public.get_next_expedition_lot_number(
    p_mining_company_id, extract(year FROM (p_prepared_at AT TIME ZONE 'UTC'))::integer
  );

  -- 2.6 Revendication d'idempotence (annulée par le ROLLBACK en cas d'échec).
  INSERT INTO public.snp_shipping_prep_create_operations(
    idempotency_key, actor_id, mining_company_id, request_fingerprint
  ) VALUES (
    p_idempotency_key, v_actor, p_mining_company_id, v_fingerprint
  );

  -- 2.7 Parent. Les triggers valident licence↔société et réservent le quota.
  INSERT INTO public.shipping_preparations(
    mining_company_id, export_license_id, freight_company_id, refinery_id,
    expedition_lot_number, seal_number, prepared_at,
    total_net_weight_grams, total_gross_weight_grams, total_weight_oz,
    total_boxes, status, created_by
  ) VALUES (
    p_mining_company_id, p_export_license_id, p_freight_company_id, p_refinery_id,
    v_reference, v_first_seal, p_prepared_at,
    round(v_total_net, 6), round(v_total_gross, 6),
    round(v_total_net / 31.1034768, 6), v_boxes,
    'waiting_for_customs_approval'::public.shipping_preparation_status, v_actor
  ) RETURNING * INTO v_prep;

  -- 2.8 Lignes insérées une à une : parité exacte avec les gardes cumulatives
  -- (tenant, allocation physique P0-4, CHECK, unicité) et recalcul des totaux.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.shipping_production_items(
      shipping_preparation_id, daily_production_id, ingot_box_number,
      net_weight_grams, gross_weight_grams, fineness_pct, pure_gold_grams,
      seal_number_1, seal_number_2, order_index
    ) VALUES (
      v_prep.id,
      (v_item->>'daily_production_id')::uuid,
      btrim(v_item->>'ingot_box_number'),
      (v_item->>'net_weight_grams')::numeric,
      (v_item->>'gross_weight_grams')::numeric,
      (v_item->>'fineness_pct')::numeric,
      (v_item->>'pure_gold_grams')::numeric,
      btrim(v_item->>'seal_number_1'),
      nullif(btrim(coalesce(v_item->>'seal_number_2','')), ''),
      coalesce((v_item->>'order_index')::integer, v_item_count)
    );
    v_item_count := v_item_count + 1;
  END LOOP;

  -- 2.9 Signataires.
  FOR v_sig IN SELECT * FROM jsonb_array_elements(p_signatories) LOOP
    IF nullif(btrim(coalesce(v_sig->>'position','')), '') IS NULL
       OR nullif(btrim(coalesce(v_sig->>'name','')), '') IS NULL THEN
      RAISE EXCEPTION 'Un signataire est incomplet.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.shipping_signatories(
      shipping_preparation_id, position, name, order_index
    ) VALUES (
      v_prep.id, btrim(v_sig->>'position'), btrim(v_sig->>'name'),
      coalesce((v_sig->>'order_index')::integer, v_signatory_count)
    );
    v_signatory_count := v_signatory_count + 1;
  END LOOP;

  -- 2.10 Relecture : les totaux ont été recalculés par le trigger de lignes.
  SELECT * INTO v_prep FROM public.shipping_preparations WHERE id = v_prep.id;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'La création atomique n''a produit aucune ligne.'
      USING ERRCODE = '23514';
  END IF;

  -- 2.11 Journal d'audit (parité avec le fret).
  PERFORM public.snp_record_workflow_event(
    'shipping_preparation', v_prep.id, 'create-atomic', NULL,
    v_prep.status::text, 'sonasp.prepare', NULL,
    jsonb_build_object(
      'request_id', p_idempotency_key,
      'mining_company_id', p_mining_company_id,
      'export_license_id', p_export_license_id,
      'item_count', v_item_count,
      'signatory_count', v_signatory_count,
      'total_net_weight_grams', v_prep.total_net_weight_grams,
      'total_gross_weight_grams', v_prep.total_gross_weight_grams
    )
  );

  -- 2.12 Réponse = ligne réelle de la préparation + métadonnées d'exécution.
  v_response := to_jsonb(v_prep)
    || jsonb_build_object(
      'item_count', v_item_count,
      'signatory_count', v_signatory_count,
      'idempotency_key', p_idempotency_key,
      'replayed', false
    );

  UPDATE public.snp_shipping_prep_create_operations
  SET shipping_preparation_id = v_prep.id,
      response = v_response,
      completed_at = clock_timestamp()
  WHERE idempotency_key = p_idempotency_key;

  RETURN v_response;
END;
$function$;

-- --------------------------------------------------------------------------
-- 3. Surface d'exposition : deny-by-default puis grant nominatif + registre.
-- --------------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON FUNCTION public.snp_create_shipping_preparation_atomic(
  uuid, uuid, uuid, uuid, uuid, timestamptz, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snp_create_shipping_preparation_atomic(
  uuid, uuid, uuid, uuid, uuid, timestamptz, jsonb, jsonb
) TO authenticated;

INSERT INTO public.snp_rpc_execution_allowlist(
  function_signature, function_name, grantee, purpose, migration_version
) VALUES (
  'snp_create_shipping_preparation_atomic(uuid,uuid,uuid,uuid,uuid,timestamp with time zone,jsonb,jsonb)',
  'snp_create_shipping_preparation_atomic',
  'authenticated',
  'runtime-browser',
  '20260906120000'
)
ON CONFLICT (function_signature, grantee) DO UPDATE
SET function_name = EXCLUDED.function_name,
    purpose = EXCLUDED.purpose,
    migration_version = EXCLUDED.migration_version;

-- --------------------------------------------------------------------------
-- 4. Postflight bloquant.
-- --------------------------------------------------------------------------
DO $postflight$
DECLARE
  v_signature text := 'snp_create_shipping_preparation_atomic(uuid,uuid,uuid,uuid,uuid,timestamp with time zone,jsonb,jsonb)';
  v_oid regprocedure := ('public.' || v_signature)::regprocedure;
BEGIN
  IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Postflight : authenticated ne peut pas exécuter la RPC atomique.';
  END IF;
  IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Postflight : anon ne doit pas exécuter la RPC atomique.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.snp_rpc_execution_allowlist
    WHERE function_signature = v_signature AND grantee = 'authenticated'
  ) THEN
    RAISE EXCEPTION 'Postflight : entrée d''allowlist manquante pour la RPC atomique.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = v_oid
      AND p.prosecdef
      AND EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) s
        WHERE s LIKE 'search_path=pg_catalog, public, auth, storage, extensions, pg_temp%'
      )
  ) THEN
    RAISE EXCEPTION 'Postflight : la RPC atomique n''a pas le search_path canonique.';
  END IF;
END;
$postflight$;
