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

CREATE OR REPLACE FUNCTION pg_temp.try_payment_status(
  p_payment_id uuid,
  p_status text,
  p_proof text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
AS $fn$
DECLARE v_status text;
BEGIN
  UPDATE public.snp_artisan_paiements
  SET statut = p_status,
      preuve_paiement_url = COALESCE(p_proof, preuve_paiement_url)
  WHERE id = p_payment_id
  RETURNING statut INTO v_status;
  RETURN COALESCE(v_status, 'no-row');
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_duplicate_payment()
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
  INSERT INTO public.snp_artisan_paiements (
    id, reference_paiement, facture_id, vente_or_id, artisan_id,
    type_paiement, montant_paye, montant_taxes_retenues, statut
  ) VALUES (
    '50000000-0000-4000-8000-000000000399', 'PAY-A-DUP',
    '50000000-0000-4000-8000-000000000321',
    '50000000-0000-4000-8000-000000000301',
    '50000000-0000-4000-8000-000000000211',
    'virement_bancaire', 400000, 0, 'en_attente'
  );
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_certification(p_facture_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
  UPDATE public.snp_artisan_factures_definitives
  SET certification_dgi_status = 'certified',
      dgi_reference = 'DGI-DIRECT',
      dgi_document_path = 'dgi/direct.pdf'
  WHERE id = p_facture_id;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_certify(
  p_facture_id uuid,
  p_reference text,
  p_path text
)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
  PERFORM public.snp_certify_artisan_invoice(p_facture_id, p_reference, p_path);
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_mutate_certified_invoice(p_facture_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
  UPDATE public.snp_artisan_factures_definitives
  SET montant_net_a_payer = montant_net_a_payer + 1
  WHERE id = p_facture_id;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$fn$;

SELECT plan(31);

SELECT has_function(
  'public', 'snp_certify_artisan_invoice', ARRAY['uuid', 'text', 'text'],
  'la certification DGI passe par une RPC dédiée'
);
SELECT has_column(
  'public', 'snp_artisan_factures_definitives', 'certification_dgi_status',
  'les factures portent leur état de certification DGI'
);
SELECT has_trigger(
  'public', 'snp_artisan_paiements', 'snp_artisan_payment_guard',
  'le workflow de paiement est protégé par trigger'
);

SELECT pg_temp.set_test_claims(
  '50000000-0000-4000-8000-000000000001', 'service_role', 'aal2'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('50000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'artisan-fixture-owner@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('50000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'comptoir-preparer@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('50000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'comptoir-validator@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('50000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'comptoir-b@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.user_profiles (
  id, email, full_name, role, is_active, mining_company_id, mfa_enrolled_at
) VALUES
  ('50000000-0000-4000-8000-000000000001', 'artisan-fixture-owner@sonasp.invalid', 'Fixture Artisanat', 'management', true, NULL, now()),
  ('50000000-0000-4000-8000-000000000002', 'comptoir-preparer@sonasp.invalid', 'Préparateur Comptoir A', 'customer', true, NULL, now()),
  ('50000000-0000-4000-8000-000000000003', 'comptoir-validator@sonasp.invalid', 'Validateur Comptoir A', 'customer', true, NULL, now()),
  ('50000000-0000-4000-8000-000000000004', 'comptoir-b@sonasp.invalid', 'Opérateur Comptoir B', 'customer', true, NULL, now());

INSERT INTO public.snp_organizations (
  id, code, name, organization_type, is_active
) VALUES
  ('50000000-0000-4000-8000-000000000101', 'DGI-CPT-A', 'Comptoir DGI A', 'comptoir', true),
  ('50000000-0000-4000-8000-000000000102', 'DGI-CPT-B', 'Comptoir DGI B', 'comptoir', true);

INSERT INTO public.snp_artisans_miniers (
  id, type_artisan, type_personne, actif, nom, prenoms, telephone
) VALUES
  ('50000000-0000-4000-8000-000000000201', 'collecteur', 'physique', true, 'Collecteur', 'DGI Alpha', '+22671000001'),
  ('50000000-0000-4000-8000-000000000202', 'collecteur', 'physique', true, 'Collecteur', 'DGI Beta', '+22671000002'),
  ('50000000-0000-4000-8000-000000000211', 'exploitant', 'physique', true, 'Orpailleur', 'DGI Alpha', '+22671000011'),
  ('50000000-0000-4000-8000-000000000212', 'exploitant', 'physique', true, 'Orpailleur', 'DGI Beta', '+22671000012');

INSERT INTO public.snp_collector_artisan_assignments (
  collector_id, artisan_id, comptoir_organization_id, reason
) VALUES
  ('50000000-0000-4000-8000-000000000201', '50000000-0000-4000-8000-000000000211', '50000000-0000-4000-8000-000000000101', 'Affectation pour le workflow DGI Alpha'),
  ('50000000-0000-4000-8000-000000000202', '50000000-0000-4000-8000-000000000212', '50000000-0000-4000-8000-000000000102', 'Affectation pour le workflow DGI Beta');

INSERT INTO public.snp_user_capabilities (
  user_id, capability_code, allowed, reason
) VALUES
  ('50000000-0000-4000-8000-000000000002', 'comptoir.manage', true, 'Habilitation du préparateur Comptoir A'),
  ('50000000-0000-4000-8000-000000000003', 'comptoir.manage', true, 'Habilitation du validateur Comptoir A'),
  ('50000000-0000-4000-8000-000000000004', 'comptoir.manage', true, 'Habilitation de l’opérateur Comptoir B');

INSERT INTO public.snp_user_organization_memberships (
  user_id, organization_id, membership_role, is_primary, reason
) VALUES
  ('50000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000101', 'operator', true, 'Périmètre du préparateur Comptoir A'),
  ('50000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000101', 'manager', true, 'Périmètre du validateur Comptoir A'),
  ('50000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000102', 'manager', true, 'Périmètre de l’opérateur Comptoir B');

INSERT INTO public.snp_artisan_ventes_or (
  id, artisan_id, comptoir_organization_id, quantite_grammes, type_or,
  purete_karat, prix_kg_fcfa, montant_brut_fcfa, montant_total_fcfa
) VALUES
  ('50000000-0000-4000-8000-000000000301', '50000000-0000-4000-8000-000000000211', '50000000-0000-4000-8000-000000000101', 10, 'poudre', 22, 40000000, 400000, 476000),
  ('50000000-0000-4000-8000-000000000302', '50000000-0000-4000-8000-000000000212', '50000000-0000-4000-8000-000000000102', 10, 'poudre', 22, 40000000, 400000, 476000);

SELECT pg_temp.set_test_claims(
  '50000000-0000-4000-8000-000000000002', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  public.snp_current_organization_id(),
  '50000000-0000-4000-8000-000000000101'::uuid,
  'le préparateur résout le Comptoir A depuis son compte'
);

INSERT INTO public.snp_artisan_factures_definitives (
  id, numero_facture, vente_or_id, artisan_id, montant_brut,
  montant_taxe_tva, montant_taxe_retenue_source, montant_autres_taxes,
  montant_total_taxes, montant_net_a_payer, taux_tva, taux_retenue_source,
  comptoir_organization_id
) VALUES
  ('50000000-0000-4000-8000-000000000321', 'FAC-DGI-A-001', '50000000-0000-4000-8000-000000000301', '50000000-0000-4000-8000-000000000211', 476000, 70000, 5000, 1000, 76000, 400000, 18, 1.5, '50000000-0000-4000-8000-000000000102'),
  ('50000000-0000-4000-8000-000000000322', 'FAC-DGI-A-002', '50000000-0000-4000-8000-000000000301', '50000000-0000-4000-8000-000000000211', 476000, 70000, 5000, 1000, 76000, 400000, 18, 1.5, '50000000-0000-4000-8000-000000000102');

SELECT is(
  (SELECT comptoir_organization_id FROM public.snp_artisan_factures_definitives
   WHERE id = '50000000-0000-4000-8000-000000000321'),
  '50000000-0000-4000-8000-000000000101'::uuid,
  'le périmètre falsifié de la facture est remplacé par le Comptoir A'
);

SELECT is(
  pg_temp.try_duplicate_payment(), '23514',
  'aucun paiement ne peut être créé avant la certification DGI'
);
SELECT is(
  pg_temp.try_certify(
    '50000000-0000-4000-8000-000000000321', 'DGI-2026-0001', 'dgi/2026/fac-a-001.pdf'
  ),
  'ok', 'la facture certifiée ouvre ensuite le droit au paiement'
);

INSERT INTO public.snp_artisan_paiements (
  id, reference_paiement, facture_id, vente_or_id, artisan_id,
  type_paiement, montant_paye, montant_taxes_retenues, statut,
  comptoir_organization_id
) VALUES (
  '50000000-0000-4000-8000-000000000341', 'PAY-DGI-A-001',
  '50000000-0000-4000-8000-000000000321',
  '50000000-0000-4000-8000-000000000301',
  '50000000-0000-4000-8000-000000000211',
  'virement_bancaire', 400000, 0, 'en_attente',
  '50000000-0000-4000-8000-000000000102'
);

SELECT is(
  (SELECT comptoir_organization_id FROM public.snp_artisan_paiements
   WHERE id = '50000000-0000-4000-8000-000000000341'),
  '50000000-0000-4000-8000-000000000101'::uuid,
  'le périmètre falsifié du paiement est remplacé par le Comptoir A'
);
SELECT is(
  (SELECT traite_par FROM public.snp_artisan_paiements
   WHERE id = '50000000-0000-4000-8000-000000000341'),
  '50000000-0000-4000-8000-000000000002'::uuid,
  'le préparateur du paiement est enregistré automatiquement'
);
SELECT is(
  pg_temp.try_duplicate_payment(), '23505',
  'un second paiement actif pour la même facture est refusé'
);
SELECT is(
  pg_temp.try_payment_status('50000000-0000-4000-8000-000000000341', 'en_traitement'),
  'en_traitement', 'le préparateur soumet le paiement au contrôle'
);
SELECT is(
  pg_temp.try_payment_status('50000000-0000-4000-8000-000000000341', 'valide'),
  '42501', 'le préparateur ne valide pas son propre paiement'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '50000000-0000-4000-8000-000000000003', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  pg_temp.try_payment_status('50000000-0000-4000-8000-000000000341', 'valide'),
  'valide', 'un second opérateur du même comptoir valide le paiement'
);
SELECT is(
  (SELECT valide_par FROM public.snp_artisan_paiements
   WHERE id = '50000000-0000-4000-8000-000000000341'),
  '50000000-0000-4000-8000-000000000003'::uuid,
  'le validateur est historisé'
);
SELECT is(
  pg_temp.try_direct_certification('50000000-0000-4000-8000-000000000321'),
  '42501', 'la certification DGI directe est refusée'
);
SELECT is(
  pg_temp.try_certify(
    '50000000-0000-4000-8000-000000000322', 'DGI', 'x'
  ),
  '22023', 'la RPC refuse une preuve DGI incomplète'
);
SELECT is(
  pg_temp.try_certify(
    '50000000-0000-4000-8000-000000000322', 'DGI-2026-0002', 'dgi/2026/fac-a-002.pdf'
  ),
  'ok', 'la RPC certifie une facture complète du bon périmètre'
);
SELECT is(
  (SELECT certification_dgi_status || ':' || dgi_reference
   FROM public.snp_artisan_factures_definitives
   WHERE id = '50000000-0000-4000-8000-000000000322'),
  'certified:DGI-2026-0002', 'la certification et sa référence sont persistées'
);
SELECT is(
  pg_temp.try_direct_certification('50000000-0000-4000-8000-000000000322'),
  '42501', 'le marqueur interne DGI ne fuit pas après le retour de la RPC'
);
SELECT is(
  pg_temp.try_mutate_certified_invoice('50000000-0000-4000-8000-000000000322'),
  '42501', 'une facture certifiée ne peut plus être altérée'
);
SELECT is(
  pg_temp.try_payment_status('50000000-0000-4000-8000-000000000341', 'complete'),
  '23514', 'la clôture refuse un paiement sans preuve bancaire'
);
SELECT is(
  pg_temp.try_payment_status(
    '50000000-0000-4000-8000-000000000341', 'complete', 'proofs/pay-a-001.pdf'
  ),
  'complete', 'le paiement certifié et justifié peut être clôturé'
);
SELECT ok(
  (SELECT statut = 'complete' AND date_completion IS NOT NULL
   FROM public.snp_artisan_paiements
   WHERE id = '50000000-0000-4000-8000-000000000341'),
  'la clôture et sa date sont enregistrées'
);
SELECT is(
  public.snp_comptoir_stock_balance('50000000-0000-4000-8000-000000000101'),
  10::numeric, 'le stock entre seulement après paiement certifié et justifié'
);
SELECT is(
  (SELECT count(*) FROM public.snp_artisan_taxes_retenues
   WHERE paiement_id = '50000000-0000-4000-8000-000000000341'
     AND statut_reversement = 'a_reverser'),
  3::bigint, 'les trois lignes fiscales sont collectées pour reversement'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '50000000-0000-4000-8000-000000000001', 'service_role', 'aal2'
);
SELECT is(
  (SELECT count(*) FROM public.snp_workflow_audit
   WHERE aggregate_type = 'artisan-payment'
     AND aggregate_id = '50000000-0000-4000-8000-000000000341'),
  3::bigint, 'les trois transitions du paiement sont auditées'
);
SELECT is(
  (SELECT count(*) FROM public.snp_workflow_audit
   WHERE aggregate_type = 'artisan-invoice'
     AND aggregate_id = '50000000-0000-4000-8000-000000000322'),
  1::bigint, 'la certification DGI est auditée'
);
SELECT is(
  (SELECT count(*) FROM public.snp_workflow_notification_outbox
   WHERE aggregate_id IN (
     '50000000-0000-4000-8000-000000000321',
     '50000000-0000-4000-8000-000000000322',
     '50000000-0000-4000-8000-000000000341'
   )),
  5::bigint, 'les décisions génèrent cinq notifications idempotentes'
);

SELECT pg_temp.set_test_claims(
  '50000000-0000-4000-8000-000000000004', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.snp_artisan_factures_definitives
   WHERE id = '50000000-0000-4000-8000-000000000321'),
  0::bigint, 'le Comptoir B ne voit pas la facture du Comptoir A'
);
SELECT is(
  (SELECT count(*) FROM public.snp_artisan_paiements
   WHERE id = '50000000-0000-4000-8000-000000000341'),
  0::bigint, 'le Comptoir B ne voit pas le paiement du Comptoir A'
);
SELECT is(
  pg_temp.try_payment_status('50000000-0000-4000-8000-000000000341', 'annule'),
  'no-row', 'le Comptoir B ne modifie pas le paiement du Comptoir A'
);

RESET ROLE;
SELECT * FROM finish();

ROLLBACK;
