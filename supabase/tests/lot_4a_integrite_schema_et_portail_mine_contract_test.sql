BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO PUBLIC;

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

CREATE OR REPLACE FUNCTION pg_temp.try_mine_company()
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
  RETURN 'OK:' || public.snp_societe_compte_mine()::text;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_requisition_response(p_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_row public.snp_requisitions;
BEGIN
  v_row := public.snp_portail_mine_repondre_requisition(
    p_id, 'approuver', 'Accord contractuel de test'
  );
  RETURN 'OK:' || v_row.statut;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_reglement_response(p_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_status text;
BEGIN
  PERFORM public.snp_portail_mine_repondre_reglement(
    p_id, 'confirmer', NULL
  );
  SELECT reception_statut INTO v_status
  FROM public.snp_reglements_achat WHERE id = p_id;
  RETURN 'OK:' || v_status;
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_view_counts()
RETURNS text
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_assay bigint;
  v_refinery bigint;
  v_presale bigint;
  v_production bigint;
BEGIN
  SELECT count(*) INTO v_assay
  FROM public.assay_certificates_with_shipping;
  SELECT count(*) INTO v_refinery FROM public.shipments_for_refinery;
  SELECT count(*) INTO v_presale FROM public.shipments_for_presale;
  SELECT count(*) INTO v_production FROM public.daily_production_with_metals;
  RETURN format('OK:%s,%s,%s,%s', v_assay, v_refinery, v_presale, v_production);
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_bad_shipping_tenant()
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
  INSERT INTO public.shipping_preparations (
    id, expedition_lot_number, daily_production_id, mining_company_id
  ) VALUES (
    '4a000000-0000-4000-8000-000000000299', '4A-SHIP-BAD',
    '4a000000-0000-4000-8000-000000000111',
    '4a000000-0000-4000-8000-000000000102'
  );
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_bad_shipping_item()
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
  INSERT INTO public.shipping_production_items (
    id, shipping_preparation_id, daily_production_id,
    ingot_box_number, net_weight_grams, gross_weight_grams,
    fineness_pct, pure_gold_grams, seal_number_1
  ) VALUES (
    '4a000000-0000-4000-8000-000000000399',
    '4a000000-0000-4000-8000-000000000201',
    '4a000000-0000-4000-8000-000000000112',
    'BOX-4A-BAD', 90, 100, 90, 81, 'SEAL-4A-BAD'
  );
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_bad_assay_parent()
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
  INSERT INTO public.assay_certificate_data (
    id, certificate_id, shipping_preparation_id
  ) VALUES (
    '4a000000-0000-4000-8000-000000000499',
    '4a000000-0000-4000-8000-000000000411',
    '4a000000-0000-4000-8000-000000000202'
  );
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_bad_freight_tenant()
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
  INSERT INTO public.freight_shipments (
    id, reference_number, gold_price_usd_per_oz, exchange_rate,
    shipping_preparation_id, mining_company_id
  ) VALUES (
    '4a000000-0000-4000-8000-000000000599',
    '4A-FREIGHT-BAD', 2500, 600,
    '4a000000-0000-4000-8000-000000000201',
    '4a000000-0000-4000-8000-000000000102'
  );
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_bad_invitation()
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
  UPDATE public.user_profiles
  SET invitation_id = '4a000000-0000-4000-8000-000000009999'
  WHERE id = '4a000000-0000-4000-8000-000000000001';
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_bad_collector_type()
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
  UPDATE public.snp_artisans_miniers
  SET collecteur_id = '4a000000-0000-4000-8000-000000000702'
  WHERE id = '4a000000-0000-4000-8000-000000000703';
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERR:' || SQLSTATE;
END;
$fn$;

GRANT EXECUTE ON FUNCTION pg_temp.try_mine_company() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION pg_temp.try_requisition_response(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION pg_temp.try_reglement_response(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION pg_temp.try_view_counts() TO authenticated, anon;

SELECT plan(68);

-- Structure des vues --------------------------------------------------------
SELECT is(
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'v'
     AND c.relname IN (
       'assay_certificates_with_shipping', 'shipments_for_refinery',
       'shipments_for_presale', 'daily_production_with_metals'
     )),
  4::bigint, 'les quatre vues API prioritaires existent'
);
SELECT is(
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN (
       'assay_certificates_with_shipping', 'shipments_for_refinery',
       'shipments_for_presale', 'daily_production_with_metals'
     )
     AND 'security_invoker=true' = ANY(COALESCE(c.reloptions, ARRAY[]::text[]))),
  4::bigint, 'les quatre vues exécutent avec les droits de l’appelant'
);
SELECT is(
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN (
       'assay_certificates_with_shipping', 'shipments_for_refinery',
       'shipments_for_presale', 'daily_production_with_metals'
     )
     AND 'security_barrier=true' = ANY(COALESCE(c.reloptions, ARRAY[]::text[]))),
  4::bigint, 'les quatre vues sont aussi des barrières de sécurité'
);
SELECT is(
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN (
       'assay_certificates_with_shipping', 'shipments_for_refinery',
       'shipments_for_presale', 'daily_production_with_metals'
     ) AND has_table_privilege('anon', c.oid, 'SELECT')),
  0::bigint, 'anon ne peut lire aucune vue prioritaire'
);
SELECT is(
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN (
       'assay_certificates_with_shipping', 'shipments_for_refinery',
       'shipments_for_presale', 'daily_production_with_metals'
     ) AND has_table_privilege('authenticated', c.oid, 'SELECT')),
  4::bigint, 'authenticated reçoit seulement SELECT sur les quatre vues'
);
SELECT is(
  (SELECT count(*) FROM pg_views
   WHERE schemaname = 'public'
     AND viewname IN (
       'assay_certificates_with_shipping', 'shipments_for_refinery',
       'shipments_for_presale', 'daily_production_with_metals'
     )
     AND definition ~ 'snp_sec_can_read_(shipping|company)'),
  4::bigint, 'chaque vue porte un prédicat tenant serveur explicite'
);

-- FK, contraintes, triggers et indexes -------------------------------------
SELECT is(
  (SELECT count(*) FROM pg_constraint
   WHERE conname IN (
     'assay_certificate_data_certificate_shipping_fkey',
     'freight_shipments_shipping_company_fkey',
     'user_profiles_invitation_id_fkey',
     'snp_artisans_collecteur_id_fkey'
   ) AND contype = 'f' AND convalidated),
  4::bigint, 'les quatre FK propres sont présentes et validées'
);
SELECT ok(
  (SELECT attnotnull FROM pg_attribute
   WHERE attrelid = 'public.assay_certificate_data'::regclass
     AND attname = 'shipping_preparation_id'),
  'le parent Shipping des données Assay est obligatoire'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_constraint
          WHERE conrelid = 'public.shipping_preparations'::regclass
            AND conname = 'shipping_production_company_fkey'
            AND contype = 'f' AND NOT convalidated),
  'la FK Production/Expédition est installée NOT VALID à cause de l’historique'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_constraint
          WHERE conrelid = 'public.shipping_preparations'::regclass
            AND conname = 'shipping_production_requires_company'
            AND contype = 'c' AND NOT convalidated),
  'le check tenant Production/Expédition protège les nouvelles écritures'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_constraint
          WHERE conrelid = 'public.snp_artisans_miniers'::regclass
            AND conname = 'snp_artisans_collecteur_distinct'
            AND convalidated),
  'un artisan ne peut être son propre collecteur'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger
          WHERE tgrelid = 'public.shipping_production_items'::regclass
            AND tgname = 'snp_4a_shipping_item_tenant_guard'
            AND NOT tgisinternal),
  'les items Shipping ont une garde tenant inter-parent'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger
          WHERE tgrelid = 'public.snp_artisans_miniers'::regclass
            AND tgname = 'snp_4a_artisan_collector_guard'
            AND NOT tgisinternal),
  'le type collecteur est vérifié côté serveur'
);
SELECT ok(NOT has_function_privilege(
  'authenticated', 'public.snp_4a_assert_shipping_item_tenant()', 'EXECUTE'
), 'la fonction trigger Shipping n’est pas appelable par le client');
SELECT ok(NOT has_function_privilege(
  'authenticated', 'public.snp_4a_assert_artisan_collector()', 'EXECUTE'
), 'la fonction trigger Collecteur n’est pas appelable par le client');
SELECT ok(to_regclass('public.idx_assay_certificate_data_shipping') IS NOT NULL,
  'l’index du parent Shipping Assay existe');
SELECT ok(to_regclass('public.idx_assay_certificate_data_certificate_shipping') IS NOT NULL,
  'l’index composite de la FK certificat/Shipping existe');
SELECT ok(to_regclass('public.idx_user_profiles_invitation') IS NOT NULL,
  'l’index invitation profil existe');
SELECT ok(to_regclass('public.idx_freight_shipping_company') IS NOT NULL,
  'l’index composite fret/tenant existe');
SELECT ok(to_regclass('public.idx_shipping_preparations_production_company') IS NOT NULL,
  'l’index composite Production/Expédition existe');
SELECT ok(to_regclass('public.idx_shipping_preparations_license_company') IS NOT NULL,
  'l’index composite Licence/Expédition existe');
SELECT ok(to_regclass('public.idx_snp_artisan_taxes_comptoir_status') IS NOT NULL,
  'l’index taxes par comptoir/statut existe');
SELECT ok(to_regclass('public.idx_snp_artisan_ventes_acheteur_comptoir_date') IS NOT NULL,
  'l’index ventes par comptoir/date existe');
SELECT ok(to_regclass('public.idx_snp_demandes_requisition') IS NOT NULL,
  'l’index demande/réquisition existe');
SELECT ok(to_regclass('public.idx_snp_collector_accounts_comptoir_active') IS NOT NULL,
  'l’index comptes collecteur/comptoir existe');
SELECT ok(to_regclass('public.idx_snp_memberships_organization_validity') IS NOT NULL,
  'l’index memberships par organisation existe');
SELECT ok(to_regclass('public.idx_snp_comptoir_ventes_sonasp_scope') IS NOT NULL,
  'l’index cessions vers SONASP existe');

-- Surface RPC Portail Mine --------------------------------------------------
SELECT ok(
  (SELECT prosecdef FROM pg_proc
   WHERE oid = 'public.snp_societe_compte_mine()'::regprocedure),
  'le résolveur tenant Mine est SECURITY DEFINER'
);
SELECT ok(
  position(
    'snp_require_capability(''mine.operate'')'
    IN pg_get_functiondef('public.snp_societe_compte_mine()'::regprocedure)
  ) > 0,
  'le résolveur tenant exige explicitement mine.operate'
);
SELECT ok(
  position(
    'search_path=public, pg_temp'
    IN array_to_string(
      (SELECT proconfig FROM pg_proc
       WHERE oid = 'public.snp_societe_compte_mine()'::regprocedure), ','
    )
  ) > 0,
  'le résolveur tenant fixe son search_path'
);
SELECT ok(NOT has_function_privilege(
  'anon', 'public.snp_societe_compte_mine()', 'EXECUTE'
), 'anon ne peut appeler le résolveur Mine');
SELECT ok(has_function_privilege(
  'authenticated', 'public.snp_societe_compte_mine()', 'EXECUTE'
), 'authenticated peut appeler le résolveur qui reste fail-closed');
SELECT has_function(
  'public', 'snp_portail_mine_repondre_requisition',
  ARRAY['uuid', 'text', 'text'],
  'la RPC de réponse à une réquisition existe'
);
SELECT has_function(
  'public', 'snp_portail_mine_repondre_reglement',
  ARRAY['uuid', 'text', 'text'],
  'la RPC de réponse à un règlement existe'
);
SELECT ok(NOT has_function_privilege(
  'anon', 'public.snp_portail_mine_repondre_requisition(uuid,text,text)', 'EXECUTE'
), 'anon ne répond pas aux réquisitions');
SELECT ok(NOT has_function_privilege(
  'anon', 'public.snp_portail_mine_repondre_reglement(uuid,text,text)', 'EXECUTE'
), 'anon ne répond pas aux règlements');
SELECT ok(has_function_privilege(
  'authenticated', 'public.snp_portail_mine_repondre_requisition(uuid,text,text)', 'EXECUTE'
), 'authenticated peut appeler la réponse Réquisition protégée');
SELECT ok(has_function_privilege(
  'authenticated', 'public.snp_portail_mine_repondre_reglement(uuid,text,text)', 'EXECUTE'
), 'authenticated peut appeler la réponse Règlement protégée');
SELECT is(
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname LIKE 'snp_portail_mine_%'
     AND has_function_privilege('anon', p.oid, 'EXECUTE')),
  0::bigint, 'aucune RPC Portail Mine n’est exécutable par anon'
);
SELECT is(
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname LIKE 'snp_portail_mine_%'
     AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  0::bigint, 'l’allowlist runtime Portail Mine est accordée à authenticated'
);
SELECT is(
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname LIKE 'snp_portail_mine_%'
     AND position('snp_societe_compte_mine' IN pg_get_functiondef(p.oid)) = 0),
  0::bigint, 'chaque RPC Portail Mine dérive le tenant via la garde centrale'
);
SELECT ok(
  position(
    'snp_require_capability(''mine.operate'')'
    IN pg_get_functiondef(
      'public.snp_portail_mine_repondre_reglement(uuid,text,text)'::regprocedure
    )
  ) > 0,
  'la réponse Règlement a aussi une garde mine.operate locale'
);
SELECT is(
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'snp_reglements_achat'
     AND column_name IN (
       'reception_statut', 'reception_motif',
       'reception_repondu_par', 'reception_repondu_le'
     )),
  4::bigint, 'les quatre colonnes de réception règlement existent'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_constraint
          WHERE conrelid = 'public.snp_reglements_achat'::regclass
            AND conname = 'snp_reglement_reception_statut_check'
            AND convalidated),
  'les états de réception règlement sont contraints'
);

-- Fixtures multi-tenant -----------------------------------------------------
SELECT pg_temp.set_test_claims(
  '4a000000-0000-4000-8000-000000000099', 'service_role', 'aal2'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('4a000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '4a-mine-a@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('4a000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '4a-mine-b@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('4a000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '4a-denied@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('4a000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '4a-manager@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('4a000000-0000-4000-8000-000000000099', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '4a-service@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.mining_companies (
  id, code, name, country, company_type, is_active
) VALUES
  ('4a000000-0000-4000-8000-000000000101', '4A-MINE-A', 'Mine A 4A', 'Burkina Faso', 'production_mine', true),
  ('4a000000-0000-4000-8000-000000000102', '4A-MINE-B', 'Mine B 4A', 'Burkina Faso', 'production_mine', true),
  ('4a000000-0000-4000-8000-000000000103', '4A-MINE-C', 'Mine C 4A', 'Burkina Faso', 'production_mine', true);

INSERT INTO public.user_profiles (
  id, email, full_name, role, is_active, mining_company_id,
  mfa_enrolled_at, must_change_password
) VALUES
  ('4a000000-0000-4000-8000-000000000001', '4a-mine-a@sonasp.invalid', 'Mine A', 'mine', true, '4a000000-0000-4000-8000-000000000101', now(), false),
  ('4a000000-0000-4000-8000-000000000002', '4a-mine-b@sonasp.invalid', 'Mine B', 'mine', true, '4a000000-0000-4000-8000-000000000102', now(), false),
  ('4a000000-0000-4000-8000-000000000003', '4a-denied@sonasp.invalid', 'Mine C refusée', 'mine', true, '4a000000-0000-4000-8000-000000000103', now(), false),
  ('4a000000-0000-4000-8000-000000000004', '4a-manager@sonasp.invalid', 'Manager', 'manager', true, NULL, now(), false),
  ('4a000000-0000-4000-8000-000000000099', '4a-service@sonasp.invalid', 'Service', 'admin', true, NULL, now(), false);

INSERT INTO public.snp_user_capabilities (
  user_id, capability_code, allowed, reason, granted_by
) VALUES (
  '4a000000-0000-4000-8000-000000000003',
  'mine.operate', false, 'Refus explicite pour le test 4A',
  '4a000000-0000-4000-8000-000000000099'
);

INSERT INTO public.daily_production (
  id, production_date, bullion_grams, estimated_fineness_pct,
  estimated_gold_pct, mining_company_id, bar_reference
) VALUES
  ('4a000000-0000-4000-8000-000000000111', current_date, 100, 90, 90, '4a000000-0000-4000-8000-000000000101', '4A-BAR-A'),
  ('4a000000-0000-4000-8000-000000000112', current_date, 100, 90, 90, '4a000000-0000-4000-8000-000000000102', '4A-BAR-B');

INSERT INTO public.shipping_preparations (
  id, expedition_lot_number, mining_company_id, status, created_by
) VALUES
  ('4a000000-0000-4000-8000-000000000201', '4A-SHIP-A', '4a000000-0000-4000-8000-000000000101', 'ready_for_expedition', '4a000000-0000-4000-8000-000000000099'),
  ('4a000000-0000-4000-8000-000000000202', '4A-SHIP-B', '4a000000-0000-4000-8000-000000000102', 'ready_for_expedition', '4a000000-0000-4000-8000-000000000099');

INSERT INTO public.assay_certificates (
  id, shipping_preparation_id, file_path, file_name,
  file_size, mime_type, uploaded_by
) VALUES
  ('4a000000-0000-4000-8000-000000000411', '4a000000-0000-4000-8000-000000000201', '4a000000-0000-4000-8000-000000000201/a.pdf', 'a.pdf', 100, 'application/pdf', '4a000000-0000-4000-8000-000000000099'),
  ('4a000000-0000-4000-8000-000000000412', '4a000000-0000-4000-8000-000000000202', '4a000000-0000-4000-8000-000000000202/b.pdf', 'b.pdf', 100, 'application/pdf', '4a000000-0000-4000-8000-000000000099');

INSERT INTO public.snp_artisans_miniers (
  id, type_personne, type_artisan, nom, telephone
) VALUES
  ('4a000000-0000-4000-8000-000000000701', 'physique', 'collecteur', 'Collecteur 4A', '70000001'),
  ('4a000000-0000-4000-8000-000000000702', 'physique', 'exploitant', 'Exploitant 4A B', '70000002'),
  ('4a000000-0000-4000-8000-000000000703', 'physique', 'exploitant', 'Exploitant 4A C', '70000003');

INSERT INTO public.snp_requisitions (
  id, reference, objet, mining_company_id, quantite_oz,
  regime_juridique, autorite_origine, nature_acte, reference_acte, statut
) VALUES (
  '4a000000-0000-4000-8000-000000000801', 'REQ-4A-A',
  'Réquisition contractuelle de test',
  '4a000000-0000-4000-8000-000000000101', 1,
  'accord_requis', 'SONASP', 'Décision de test', 'ACTE-4A-001', 'notifiee'
);

INSERT INTO public.snp_reglements_achat (
  id, reference_reglement, mining_company_id, montant_fcfa,
  statut, reception_statut
) VALUES
  ('4a000000-0000-4000-8000-000000000901', 'REG-4A-A', '4a000000-0000-4000-8000-000000000101', 100000, 'execute', 'a_confirmer'),
  ('4a000000-0000-4000-8000-000000000902', 'REG-4A-B', '4a000000-0000-4000-8000-000000000102', 100000, 'execute', 'a_confirmer');

-- Négatifs anon / AAL1 / capability / tenant -------------------------------
SELECT pg_temp.set_test_claims(
  '4a000000-0000-4000-8000-000000000001', 'anon', 'aal1'
);
SET LOCAL ROLE anon;
SELECT is(pg_temp.try_mine_company(), 'ERR:42501',
  'anon est refusé par la garde Mine');
SELECT is(pg_temp.try_requisition_response(
  '4a000000-0000-4000-8000-000000000801'
), 'ERR:42501', 'anon ne répond pas à une réquisition');
SELECT is(pg_temp.try_reglement_response(
  '4a000000-0000-4000-8000-000000000901'
), 'ERR:42501', 'anon ne répond pas à un règlement');
RESET ROLE;

SELECT pg_temp.set_test_claims(
  '4a000000-0000-4000-8000-000000000001', 'authenticated', 'aal1'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_mine_company(), 'ERR:42501',
  'une Mine AAL1 est refusée malgré son rôle');
SELECT is(pg_temp.try_requisition_response(
  '4a000000-0000-4000-8000-000000000801'
), 'ERR:42501', 'AAL1 ne répond pas à une réquisition');
SELECT is(pg_temp.try_reglement_response(
  '4a000000-0000-4000-8000-000000000901'
), 'ERR:42501', 'AAL1 ne répond pas à un règlement');
SELECT is(pg_temp.try_view_counts(), 'OK:0,0,0,0',
  'AAL1 ne lit aucune vue tenant sensible');
RESET ROLE;

SELECT pg_temp.set_test_claims(
  '4a000000-0000-4000-8000-000000000003', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_mine_company(), 'ERR:42501',
  'un refus explicite mine.operate prévaut sur le rôle Mine');
SELECT is(pg_temp.try_requisition_response(
  '4a000000-0000-4000-8000-000000000801'
), 'ERR:42501', 'sans mine.operate la réquisition est refusée');
SELECT is(pg_temp.try_reglement_response(
  '4a000000-0000-4000-8000-000000000901'
), 'ERR:42501', 'sans mine.operate le règlement est refusé');
RESET ROLE;

SELECT pg_temp.set_test_claims(
  '4a000000-0000-4000-8000-000000000002', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_mine_company(),
  'OK:4a000000-0000-4000-8000-000000000102',
  'la Mine B résout uniquement son tenant');
SELECT is(pg_temp.try_requisition_response(
  '4a000000-0000-4000-8000-000000000801'
), 'ERR:42501', 'la Mine B ne répond pas à la réquisition de la Mine A');
SELECT is(pg_temp.try_reglement_response(
  '4a000000-0000-4000-8000-000000000901'
), 'ERR:42501', 'la Mine B ne répond pas au règlement de la Mine A');
SELECT is(pg_temp.try_view_counts(), 'OK:1,1,1,1',
  'la Mine B ne voit que ses objets dans les quatre vues');
RESET ROLE;

SELECT pg_temp.set_test_claims(
  '4a000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_mine_company(),
  'OK:4a000000-0000-4000-8000-000000000101',
  'la Mine A AAL2 avec capability résout son tenant');
SELECT is(pg_temp.try_view_counts(), 'OK:1,1,1,1',
  'la Mine A ne voit que ses objets dans les quatre vues');
SELECT is(pg_temp.try_requisition_response(
  '4a000000-0000-4000-8000-000000000801'
), 'OK:accusee', 'la Mine A autorisée répond à sa réquisition');
SELECT is(pg_temp.try_reglement_response(
  '4a000000-0000-4000-8000-000000000901'
), 'OK:confirmee', 'la Mine A autorisée confirme son règlement');
RESET ROLE;

-- Enforcements relationnels nouveaux ---------------------------------------
SELECT is(pg_temp.try_bad_shipping_tenant(), 'ERR:23503',
  'une nouvelle expédition ne peut lier la production d’un autre tenant');
SELECT is(pg_temp.try_bad_shipping_item(), 'ERR:23514',
  'un nouvel item Shipping ne peut croiser deux tenants');
SELECT is(pg_temp.try_bad_assay_parent(), 'ERR:23503',
  'une donnée Assay doit partager le parent Shipping de son certificat');
SELECT is(pg_temp.try_bad_freight_tenant(), 'ERR:23503',
  'un fret doit partager le tenant de son expédition');
SELECT is(pg_temp.try_bad_invitation(), 'ERR:23503',
  'un profil ne référence pas une invitation absente');
SELECT is(pg_temp.try_bad_collector_type(), 'ERR:23514',
  'un exploitant ne peut être désigné comme collecteur');

SELECT * FROM finish();
ROLLBACK;
