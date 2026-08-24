BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION pg_temp.set_test_claims(
  p_sub uuid,
  p_role text,
  p_aal text
)
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_sub::text, true);
  PERFORM set_config('request.jwt.claim.role', p_role, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_sub, 'role', p_role, 'aal', p_aal)::text,
    true
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_reserve(
  p_license uuid,
  p_shipping uuid,
  p_quantity numeric,
  p_actor uuid
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_result boolean;
BEGIN
  v_result := public.reserve_license_quota(
    p_license, p_shipping, p_quantity, p_actor
  );
  RETURN 'OK:' || lower(v_result::text);
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_release(
  p_shipping uuid,
  p_reason text
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_result boolean;
BEGIN
  v_result := public.snp_release_shipping_license_quota(p_shipping, p_reason);
  RETURN 'OK:' || lower(v_result::text);
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_cross_tenant_shipping()
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO public.shipping_preparations (
    id, expedition_lot_number, mining_company_id, export_license_id,
    status, total_net_weight_grams, total_weight_oz
  ) VALUES (
    '62000000-0000-4000-8000-000000000299', 'P0-CROSS-TENANT',
    '62000000-0000-4000-8000-000000000102',
    '62000000-0000-4000-8000-000000000201',
    'waiting_for_customs_approval', 10, 0.321507466
  );
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_over_quota_shipping()
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO public.shipping_preparations (
    id, expedition_lot_number, mining_company_id, export_license_id,
    status, total_net_weight_grams, total_weight_oz
  ) VALUES (
    '62000000-0000-4000-8000-000000000298', 'P0-OVER-QUOTA',
    '62000000-0000-4000-8000-000000000101',
    '62000000-0000-4000-8000-000000000201',
    'waiting_for_customs_approval', 933.104304, 30
  );
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_delete_shipping(p_shipping uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_rows integer;
BEGIN
  DELETE FROM public.shipping_preparations WHERE id = p_shipping;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN 'OK:' || v_rows;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

SELECT plan(34);

-- Contrat structurel ---------------------------------------------------------
SELECT has_table(
  'public', 'snp_export_license_reservations',
  'le quota dispose d’un registre idempotent par expédition'
);
SELECT has_column(
  'public', 'export_licenses', 'quota_baseline_used_grams',
  'les usages historiques sont conservés dans une baseline'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.shipping_preparations'::regclass
      AND conname = 'shipping_license_columns_consistent'
      AND contype = 'c'
  ),
  'les deux colonnes licence ne peuvent plus diverger'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.shipping_preparations'::regclass
      AND conname = 'shipping_export_license_company_fkey'
      AND contype = 'f'
  ),
  'la licence et l’expédition partagent structurellement la société'
);
SELECT is(
  (SELECT count(*) FROM pg_trigger
   WHERE tgrelid = 'public.shipping_preparations'::regclass
     AND NOT tgisinternal
     AND tgname IN (
       'snp_shipping_00_canonicalize_quota',
       'snp_shipping_90_sync_quota',
       'snp_shipping_05_release_quota'
     )),
  3::bigint,
  'exactement trois triggers quota canoniques sont installés'
);
SELECT is(
  (SELECT count(*) FROM pg_trigger
   WHERE tgrelid = 'public.shipping_preparations'::regclass
     AND NOT tgisinternal
     AND tgname IN (
       'trg_release_shipping_quota', 'trigger_release_shipping_quota',
       'trg_reserve_shipping_quota',
       'trg_update_license_quantity_on_insert',
       'trg_update_license_quantity_on_update',
       'trg_update_license_quantity_on_delete'
     )),
  0::bigint,
  'aucun trigger quota legacy ne subsiste'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.reserve_license_quota(uuid,uuid,numeric,uuid)', 'EXECUTE'
  ),
  'la réservation compatible reste exposée après contrôle interne'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.release_license_quota(uuid,numeric,uuid)', 'EXECUTE'
  ),
  'la libération legacy sans shipping_id est retirée'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.snp_release_shipping_license_quota(uuid,text)', 'EXECUTE'
  ),
  'la libération canonique par shipping_id est exposée'
);
SELECT ok(
  NOT has_function_privilege(
    'anon', 'public.reserve_license_quota(uuid,uuid,numeric,uuid)', 'EXECUTE'
  ),
  'anon ne réserve aucun quota'
);
SELECT is(
  public.snp_troy_ounces_to_grams(10),
  311.034768::numeric,
  'la conversion utilise explicitement l’once troy'
);

-- Fixtures ------------------------------------------------------------------
SELECT pg_temp.set_test_claims(
  '62000000-0000-4000-8000-000000000099', 'service_role', 'aal2'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('62000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'quota-workflow@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('62000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'quota-mine@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('62000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'quota-mine-b@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('62000000-0000-4000-8000-000000000099', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'quota-service@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.mining_companies (
  id, code, name, country, company_type, is_active
) VALUES
  ('62000000-0000-4000-8000-000000000101', 'QUOTA-A', 'Quota Mine A', 'Burkina Faso', 'production_mine', true),
  ('62000000-0000-4000-8000-000000000102', 'QUOTA-B', 'Quota Mine B', 'Burkina Faso', 'production_mine', true);

INSERT INTO public.user_profiles (
  id, email, full_name, role, is_active, mining_company_id,
  mfa_enrolled_at, must_change_password
) VALUES
  ('62000000-0000-4000-8000-000000000001', 'quota-workflow@sonasp.invalid', 'Workflow Quota', 'management', true, NULL, now(), false),
  ('62000000-0000-4000-8000-000000000002', 'quota-mine@sonasp.invalid', 'Mine Quota', 'mine', true, '62000000-0000-4000-8000-000000000101', now(), false),
  ('62000000-0000-4000-8000-000000000003', 'quota-mine-b@sonasp.invalid', 'Mine Quota B', 'mine', true, '62000000-0000-4000-8000-000000000102', now(), false),
  ('62000000-0000-4000-8000-000000000099', 'quota-service@sonasp.invalid', 'Service Quota', 'admin', true, NULL, now(), false);

INSERT INTO public.export_licenses (
  id, license_number, mining_company_id, request_date, start_date, end_date,
  issuing_institution, authorized_quantity_grams, used_quantity_grams,
  remaining_quantity_grams, status
) VALUES (
  '62000000-0000-4000-8000-000000000201', 'P0-QUOTA-1000',
  '62000000-0000-4000-8000-000000000101', current_date,
  current_date, current_date + 30, 'Institution test', 1000, 0, 1000, 'active'
);

-- total_net_weight_grams=0 force le repli explicite oz troy -> grammes.
INSERT INTO public.shipping_preparations (
  id, expedition_lot_number, mining_company_id, export_license_id,
  status, total_net_weight_grams, total_weight_oz
) VALUES (
  '62000000-0000-4000-8000-000000000301', 'P0-QUOTA-SHIP',
  '62000000-0000-4000-8000-000000000101',
  '62000000-0000-4000-8000-000000000201',
  'waiting_for_customs_approval', 0, 10
);

SELECT is(
  (SELECT license_id FROM public.shipping_preparations
   WHERE id = '62000000-0000-4000-8000-000000000301'),
  '62000000-0000-4000-8000-000000000201'::uuid,
  'license_id legacy est synchronisée avec export_license_id'
);
SELECT is(
  (SELECT total_net_weight_grams FROM public.shipping_preparations
   WHERE id = '62000000-0000-4000-8000-000000000301'),
  311.034768::numeric,
  'le poids canonique est écrit en grammes'
);
SELECT is(
  (SELECT count(*) FROM public.snp_export_license_reservations
   WHERE shipping_reference = '62000000-0000-4000-8000-000000000301'
     AND status = 'reserved'),
  1::bigint,
  'l’insertion crée une unique réservation active'
);
SELECT is(
  (SELECT used_quantity_grams FROM public.export_licenses
   WHERE id = '62000000-0000-4000-8000-000000000201'),
  311.034768::numeric,
  'le quota utilisé correspond au poids canonique'
);

-- Idempotence et acteur dérivé ----------------------------------------------
SELECT pg_temp.set_test_claims(
  '62000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(
  pg_temp.try_reserve(
    '62000000-0000-4000-8000-000000000201',
    '62000000-0000-4000-8000-000000000301',
    311.034768, '62000000-0000-4000-8000-000000000001'
  ),
  'OK:true', 'un premier rappel compatible réussit'
);
SELECT is(
  pg_temp.try_reserve(
    '62000000-0000-4000-8000-000000000201',
    '62000000-0000-4000-8000-000000000301',
    311.034768, '62000000-0000-4000-8000-000000000001'
  ),
  'OK:true', 'un second rappel est idempotent'
);
RESET ROLE;

SELECT is(
  (SELECT used_quantity_grams FROM public.export_licenses
   WHERE id = '62000000-0000-4000-8000-000000000201'),
  311.034768::numeric,
  'deux rappels ne doublent pas le quota'
);
SELECT is(
  (SELECT count(*) FROM public.snp_export_license_reservations
   WHERE shipping_reference = '62000000-0000-4000-8000-000000000301'),
  1::bigint,
  'deux rappels ne créent pas deux réservations'
);

SELECT pg_temp.set_test_claims(
  '62000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(
  pg_temp.try_reserve(
    '62000000-0000-4000-8000-000000000201',
    '62000000-0000-4000-8000-000000000301',
    311.034768, '62000000-0000-4000-8000-000000000002'
  ),
  'ERR:42501', 'un acteur fourni différent de auth.uid est refusé'
);
SELECT is(
  pg_temp.try_reserve(
    '62000000-0000-4000-8000-000000000201',
    '62000000-0000-4000-8000-000000000301',
    10, '62000000-0000-4000-8000-000000000001'
  ),
  'ERR:23514', 'une quantité en onces passée comme grammes est refusée'
);
RESET ROLE;

SELECT pg_temp.set_test_claims(
  '62000000-0000-4000-8000-000000000001', 'authenticated', 'aal1'
);
SET LOCAL ROLE authenticated;
SELECT is(
  pg_temp.try_reserve(
    '62000000-0000-4000-8000-000000000201',
    '62000000-0000-4000-8000-000000000301',
    311.034768, '62000000-0000-4000-8000-000000000001'
  ),
  'ERR:42501', 'AAL1 ne réserve pas de quota'
);
RESET ROLE;

SELECT pg_temp.set_test_claims(
  '62000000-0000-4000-8000-000000000002', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(
  pg_temp.try_reserve(
    '62000000-0000-4000-8000-000000000201',
    '62000000-0000-4000-8000-000000000301',
    311.034768, '62000000-0000-4000-8000-000000000002'
  ),
  'OK:true', 'la Mine A peut rappeler idempotemment la réservation de son expédition'
);
RESET ROLE;

SELECT pg_temp.set_test_claims(
  '62000000-0000-4000-8000-000000000003', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(
  pg_temp.try_reserve(
    '62000000-0000-4000-8000-000000000201',
    '62000000-0000-4000-8000-000000000301',
    311.034768, '62000000-0000-4000-8000-000000000003'
  ),
  'ERR:42501', 'la Mine B ne réserve pas le quota de l’expédition de la Mine A'
);
RESET ROLE;

-- Invariants tenant/quota ----------------------------------------------------
SELECT pg_temp.set_test_claims(
  '62000000-0000-4000-8000-000000000099', 'service_role', 'aal2'
);
SELECT is(
  pg_temp.try_cross_tenant_shipping(),
  'ERR:23514', 'une licence d’un autre tenant est refusée avant écriture'
);
SELECT is(
  pg_temp.try_over_quota_shipping(),
  'ERR:23514', 'deux réservations concurrentes logiques ne dépassent pas le quota'
);
SELECT ok(
  pg_get_functiondef(
    'public.snp_sync_shipping_license_reservation(uuid,uuid)'::regprocedure
  ) LIKE '%FOR UPDATE%',
  'la synchronisation verrouille les lignes avant calcul'
);

-- Libération idempotente -----------------------------------------------------
SELECT pg_temp.set_test_claims(
  '62000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(
  pg_temp.try_release(
    '62000000-0000-4000-8000-000000000301',
    'Annulation contrôlée du dossier test'
  ),
  'OK:true', 'la libération canonique réussit'
);
RESET ROLE;

SELECT is(
  (SELECT used_quantity_grams FROM public.export_licenses
   WHERE id = '62000000-0000-4000-8000-000000000201'),
  0::numeric,
  'la première libération restitue exactement le quota'
);

SELECT pg_temp.set_test_claims(
  '62000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(
  pg_temp.try_release(
    '62000000-0000-4000-8000-000000000301',
    'Deuxième appel idempotent du dossier'
  ),
  'OK:true', 'une seconde libération est idempotente'
);
SELECT is(
  (SELECT used_quantity_grams FROM public.export_licenses
   WHERE id = '62000000-0000-4000-8000-000000000201'),
  0::numeric,
  'la seconde libération ne soustrait rien de plus'
);
SELECT is(
  pg_temp.try_delete_shipping('62000000-0000-4000-8000-000000000301'),
  'OK:1', 'la suppression contrôlée réutilise la libération idempotente'
);
RESET ROLE;

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.snp_export_license_reservations
    WHERE shipping_reference = '62000000-0000-4000-8000-000000000301'
      AND shipping_preparation_id IS NULL
      AND status = 'released'
      AND released_at IS NOT NULL
  ),
  'la suppression conserve l’historique de réservation libérée'
);
SELECT is(
  (SELECT count(*) FROM public.export_licenses el
   WHERE abs(
     el.used_quantity_grams
     - (el.quota_baseline_used_grams + coalesce((
       SELECT sum(r.reserved_grams)
       FROM public.snp_export_license_reservations r
       WHERE r.license_id = el.id AND r.status = 'reserved'
     ), 0))
   ) > 0.01),
  0::bigint,
  'chaque licence reste égale à baseline plus réservations actives'
);

SELECT * FROM finish();
ROLLBACK;
