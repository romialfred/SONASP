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

CREATE OR REPLACE FUNCTION pg_temp.try_status(
  p_reglement_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
  PERFORM public.snp_changer_statut_reglement(
    p_reglement_id, p_status, p_reason
  );
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$fn$;

SELECT plan(17);

SELECT pg_temp.set_test_claims(
  '31000000-0000-4000-8000-000000000099', 'service_role', 'aal2'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('31000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'preparer-sod-test@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('31000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'approver-sod-test@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('31000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'executor-sod-test@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('31000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reconciler-sod-test@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('31000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-sod-test@sonasp.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.user_profiles (
  id, email, full_name, role, is_active, mining_company_id, mfa_enrolled_at
) VALUES
  ('31000000-0000-4000-8000-000000000001', 'preparer-sod-test@sonasp.invalid', 'Préparateur', 'management', true, NULL, now()),
  ('31000000-0000-4000-8000-000000000002', 'approver-sod-test@sonasp.invalid', 'Approbateur', 'management', true, NULL, now()),
  ('31000000-0000-4000-8000-000000000003', 'executor-sod-test@sonasp.invalid', 'Finances exécution', 'management', true, NULL, now()),
  ('31000000-0000-4000-8000-000000000004', 'reconciler-sod-test@sonasp.invalid', 'Finances rapprochement', 'management', true, NULL, now()),
  ('31000000-0000-4000-8000-000000000005', 'admin-sod-test@sonasp.invalid', 'Administrateur technique', 'admin', true, NULL, now());

INSERT INTO public.mining_companies (
  id, code, name, country, company_type, is_active
) VALUES (
  '31000000-0000-4000-8000-000000000201',
  'SOD-TST',
  'Mine de test séparation des fonctions',
  'Burkina Faso',
  'production_mine',
  true
);

INSERT INTO public.snp_reglements_achat (
  id, reference_reglement, mining_company_id, montant_fcfa, statut, prepare_par
) VALUES
  ('31000000-0000-4000-8000-000000000101', 'REG-SOD-TEST-001', '31000000-0000-4000-8000-000000000201', 1000000, 'brouillon', '31000000-0000-4000-8000-000000000001'),
  ('31000000-0000-4000-8000-000000000102', 'REG-SOD-TEST-002', '31000000-0000-4000-8000-000000000201', 1000000, 'brouillon', '31000000-0000-4000-8000-000000000005');

SELECT pg_temp.set_test_claims(
  '31000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  pg_temp.try_status('31000000-0000-4000-8000-000000000101', 'soumis'),
  'ok',
  'le préparateur soumet son règlement'
);
SELECT is(
  pg_temp.try_status('31000000-0000-4000-8000-000000000101', 'valide'),
  '42501',
  'le préparateur ne valide jamais son propre règlement'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '31000000-0000-4000-8000-000000000002', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  pg_temp.try_status('31000000-0000-4000-8000-000000000101', 'valide'),
  'ok',
  'un autre acteur approuve le règlement'
);
SELECT is(
  pg_temp.try_status('31000000-0000-4000-8000-000000000101', 'en_execution'),
  '42501',
  'l’approbateur ne prend pas en charge l’exécution'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '31000000-0000-4000-8000-000000000003', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  pg_temp.try_status('31000000-0000-4000-8000-000000000101', 'en_execution'),
  'ok',
  'Finances prend en charge l’exécution'
);
SELECT is(
  pg_temp.try_status('31000000-0000-4000-8000-000000000101', 'execute'),
  '23514',
  'aucune exécution n’est confirmée sans preuve bancaire'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '31000000-0000-4000-8000-000000000099', 'service_role', 'aal2'
);
INSERT INTO public.snp_reglements_preuves (
  reglement_id, type_document, fichier_url, nom_origine,
  type_mime, taille_octets, statut_verification
) VALUES (
  '31000000-0000-4000-8000-000000000101',
  'confirmation_virement',
  'https://sonasp.invalid/preuves/reg-sod-test-001.pdf',
  'reg-sod-test-001.pdf',
  'application/pdf',
  1024,
  'verifiee'
);

SELECT pg_temp.set_test_claims(
  '31000000-0000-4000-8000-000000000003', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  pg_temp.try_status('31000000-0000-4000-8000-000000000101', 'execute'),
  'ok',
  'Finances confirme l’exécution après ajout de la preuve'
);
SELECT is(
  pg_temp.try_status('31000000-0000-4000-8000-000000000101', 'rapproche'),
  '42501',
  'l’exécutant ne rapproche pas son propre paiement'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '31000000-0000-4000-8000-000000000004', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  pg_temp.try_status('31000000-0000-4000-8000-000000000101', 'rapproche'),
  'ok',
  'un autre acteur Finances rapproche le paiement'
);
SELECT is(
  (SELECT statut FROM public.snp_reglements_achat
   WHERE id = '31000000-0000-4000-8000-000000000101'),
  'rapproche',
  'le cycle se termine dans le statut rapproché'
);
SELECT is(
  (SELECT soumis_par FROM public.snp_reglements_achat
   WHERE id = '31000000-0000-4000-8000-000000000101'),
  '31000000-0000-4000-8000-000000000001'::uuid,
  'le préparateur est historisé'
);
SELECT is(
  (SELECT valide_par FROM public.snp_reglements_achat
   WHERE id = '31000000-0000-4000-8000-000000000101'),
  '31000000-0000-4000-8000-000000000002'::uuid,
  'l’approbateur est historisé'
);
SELECT is(
  (SELECT execute_par FROM public.snp_reglements_achat
   WHERE id = '31000000-0000-4000-8000-000000000101'),
  '31000000-0000-4000-8000-000000000003'::uuid,
  'l’exécutant est historisé'
);
SELECT is(
  (SELECT rapproche_par FROM public.snp_reglements_achat
   WHERE id = '31000000-0000-4000-8000-000000000101'),
  '31000000-0000-4000-8000-000000000004'::uuid,
  'le responsable du rapprochement est historisé'
);
SELECT is(
  (SELECT count(*) FROM public.snp_workflow_audit
   WHERE aggregate_type = 'reglement-achat'
     AND aggregate_id = '31000000-0000-4000-8000-000000000101'),
  5::bigint,
  'les cinq transitions réussies sont auditées'
);
SELECT is(
  (SELECT count(*) FROM public.snp_workflow_notification_outbox
   WHERE aggregate_type = 'reglement-achat'
     AND aggregate_id = '31000000-0000-4000-8000-000000000101'),
  5::bigint,
  'les cinq notifications sont placées dans l’outbox'
);

RESET ROLE;
SELECT pg_temp.set_test_claims(
  '31000000-0000-4000-8000-000000000005', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  pg_temp.try_status('31000000-0000-4000-8000-000000000102', 'soumis'),
  '42501',
  'Admin ne se substitue pas au Gestionnaire métier'
);

RESET ROLE;
SELECT * FROM finish();

ROLLBACK;
