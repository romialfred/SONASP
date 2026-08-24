BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION pg_temp.set_test_claims(
  p_sub uuid,
  p_role text,
  p_aal text
)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_sub::text, true);
  PERFORM set_config('request.jwt.claim.role', p_role, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_sub, 'role', p_role, 'aal', p_aal)::text,
    true
  );
END;
$function$;

CREATE OR REPLACE FUNCTION pg_temp.try_respond_requisition(p_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM public.snp_portail_mine_repondre_requisition(
    p_id, 'approuver', 'Accord après contrôle du dossier'
  );
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$function$;

SELECT plan(7);

SELECT pg_temp.set_test_claims(
  '25000000-0000-4000-8000-000000000010', 'service_role', 'aal2'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '25000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'relations-mine-a@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '25000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'relations-mine-b@sonasp.invalid', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

INSERT INTO public.mining_companies (id, code, name, country, company_type, is_active)
VALUES
  ('25000000-0000-4000-8000-000000000101', 'REL-A', 'Mine A relations', 'Burkina Faso', 'production_mine', true),
  ('25000000-0000-4000-8000-000000000102', 'REL-B', 'Mine B relations', 'Burkina Faso', 'production_mine', true);

INSERT INTO public.user_profiles (
  id, email, full_name, role, is_active, mining_company_id, mfa_enrolled_at
) VALUES
  ('25000000-0000-4000-8000-000000000001', 'relations-mine-a@sonasp.invalid', 'Compte Mine A', 'mine', true, '25000000-0000-4000-8000-000000000101', now()),
  ('25000000-0000-4000-8000-000000000002', 'relations-mine-b@sonasp.invalid', 'Compte Mine B', 'mine', true, '25000000-0000-4000-8000-000000000102', now());

INSERT INTO public.snp_requisitions (
  id, reference, objet, mining_company_id, regime_juridique, autorite_origine,
  nature_acte, reference_acte, type_requisition, quantite_oz, statut, date_notification
) VALUES
  (
    '25000000-0000-4000-8000-000000000201', 'REQ-REL-A', 'Mise à disposition A',
    '25000000-0000-4000-8000-000000000101', 'accord_requis', 'Direction SONASP',
    'Décision', 'DEC-REL-A', 'partielle', 100, 'notifiee', now()
  ),
  (
    '25000000-0000-4000-8000-000000000202', 'REQ-REL-B', 'Mise à disposition B',
    '25000000-0000-4000-8000-000000000102', 'accord_requis', 'Direction SONASP',
    'Décision', 'DEC-REL-B', 'partielle', 100, 'notifiee', now()
  );

SELECT pg_temp.set_test_claims(
  '25000000-0000-4000-8000-000000000001', 'authenticated', 'aal2'
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.snp_requisitions),
  1::bigint,
  'une mine ne lit que ses réquisitions notifiées'
);

SELECT is(
  (public.snp_portail_mine_repondre_requisition(
    '25000000-0000-4000-8000-000000000201',
    'approuver',
    'Accord après contrôle du dossier'
  )).statut,
  'accusee',
  'la réponse positive accuse réception de la réquisition'
);

SELECT is(
  (SELECT accord_mine FROM public.snp_requisitions
   WHERE id = '25000000-0000-4000-8000-000000000201'),
  true,
  'le régime soumis à accord conserve explicitement l approbation de la mine'
);

SELECT is(
  (SELECT observations_mine FROM public.snp_requisitions
   WHERE id = '25000000-0000-4000-8000-000000000201'),
  'Accord après contrôle du dossier',
  'le commentaire de la mine est conservé'
);

SELECT is(
  pg_temp.try_respond_requisition('25000000-0000-4000-8000-000000000202'),
  '42501',
  'une mine ne peut pas répondre à la réquisition d une autre société'
);

INSERT INTO public.snp_contrats (
  numero_contrat, intitule, partenaire_type, mining_company_id,
  date_debut, date_fin, statut, created_by
) VALUES (
  'CTR-PROP-REL-A', 'Proposition Mine A', 'mine_industrielle',
  '25000000-0000-4000-8000-000000000102', current_date, current_date + 365,
  'actif', '25000000-0000-4000-8000-000000000002'
);

SELECT is(
  (SELECT mining_company_id FROM public.snp_contrats WHERE numero_contrat = 'CTR-PROP-REL-A'),
  '25000000-0000-4000-8000-000000000101'::uuid,
  'la base rattache la proposition à la société authentifiée'
);

SELECT results_eq(
  $$ SELECT statut, created_by
     FROM public.snp_contrats WHERE numero_contrat = 'CTR-PROP-REL-A' $$,
  $$ VALUES ('soumis'::text, '25000000-0000-4000-8000-000000000001'::uuid) $$,
  'la proposition est soumise au nom du compte authentifié'
);

RESET ROLE;
SELECT * FROM finish();

ROLLBACK;
