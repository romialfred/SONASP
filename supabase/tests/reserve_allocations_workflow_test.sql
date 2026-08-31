BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;

CREATE OR REPLACE FUNCTION pg_temp.set_reserve_claims(p_sub uuid, p_role text, p_aal text)
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_sub::text, true);
  PERFORM set_config('request.jwt.claim.role', p_role, true);
  PERFORM set_config('request.jwt.claim.aal', p_aal, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_sub, 'role', p_role, 'aal', p_aal,
      'session_id', 'reserve-' || replace(p_sub::text,'-',''),
      'exp', floor(extract(epoch FROM now() + interval '1 hour'))::bigint
    )::text,
    true
  );
END;
$fn$;
GRANT EXECUTE ON FUNCTION pg_temp.set_reserve_claims(uuid,text,text) TO PUBLIC;

CREATE OR REPLACE FUNCTION pg_temp.try_reserve_transition(p_allocation_id uuid, p_status text)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
  PERFORM public.snp_transition_reserve_allocation(p_allocation_id, p_status, 'Test automatisé');
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$fn$;
GRANT EXECUTE ON FUNCTION pg_temp.try_reserve_transition(uuid,text) TO authenticated;

SELECT plan(34);

SELECT has_table('public', 'reserve_allocations', 'le registre des affectations existe');
SELECT has_table('public', 'reserve_allocation_items', 'les lignes de stock réservées sont relationnelles');
SELECT has_table('public', 'reserve_allocation_events', 'le journal append-only du workflow existe');
SELECT has_table('public', 'reserve_allocation_documents', 'les métadonnées documentaires existent');
SELECT has_function(
  'public', 'snp_save_reserve_allocation', ARRAY['uuid','jsonb','uuid[]'],
  'l’enregistrement atomique d’un brouillon existe'
);
SELECT has_function(
  'public', 'snp_transition_reserve_allocation', ARRAY['uuid','text','text'],
  'la machine à états serveur existe'
);
SELECT has_function(
  'public', 'snp_reserve_draft_owned_or_owner', ARRAY['uuid'],
  'la propriété serveur des brouillons est contrôlée'
);

SELECT pg_temp.set_reserve_claims(
  '72000000-0000-4000-8000-000000000099', 'service_role', 'aal2'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('72000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reserve-preparateur@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('72000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reserve-validateur-1@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('72000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reserve-validateur-2@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('72000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reserve-transfert@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('72000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reserve-reception@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('72000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reserve-rapprochement@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('72000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reserve-activation@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.user_profiles (
  id, email, full_name, role, is_active, mining_company_id, mfa_enrolled_at
) VALUES
  ('72000000-0000-4000-8000-000000000001', 'reserve-preparateur@sonasp.invalid', 'Préparateur réserve', 'management', true, NULL, now()),
  ('72000000-0000-4000-8000-000000000002', 'reserve-validateur-1@sonasp.invalid', 'Validateur réserve 1', 'management', true, NULL, now()),
  ('72000000-0000-4000-8000-000000000003', 'reserve-validateur-2@sonasp.invalid', 'Validateur réserve 2', 'management', true, NULL, now()),
  ('72000000-0000-4000-8000-000000000004', 'reserve-transfert@sonasp.invalid', 'Opérateur transfert', 'management', true, NULL, now()),
  ('72000000-0000-4000-8000-000000000005', 'reserve-reception@sonasp.invalid', 'Réceptionnaire réserve', 'management', true, NULL, now()),
  ('72000000-0000-4000-8000-000000000006', 'reserve-rapprochement@sonasp.invalid', 'Rapprocheur réserve', 'management', true, NULL, now()),
  ('72000000-0000-4000-8000-000000000007', 'reserve-activation@sonasp.invalid', 'Contrôleur activation', 'management', true, NULL, now());

INSERT INTO public.user_sessions(user_id,token_hash,expires_at,is_active)
SELECT profile.id,
  extensions.digest('reserve-' || replace(profile.id::text,'-',''),'sha256'),
  now()+interval '1 hour',true
FROM public.user_profiles profile
WHERE profile.id::text LIKE '72000000-0000-4000-8000-00000000000_';

INSERT INTO public.gold_inventory (
  id, created_by, final_fine_grams, final_fine_oz, fineness_percentage,
  metal_retained_percentage, quantity_available_oz, transaction_type,
  weight_after_melting_grams, weight_before_melting_grams, certificate_number
) VALUES (
  '72000000-0000-4000-8000-000000000101',
  '72000000-0000-4000-8000-000000000001',
  311.034768, 10, 100, 100, 10, 'entry', 311.034768, 311.034768,
  'CERT-RESERVE-TEST-001'
);

CREATE TEMP TABLE reserve_test_context(allocation_id uuid PRIMARY KEY);
GRANT SELECT, INSERT, UPDATE, DELETE ON reserve_test_context TO authenticated,service_role;

SELECT pg_temp.set_reserve_claims(
  '72000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

INSERT INTO reserve_test_context(allocation_id)
SELECT public.snp_save_reserve_allocation(
  NULL,
  jsonb_build_object(
    'allocation_date', current_date,
    'reason', 'Constitution de la réserve de test',
    'allocation_nature', 'CONSTITUTION_RESERVE',
    'priority', 'NORMAL',
    'decision_reference', 'DEC-RESERVE-TEST-001',
    'decision_date', current_date,
    'decision_authority', 'Ministère de l’Économie et des Finances',
    'control_results', jsonb_build_object(
      'purity', true, 'weight', true, 'certificates', true,
      'eligibility', true, 'sale_conflict', true, 'availability', true
    ),
    'depository_organization_id', '71000000-0000-4000-8000-000000000001',
    'deposit_type', 'reserve_vault',
    'planned_transfer_date', current_date + 1
  ),
  ARRAY['72000000-0000-4000-8000-000000000101'::uuid]
);

SELECT is(
  (SELECT status FROM public.reserve_allocations WHERE id=(SELECT allocation_id FROM reserve_test_context)),
  'DRAFT', 'le cycle démarre en brouillon'
);
SELECT is(
  (SELECT count(*) FROM public.reserve_allocation_items WHERE allocation_id=(SELECT allocation_id FROM reserve_test_context)),
  1::bigint, 'un actif réel du stock est réservé'
);
SELECT is(
  (SELECT lot_count FROM public.reserve_allocations WHERE id=(SELECT allocation_id FROM reserve_test_context)),
  1, 'les totaux du dossier sont calculés côté serveur'
);

RESET ROLE;
SELECT pg_temp.set_reserve_claims(
  '72000000-0000-4000-8000-000000000099', 'service_role', 'aal2'
);
SET LOCAL ROLE service_role;
SELECT public.snp_register_reserve_document_gateway(
  (SELECT allocation_id FROM reserve_test_context), 'decision_allocation',
  'decision-test.pdf', (SELECT allocation_id::text FROM reserve_test_context) || '/format-validated/2026/08/decision-test.pdf',
  'application/pdf', 1024, '72000000-0000-4000-8000-000000000001'
);
RESET ROLE;
SELECT pg_temp.set_reserve_claims(
  '72000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM public.reserve_allocation_documents WHERE allocation_id=(SELECT allocation_id FROM reserve_test_context) AND deleted_at IS NULL),
  1::bigint, 'la décision obligatoire est rattachée au dossier'
);
SELECT is(
  pg_temp.try_reserve_transition((SELECT allocation_id FROM reserve_test_context), 'SUBMITTED'),
  'ok', 'le préparateur soumet un dossier complet'
);
SELECT is(
  pg_temp.try_reserve_transition((SELECT allocation_id FROM reserve_test_context), 'UNDER_REVIEW'),
  '42501', 'le préparateur ne prend pas en contrôle son propre dossier'
);

RESET ROLE;
SELECT pg_temp.set_reserve_claims('72000000-0000-4000-8000-000000000002', 'authenticated', 'aal2');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_reserve_transition((SELECT allocation_id FROM reserve_test_context), 'UNDER_REVIEW'), 'ok', 'un autre acteur prend le dossier en contrôle');
SELECT is(pg_temp.try_reserve_transition((SELECT allocation_id FROM reserve_test_context), 'VALIDATED_LEVEL_1'), 'ok', 'le premier validateur valide le niveau 1');
SELECT is(pg_temp.try_reserve_transition((SELECT allocation_id FROM reserve_test_context), 'VALIDATED_LEVEL_2'), '42501', 'le premier validateur ne réalise pas le niveau 2');

RESET ROLE;
SELECT pg_temp.set_reserve_claims('72000000-0000-4000-8000-000000000003', 'authenticated', 'aal2');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_reserve_transition((SELECT allocation_id FROM reserve_test_context), 'VALIDATED_LEVEL_2'), 'ok', 'un second validateur indépendant valide le niveau 2');

RESET ROLE;
SELECT pg_temp.set_reserve_claims('72000000-0000-4000-8000-000000000004', 'authenticated', 'aal2');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_reserve_transition((SELECT allocation_id FROM reserve_test_context), 'TRANSFER_AUTHORIZED'), 'ok', 'le transfert est autorisé');
SELECT is(pg_temp.try_reserve_transition((SELECT allocation_id FROM reserve_test_context), 'IN_TRANSIT'), 'ok', 'le transfert passe en transit');

RESET ROLE;
SELECT pg_temp.set_reserve_claims('72000000-0000-4000-8000-000000000005', 'authenticated', 'aal2');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_reserve_transition((SELECT allocation_id FROM reserve_test_context), 'RECEIVED'), 'ok', 'la réception est confirmée');
SELECT is(pg_temp.try_reserve_transition((SELECT allocation_id FROM reserve_test_context), 'RECONCILIATION_PENDING'), 'ok', 'le rapprochement est ouvert');

RESET ROLE;
SELECT pg_temp.set_reserve_claims('72000000-0000-4000-8000-000000000006', 'authenticated', 'aal2');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_reserve_transition((SELECT allocation_id FROM reserve_test_context), 'RECONCILED'), 'ok', 'le rapprochement est confirmé');

RESET ROLE;
SELECT pg_temp.set_reserve_claims('72000000-0000-4000-8000-000000000007', 'authenticated', 'aal2');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_reserve_transition((SELECT allocation_id FROM reserve_test_context), 'ACTIVE'), 'ok', 'l’actif entre dans la réserve nationale');

SELECT is(
  (SELECT status FROM public.reserve_allocations WHERE id=(SELECT allocation_id FROM reserve_test_context)),
  'ACTIVE', 'le dossier termine dans l’état actif'
);
RESET ROLE;
SET LOCAL ROLE postgres;
SELECT is(
  (SELECT round(quantity_available_oz, 6) FROM public.gold_inventory WHERE id='72000000-0000-4000-8000-000000000101'),
  0::numeric, 'la quantité opérationnelle est consommée atomiquement'
);
SELECT is(
  (SELECT round(quantity_national_reserve_oz, 6) FROM public.gold_inventory WHERE id='72000000-0000-4000-8000-000000000101'),
  10::numeric, 'la quantité est créditée dans la réserve nationale'
);
SELECT is(
  (SELECT round(
    coalesce(quantity_available_oz,0)+coalesce(quantity_allocated_oz,0)
      +coalesce(quantity_sold_oz,0)+coalesce(quantity_national_reserve_oz,0),6
   ) FROM public.gold_inventory WHERE id='72000000-0000-4000-8000-000000000101'),
  10::numeric, 'l’activation conserve exactement la quantité entre les compartiments'
);
RESET ROLE;
SELECT pg_temp.set_reserve_claims('72000000-0000-4000-8000-000000000007', 'authenticated', 'aal2');
SET LOCAL ROLE authenticated;
SELECT is(
  pg_temp.try_reserve_transition((SELECT allocation_id FROM reserve_test_context), 'ACTIVE'),
  '22023', 'une seconde activation est refusée sans seconde consommation'
);
RESET ROLE;
SET LOCAL ROLE postgres;
SELECT is(
  (SELECT round(quantity_national_reserve_oz,6) FROM public.gold_inventory
   WHERE id='72000000-0000-4000-8000-000000000101'),
  10::numeric, 'la reprise d’activation ne double pas le crédit réserve'
);

INSERT INTO public.gold_inventory(
  id,created_by,final_fine_grams,final_fine_oz,fineness_percentage,
  metal_retained_percentage,quantity_available_oz,transaction_type,
  weight_after_melting_grams,weight_before_melting_grams,certificate_number
) VALUES(
  '72000000-0000-4000-8000-000000000102',
  '72000000-0000-4000-8000-000000000001',155.517384,5,100,100,5,'entry',
  155.517384,155.517384,'CERT-RESERVE-TEST-002'
);
CREATE TEMP TABLE reserve_cancel_context(allocation_id uuid PRIMARY KEY);
GRANT SELECT,INSERT,UPDATE,DELETE ON reserve_cancel_context TO authenticated;
RESET ROLE;
SELECT pg_temp.set_reserve_claims('72000000-0000-4000-8000-000000000001', 'authenticated', 'aal2');
SET LOCAL ROLE authenticated;
INSERT INTO reserve_cancel_context(allocation_id)
SELECT public.snp_save_reserve_allocation(
  NULL,
  jsonb_build_object('reason','Brouillon annulé','priority','NORMAL'),
  ARRAY['72000000-0000-4000-8000-000000000102'::uuid]
);
SELECT is(
  pg_temp.try_reserve_transition((SELECT allocation_id FROM reserve_cancel_context),'CANCELLED'),
  'ok','un brouillon peut être annulé par son auteur'
);
SELECT is(
  (SELECT count(*) FROM public.reserve_allocation_items
   WHERE allocation_id=(SELECT allocation_id FROM reserve_cancel_context) AND released_at IS NULL),
  0::bigint,'l’annulation libère la relation sans mouvement de matière'
);
RESET ROLE;
SET LOCAL ROLE postgres;
SELECT is(
  (SELECT round(quantity_available_oz,6) FROM public.gold_inventory
   WHERE id='72000000-0000-4000-8000-000000000102'),
  5::numeric,'l’annulation ne crée ni ne consomme de disponible'
);
SELECT is(
  (SELECT round(
    coalesce(quantity_available_oz,0)+coalesce(quantity_allocated_oz,0)
      +coalesce(quantity_sold_oz,0)+coalesce(quantity_national_reserve_oz,0),6
   ) FROM public.gold_inventory WHERE id='72000000-0000-4000-8000-000000000102'),
  5::numeric,'la libération conserve exactement la quantité du lingot'
);
SELECT is(
  (SELECT count(*) FROM public.reserve_allocation_events WHERE allocation_id=(SELECT allocation_id FROM reserve_test_context)),
  12::bigint, 'la création, le document et les dix transitions sont journalisés'
);

RESET ROLE;
SET LOCAL ROLE postgres;
SET LOCAL search_path=public,extensions;
SELECT * FROM finish();
ROLLBACK;
