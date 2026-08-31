BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

-- Référentiels minimaux reproductibles : le test doit aussi fonctionner sur
-- une copie de schéma seule, sans dépendre d'organisations réelles préexistantes.
INSERT INTO public.snp_capability_catalog(code,domain,label,description,sensitive)
VALUES ('dgi.fiscal.control','dgi','Contrôle fiscal','Responsabilité institutionnelle',true),
       ('dgmg.supervise','dgmg','Supervision','Responsabilité institutionnelle',true)
ON CONFLICT(code) DO NOTHING;
INSERT INTO public.snp_responsibility_catalog(code,capability_code,label,description)
VALUES ('dgi.fiscal.control','dgi.fiscal.control','Contrôle fiscal','Responsabilité institutionnelle'),
       ('dgmg.supervise','dgmg.supervise','Supervision','Responsabilité institutionnelle')
ON CONFLICT(code) DO NOTHING;
INSERT INTO public.snp_access_role_policies(role,portal_code,organization_type,organization_required,can_administer_accounts)
VALUES ('dgi','dgi','dgi',true,false),('dgmg','dgmg','dgmg',true,false)
ON CONFLICT(role) DO NOTHING;
INSERT INTO public.snp_role_responsibility_ceiling(role,responsibility_code,required)
VALUES ('dgi','dgi.fiscal.control',true),('dgmg','dgmg.supervise',true)
ON CONFLICT DO NOTHING;
INSERT INTO public.snp_ministries(id,code,name)
VALUES ('73000000-0000-4000-8000-000000000900','INSTITUTION-TEST','Tutelle synthétique de test')
ON CONFLICT DO NOTHING;
INSERT INTO public.snp_organizations(id,code,name,organization_type,supervising_ministry_id)
VALUES ('73000000-0000-4000-8000-000000000901','DGI','DGI de test','dgi','73000000-0000-4000-8000-000000000900'),
       ('73000000-0000-4000-8000-000000000902','DGMG','DGMG de test','dgmg','73000000-0000-4000-8000-000000000900')
ON CONFLICT DO NOTHING;
INSERT INTO public.modules(id,name,display_name,access_domain,is_active)
VALUES ('73000000-0000-4000-8000-000000000903','national_reserve','Réserve nationale','inventory',true)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION pg_temp.set_institutional_claims(
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
    jsonb_build_object(
      'sub', p_sub,
      'role', p_role,
      'aal', p_aal,
      'session_id', 'institution-' || replace(p_sub::text, '-', ''),
      'exp', floor(extract(epoch FROM now() + interval '1 hour'))::bigint
    )::text,
    true
  );
END;
$fn$;
GRANT EXECUTE ON FUNCTION pg_temp.set_institutional_claims(uuid, text, text) TO PUBLIC;

SELECT plan(25);

SELECT has_function('public', 'snp_dgi_has_active_fiscal_scope', ARRAY[]::text[],
  'le périmètre fiscal DGI est explicite');
SELECT has_function('public', 'snp_4i_can_read_payment_scope', ARRAY['uuid','uuid'],
  'les paiements bruts utilisent un périmètre distinct');
SELECT has_function('public', 'snp_dgi_lister_paiements_fiscaux', ARRAY['uuid','integer','integer'],
  'la projection fiscale DGI existe');
SELECT has_function('public', 'snp_dgmg_can_validate_reserve_level_1', ARRAY[]::text[],
  'le périmètre de validation DGMG est explicite');
SELECT has_function('public', 'snp_dgmg_lister_validations_reserve_level_1', ARRAY['integer','integer'],
  'la file DGMG minimale existe');
SELECT has_function('public', 'snp_dgmg_transition_reserve_level_1', ARRAY['uuid','text','text'],
  'la transition DGMG dédiée existe');

SELECT ok(
  (SELECT pg_get_expr(policy.polqual, policy.polrelid)
   FROM pg_policy policy
   WHERE policy.polrelid='public.snp_artisan_paiements'::regclass
     AND policy.polname='snp_4i_payments_select') LIKE '%snp_4i_can_read_payment_scope%',
  'la policy brute des paiements utilise le périmètre sans DGI'
);
SELECT ok(
  (SELECT pg_get_expr(policy.polqual, policy.polrelid)
   FROM pg_policy policy
   WHERE policy.polrelid='public.snp_artisan_paiements'::regclass
     AND policy.polname='snp_4i_payments_select') NOT LIKE '%snp_4i_can_read_finance_scope%',
  'la policy brute ne réutilise pas le périmètre fiscal élargi'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc procedure,
         unnest(coalesce(procedure.proargnames, ARRAY[]::text[])) argument_name
    WHERE procedure.oid='public.snp_dgi_lister_paiements_fiscaux(uuid,integer,integer)'::regprocedure
      AND argument_name = ANY(ARRAY[
        'details_paiement','preuve_paiement_url','recu_paiement_url','notes',
        'type_paiement','traite_par','valide_par','completed_by','cancelled_by','failed_by'
      ])
  ),
  'la projection DGI exclut preuves, notes, moyen et acteurs du paiement'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc procedure,
         unnest(coalesce(procedure.proargnames, ARRAY[]::text[])) argument_name
    WHERE procedure.oid='public.snp_dgmg_lister_validations_reserve_level_1(integer,integer)'::regprocedure
      AND argument_name = ANY(ARRAY[
        'indicative_value_fcfa','indicative_value_usd','indicative_value_eur',
        'gold_price_fcfa_gram','control_results','storage_path','event_type'
      ])
  ),
  'la file DGMG exclut valorisation, contrôles détaillés, documents et audit'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.snp_dgi_lister_paiements_fiscaux(uuid,integer,integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.snp_dgi_lister_paiements_fiscaux(uuid,integer,integer)', 'EXECUTE'),
  'la RPC fiscale est réservée aux sessions authentifiées'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.snp_dgmg_transition_reserve_level_1(uuid,text,text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.snp_dgmg_transition_reserve_level_1(uuid,text,text)', 'EXECUTE'),
  'la transition DGMG est réservée aux sessions authentifiées'
);
SELECT ok(
  EXISTS(SELECT 1 FROM public.snp_role_capabilities
         WHERE role='dgmg' AND capability_code='reserve.allocations.validate_level_1'),
  'la DGMG possède la capability niveau 1'
);
SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.snp_role_capabilities
             WHERE role='dgmg' AND capability_code IN ('reserve.allocations.view','reserve.allocations.export')),
  'la DGMG ne reçoit ni lecture patrimoniale ni export Réserve'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('73000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dgi-valid@institution.invalid','','{}','{}',now(),now()),
  ('73000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dgi-cross@institution.invalid','','{}','{}',now(),now()),
  ('73000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dgmg-valid@institution.invalid','','{}','{}',now(),now()),
  ('73000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dgmg-cross@institution.invalid','','{}','{}',now(),now());

INSERT INTO public.user_profiles(id,email,full_name,role,is_active,mining_company_id,mfa_enrolled_at)
VALUES
  ('73000000-0000-4000-8000-000000000001','dgi-valid@institution.invalid','DGI valide','dgi',true,NULL,now()),
  ('73000000-0000-4000-8000-000000000002','dgi-cross@institution.invalid','DGI croisée','dgi',true,NULL,now()),
  ('73000000-0000-4000-8000-000000000003','dgmg-valid@institution.invalid','DGMG valide','dgmg',true,NULL,now()),
  ('73000000-0000-4000-8000-000000000004','dgmg-cross@institution.invalid','DGMG croisée','dgmg',true,NULL,now());

INSERT INTO public.user_sessions(user_id,token_hash,expires_at,is_active)
SELECT profile.id,
  extensions.digest('institution-' || replace(profile.id::text,'-',''),'sha256'),
  now()+interval '1 hour', true
FROM public.user_profiles profile
WHERE profile.id::text LIKE '73000000-0000-4000-8000-00000000000_';

INSERT INTO public.snp_user_organization_memberships(
  user_id, organization_id, membership_role, is_primary, reason
)
SELECT fixture.user_id, organization.id, 'viewer', true, 'Test institutionnel automatisé'
FROM (VALUES
  ('73000000-0000-4000-8000-000000000001'::uuid, 'DGI'),
  ('73000000-0000-4000-8000-000000000002'::uuid, 'DGMG'),
  ('73000000-0000-4000-8000-000000000003'::uuid, 'DGMG'),
  ('73000000-0000-4000-8000-000000000004'::uuid, 'DGI')
) fixture(user_id, organization_code)
JOIN public.snp_organizations organization ON organization.code=fixture.organization_code;

INSERT INTO public.snp_user_responsibilities(user_id,responsibility_code,reason)
VALUES
  ('73000000-0000-4000-8000-000000000001','dgi.fiscal.control','Contrôle fiscal de test'),
  ('73000000-0000-4000-8000-000000000002','dgi.fiscal.control','Contrôle fiscal de test'),
  ('73000000-0000-4000-8000-000000000003','dgmg.supervise','Supervision DGMG de test'),
  ('73000000-0000-4000-8000-000000000004','dgmg.supervise','Supervision DGMG de test');

INSERT INTO public.user_permissions(
  user_id,module_id,can_view,can_create,can_edit,can_delete,can_approve,
  can_read,can_write,field_permissions
)
SELECT fixture.user_id,module.id,true,false,false,false,false,true,false,'{}'::jsonb
FROM (VALUES
  ('73000000-0000-4000-8000-000000000003'::uuid),
  ('73000000-0000-4000-8000-000000000004'::uuid)
) fixture(user_id)
CROSS JOIN public.modules module
WHERE module.name='national_reserve';

SELECT pg_temp.set_institutional_claims('73000000-0000-4000-8000-000000000001','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT ok(public.snp_dgi_has_active_fiscal_scope(), 'le compte DGI correctement rattaché ouvre la lecture fiscale');
SELECT ok(public.snp_4i_can_read_finance_scope(NULL,NULL), 'la DGI lit le périmètre financier fiscal');
SELECT ok(NOT public.snp_4i_can_read_payment_scope(NULL,NULL), 'la DGI ne lit pas les paiements bruts');
RESET ROLE;

SELECT pg_temp.set_institutional_claims('73000000-0000-4000-8000-000000000002','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT ok(NOT public.snp_dgi_has_active_fiscal_scope(), 'un rôle DGI rattaché à la DGMG échoue fermé');
RESET ROLE;

SELECT pg_temp.set_institutional_claims('73000000-0000-4000-8000-000000000003','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT ok(public.snp_dgmg_can_validate_reserve_level_1(), 'le validateur DGMG avec module attribué ouvre la file niveau 1');
SELECT ok(NOT public.snp_dgi_has_active_fiscal_scope(), 'la DGMG ne traverse pas vers le périmètre fiscal DGI');
SELECT throws_ok(
  $$SELECT public.snp_transition_reserve_allocation(
    '73000000-0000-4000-8000-000000000099'::uuid,
    'UNDER_REVIEW',
    NULL
  )$$,
  '42501',
  'Utilisez la file DGMG dédiée à la validation de niveau 1.',
  'la RPC générique refuse la DGMG avant même de révéler si le dossier existe'
);
RESET ROLE;

SELECT pg_temp.set_institutional_claims('73000000-0000-4000-8000-000000000004','authenticated','aal2');
SET LOCAL ROLE authenticated;
SELECT ok(NOT public.snp_dgmg_can_validate_reserve_level_1(), 'un rôle DGMG rattaché à la DGI échoue fermé');
RESET ROLE;

SELECT pg_temp.set_institutional_claims('73000000-0000-4000-8000-000000000003','authenticated','aal1');
SET LOCAL ROLE authenticated;
SELECT ok(NOT public.snp_dgmg_can_validate_reserve_level_1(), 'la validation sensible DGMG exige AAL2');
RESET ROLE;

SELECT ok(
  pg_get_functiondef('public.snp_dgmg_transition_reserve_level_1(uuid,text,text)'::regprocedure)
    LIKE '%v_created_by = auth.uid()%',
  'la RPC DGMG interdit explicitement l’auto-approbation'
);
SELECT ok(
  pg_get_functiondef('public.snp_dgmg_transition_reserve_level_1(uuid,text,text)'::regprocedure)
    LIKE '%SUBMITTED%UNDER_REVIEW%REJECTED%UNDER_REVIEW%VALIDATED_LEVEL_1%REJECTED%',
  'la RPC DGMG est limitée aux transitions du niveau 1'
);

SELECT * FROM finish();
ROLLBACK;
