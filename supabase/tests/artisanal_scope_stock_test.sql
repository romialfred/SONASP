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
  PERFORM set_config('request.jwt.claim.aal', p_aal, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_sub, 'role', p_role, 'aal', p_aal)::text,
    true
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_insert_artisan()
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
  INSERT INTO public.snp_artisans_miniers (
    id, type_artisan, type_personne, actif, nom, telephone
  ) VALUES (
    '40000000-0000-4000-8000-000000000299', 'exploitant', 'physique', true,
    'Insertion hors périmètre', '+22600000000'
  );
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_stock(
  p_org uuid,
  p_artisan uuid,
  p_direction text,
  p_quantity numeric,
  p_type text,
  p_reference text,
  p_key text,
  p_reverses uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
AS $fn$
DECLARE v_id uuid;
BEGIN
  v_id := public.snp_record_comptoir_stock_movement(
    p_org, p_artisan, p_direction, p_quantity, p_type,
    p_reference, p_key, NULL, NULL, p_reverses, p_reason
  );
  RETURN v_id::text;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_update_foreign_artisan(p_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $fn$
DECLARE v_rows integer;
BEGIN
  UPDATE public.snp_artisans_miniers
  SET nom = 'Altération inter-périmètre'
  WHERE id = p_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_update_ledger(p_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $fn$
DECLARE v_rows integer;
BEGIN
  UPDATE public.snp_artisanal_stock_ledger
  SET quantity_grams = quantity_grams + 1
  WHERE id = p_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows::text;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$fn$;

CREATE TEMP TABLE pg_temp.test_ids (
  key text PRIMARY KEY,
  value uuid NOT NULL
) ON COMMIT DROP;
GRANT SELECT, INSERT, UPDATE, DELETE ON pg_temp.test_ids TO authenticated;

SELECT plan(32);

SELECT has_table('public', 'snp_organizations', 'le périmètre organisationnel existe');
SELECT has_table('public', 'snp_collector_artisan_assignments', 'les rattachements historisés existent');
SELECT has_table('public', 'snp_artisanal_stock_ledger', 'le ledger de stock existe');

SELECT pg_temp.set_test_claims(
  '40000000-0000-4000-8000-000000000001', 'service_role', 'aal2'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'management-artisanal-test@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('40000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'collector-a-test@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('40000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'collector-b-test@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('40000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'comptoir-a-test@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.user_profiles (
  id, email, full_name, role, is_active, mining_company_id, mfa_enrolled_at
) VALUES
  ('40000000-0000-4000-8000-000000000001', 'management-artisanal-test@sonasp.invalid', 'Direction Artisanat', 'management', true, NULL, now()),
  -- Le rôle Manager est volontairement et irrévocablement en lecture seule.
  -- Les collecteurs sont donc caractérisés par leur responsabilité serveur
  -- `collector.operate`, sans détourner ce rôle de consultation.
  ('40000000-0000-4000-8000-000000000002', 'collector-a-test@sonasp.invalid', 'Collecteur A', 'customer', true, NULL, now()),
  ('40000000-0000-4000-8000-000000000003', 'collector-b-test@sonasp.invalid', 'Collecteur B', 'customer', true, NULL, now()),
  ('40000000-0000-4000-8000-000000000004', 'comptoir-a-test@sonasp.invalid', 'Comptoir A', 'customer', true, NULL, now());

INSERT INTO public.snp_organizations (
  id, code, name, organization_type, is_active
) VALUES
  ('40000000-0000-4000-8000-000000000101', 'CPT-A', 'Comptoir A', 'comptoir', true),
  ('40000000-0000-4000-8000-000000000102', 'CPT-B', 'Comptoir B', 'comptoir', true);

INSERT INTO public.snp_artisans_miniers (
  id, type_artisan, type_personne, actif, nom, prenoms, telephone
) VALUES
  ('40000000-0000-4000-8000-000000000201', 'collecteur', 'physique', true, 'Collecteur', 'Alpha', '+22670000001'),
  ('40000000-0000-4000-8000-000000000202', 'collecteur', 'physique', true, 'Collecteur', 'Beta', '+22670000002'),
  ('40000000-0000-4000-8000-000000000211', 'exploitant', 'physique', true, 'Orpailleur', 'Alpha', '+22670000011'),
  ('40000000-0000-4000-8000-000000000212', 'exploitant', 'physique', true, 'Orpailleur', 'Beta', '+22670000012');

INSERT INTO public.snp_collector_accounts (
  user_id, collector_id, comptoir_organization_id, reason
) VALUES
  ('40000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000201', '40000000-0000-4000-8000-000000000101', 'Rattachement de caractérisation du collecteur Alpha'),
  ('40000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000202', '40000000-0000-4000-8000-000000000102', 'Rattachement de caractérisation du collecteur Beta');

INSERT INTO public.snp_collector_artisan_assignments (
  collector_id, artisan_id, comptoir_organization_id, reason
) VALUES
  ('40000000-0000-4000-8000-000000000201', '40000000-0000-4000-8000-000000000211', '40000000-0000-4000-8000-000000000101', 'Affectation initiale de l’orpailleur Alpha'),
  ('40000000-0000-4000-8000-000000000202', '40000000-0000-4000-8000-000000000212', '40000000-0000-4000-8000-000000000102', 'Affectation initiale de l’orpailleur Beta');

UPDATE public.snp_artisans_miniers
SET collecteur_id = CASE id
  WHEN '40000000-0000-4000-8000-000000000211'::uuid THEN '40000000-0000-4000-8000-000000000201'::uuid
  WHEN '40000000-0000-4000-8000-000000000212'::uuid THEN '40000000-0000-4000-8000-000000000202'::uuid
  ELSE collecteur_id END
WHERE id IN (
  '40000000-0000-4000-8000-000000000211',
  '40000000-0000-4000-8000-000000000212'
);

INSERT INTO public.snp_user_capabilities (
  user_id, capability_code, allowed, reason
) VALUES
  ('40000000-0000-4000-8000-000000000002', 'collector.operate', true, 'Habilitation de caractérisation du collecteur Alpha'),
  ('40000000-0000-4000-8000-000000000003', 'collector.operate', true, 'Habilitation de caractérisation du collecteur Beta'),
  ('40000000-0000-4000-8000-000000000004', 'comptoir.manage', true, 'Habilitation de caractérisation du comptoir Alpha');

INSERT INTO public.snp_user_organization_memberships (
  user_id, organization_id, membership_role, is_primary, reason
) VALUES (
  '40000000-0000-4000-8000-000000000004',
  '40000000-0000-4000-8000-000000000101',
  'operator', true, 'Périmètre principal du comptoir Alpha'
);

INSERT INTO public.snp_artisan_ventes_or (
  id, artisan_id, comptoir_organization_id, quantite_grammes, type_or,
  purete_karat, prix_kg_fcfa, montant_brut_fcfa, montant_total_fcfa
) VALUES
  ('40000000-0000-4000-8000-000000000301', '40000000-0000-4000-8000-000000000211', '40000000-0000-4000-8000-000000000101', 10, 'poudre', 22, 40000000, 400000, 476000),
  ('40000000-0000-4000-8000-000000000302', '40000000-0000-4000-8000-000000000212', '40000000-0000-4000-8000-000000000102', 10, 'poudre', 22, 40000000, 400000, 476000);

SELECT pg_temp.set_test_claims(
  '40000000-0000-4000-8000-000000000002', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  public.snp_current_collector_id(),
  '40000000-0000-4000-8000-000000000201'::uuid,
  'le compte Collecteur A résout son entité métier'
);
SELECT is(
  public.snp_current_organization_id(),
  '40000000-0000-4000-8000-000000000101'::uuid,
  'le compte Collecteur A hérite du comptoir A'
);
SELECT ok(
  public.snp_can_access_artisan('40000000-0000-4000-8000-000000000211'),
  'le Collecteur A accède à son orpailleur'
);
SELECT is(
  public.snp_can_access_artisan('40000000-0000-4000-8000-000000000212'), false,
  'le Collecteur A n’accède pas à l’orpailleur B'
);
SELECT is(
  (SELECT count(*) FROM public.snp_artisans_miniers), 2::bigint,
  'le Collecteur A ne voit que lui-même et son orpailleur'
);
SELECT is(
  (SELECT count(*) FROM public.snp_artisan_ventes_or
   WHERE id = '40000000-0000-4000-8000-000000000301'), 1::bigint,
  'le Collecteur A voit la vente de son orpailleur'
);
SELECT is(
  (SELECT count(*) FROM public.snp_artisan_ventes_or
   WHERE id = '40000000-0000-4000-8000-000000000302'), 0::bigint,
  'le Collecteur A ne voit pas la vente du Collecteur B'
);
SELECT is(
  pg_temp.try_update_foreign_artisan('40000000-0000-4000-8000-000000000212'), 0,
  'le Collecteur A ne modifie pas l’orpailleur B'
);
SELECT is(
  pg_temp.try_insert_artisan(), '42501',
  'un collecteur ne crée pas un artisan hors procédure de rattachement'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '40000000-0000-4000-8000-000000000003', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT ok(
  public.snp_can_access_artisan('40000000-0000-4000-8000-000000000212'),
  'le Collecteur B accède à son orpailleur'
);
SELECT is(
  public.snp_can_access_artisan('40000000-0000-4000-8000-000000000211'), false,
  'le Collecteur B n’accède pas initialement à l’orpailleur A'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '40000000-0000-4000-8000-000000000004', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  public.snp_current_organization_id(),
  '40000000-0000-4000-8000-000000000101'::uuid,
  'l’opérateur Comptoir A résout son périmètre'
);
SELECT is(
  (SELECT count(*) FROM public.snp_artisan_ventes_or
   WHERE id = '40000000-0000-4000-8000-000000000301'), 1::bigint,
  'le Comptoir A voit ses ventes'
);
SELECT is(
  (SELECT count(*) FROM public.snp_artisan_ventes_or
   WHERE id = '40000000-0000-4000-8000-000000000302'), 0::bigint,
  'le Comptoir A ne voit pas les ventes du Comptoir B'
);

INSERT INTO public.snp_artisan_ventes_or (
  id, artisan_id, comptoir_organization_id, quantite_grammes, type_or,
  purete_karat, prix_kg_fcfa, montant_brut_fcfa, montant_total_fcfa
) VALUES (
  '40000000-0000-4000-8000-000000000303',
  '40000000-0000-4000-8000-000000000211',
  '40000000-0000-4000-8000-000000000102',
  10, 'poudre', 22, 40000000, 400000, 476000
);
SELECT is(
  (SELECT comptoir_organization_id FROM public.snp_artisan_ventes_or
   WHERE id = '40000000-0000-4000-8000-000000000303'),
  '40000000-0000-4000-8000-000000000101'::uuid,
  'le trigger ignore un comptoir falsifié dans le payload'
);

INSERT INTO pg_temp.test_ids (key, value)
SELECT 'stock-in', public.snp_record_comptoir_stock_movement(
  '40000000-0000-4000-8000-000000000101',
  '40000000-0000-4000-8000-000000000211',
  'in', 100, 'purchase', 'ACH-A-001', 'idem-stock-a-001'
);
SELECT is(
  public.snp_comptoir_stock_balance('40000000-0000-4000-8000-000000000101'),
  100::numeric,
  'l’achat crédite le stock de 100 grammes'
);
SELECT is(
  pg_temp.try_stock(
    '40000000-0000-4000-8000-000000000101',
    '40000000-0000-4000-8000-000000000211',
    'in', 100, 'purchase', 'ACH-A-001', 'idem-stock-a-001'
  ),
  (SELECT value::text FROM pg_temp.test_ids WHERE key = 'stock-in'),
  'la même clé d’idempotence renvoie la même écriture'
);
SELECT is(
  pg_temp.try_stock(
    '40000000-0000-4000-8000-000000000101',
    '40000000-0000-4000-8000-000000000211',
    'in', 101, 'purchase', 'ACH-A-001', 'idem-stock-a-001'
  ),
  '23505',
  'une clé d’idempotence ne peut pas changer de payload'
);

INSERT INTO pg_temp.test_ids (key, value)
SELECT 'stock-out', public.snp_record_comptoir_stock_movement(
  '40000000-0000-4000-8000-000000000101',
  '40000000-0000-4000-8000-000000000211',
  'out', 40, 'sale', 'VTE-A-001', 'idem-stock-a-002'
);
SELECT is(
  public.snp_comptoir_stock_balance('40000000-0000-4000-8000-000000000101'),
  60::numeric,
  'la vente débite le stock sans le rendre négatif'
);
SELECT is(
  pg_temp.try_stock(
    '40000000-0000-4000-8000-000000000101',
    '40000000-0000-4000-8000-000000000211',
    'out', 70, 'sale', 'VTE-A-002', 'idem-stock-a-003'
  ),
  '23514',
  'une sortie supérieure au solde est refusée'
);
SELECT is(
  pg_temp.try_stock(
    '40000000-0000-4000-8000-000000000102',
    '40000000-0000-4000-8000-000000000212',
    'in', 10, 'purchase', 'ACH-B-001', 'idem-stock-b-001'
  ),
  '42501',
  'le Comptoir A ne crée pas de mouvement pour le Comptoir B'
);
SELECT is(
  pg_temp.try_update_ledger((SELECT value FROM pg_temp.test_ids WHERE key = 'stock-in')),
  '0',
  'une écriture du ledger ne se modifie pas directement'
);

INSERT INTO pg_temp.test_ids (key, value)
SELECT 'stock-reversal', public.snp_record_comptoir_stock_movement(
  '40000000-0000-4000-8000-000000000101',
  '40000000-0000-4000-8000-000000000211',
  'in', 40, 'reversal', 'ANN-VTE-A-001', 'idem-stock-a-004',
  NULL, NULL,
  (SELECT value FROM pg_temp.test_ids WHERE key = 'stock-out'),
  'Annulation justifiée de la vente A-001'
);
SELECT is(
  public.snp_comptoir_stock_balance('40000000-0000-4000-8000-000000000101'),
  100::numeric,
  'la compensation restaure exactement le stock'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '40000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.snp_artisan_ventes_or), 3::bigint,
  'la Direction conserve la vue nationale des ventes artisanales'
);
SELECT lives_ok(
  $$SELECT public.snp_assign_artisan_to_collector(
    '40000000-0000-4000-8000-000000000211',
    '40000000-0000-4000-8000-000000000202',
    '40000000-0000-4000-8000-000000000102',
    'Réaffectation contrôlée vers le collecteur Beta'
  )$$,
  'la Direction réaffecte un orpailleur par RPC auditée'
);
SELECT is(
  (SELECT count(*) FROM public.snp_collector_artisan_assignments
   WHERE artisan_id = '40000000-0000-4000-8000-000000000211'
     AND valid_until IS NOT NULL),
  1::bigint,
  'l’ancien rattachement est conservé dans l’historique'
);
SELECT is(
  (SELECT collecteur_id FROM public.snp_artisans_miniers
   WHERE id = '40000000-0000-4000-8000-000000000211'),
  '40000000-0000-4000-8000-000000000202'::uuid,
  'le champ historique reste synchronisé'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '40000000-0000-4000-8000-000000000002', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(
  public.snp_can_access_artisan('40000000-0000-4000-8000-000000000211'), false,
  'le Collecteur A perd immédiatement l’ancien périmètre'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '40000000-0000-4000-8000-000000000003', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT ok(
  public.snp_can_access_artisan('40000000-0000-4000-8000-000000000211'),
  'le Collecteur B reçoit le nouveau périmètre'
);

RESET ROLE;
SELECT * FROM finish();

ROLLBACK;
