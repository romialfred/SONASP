BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;

SELECT plan(25);

SELECT has_table('public', 'snp_access_role_policies', 'le référentiel des rôles institutionnels existe');
SELECT has_table('public', 'snp_responsibility_catalog', 'le catalogue des responsabilités existe');
SELECT has_table('public', 'snp_role_responsibility_ceiling', 'le plafond rôle-responsabilité existe');
SELECT has_table('public', 'snp_role_module_ceilings', 'le plafond rôle-module-action existe');
SELECT has_table('public', 'snp_user_responsibilities', 'les responsabilités attribuées sont persistées séparément');
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.snp_role_module_ceilings'::regclass),
  'les plafonds rôle-module sont protégés par RLS'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.snp_access_migration_review'::regclass),
  'la revue de migration est protégée par RLS'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.snp_sod_legacy_review'::regclass),
  'la revue SoD est protégée par RLS'
);

SELECT is(
  (SELECT count(*) FROM public.snp_access_role_policies WHERE NOT is_legacy),
  9::bigint,
  'la matrice contient les huit rôles partenaires et Owner'
);
SELECT is(
  (SELECT array_agg(role ORDER BY role) FROM public.snp_access_role_policies WHERE NOT is_legacy),
  ARRAY['admin','collector','comptoir','customer','dgi','dgmg','management','mine','owner']::text[],
  'les neuf rôles cibles sont présents sans rôle implicite'
);
SELECT is(
  (SELECT portal_code FROM public.snp_access_role_policies WHERE role='dgmg'),
  'dgmg',
  'DGMG possède son portail distinct'
);
SELECT is(
  (SELECT portal_code FROM public.snp_access_role_policies WHERE role='dgi'),
  'dgi',
  'DGI possède son portail distinct'
);
SELECT is(
  (SELECT organization_type FROM public.snp_access_role_policies WHERE role='collector'),
  'comptoir',
  'un Collecteur est borné au périmètre de son comptoir'
);

SELECT is(
  (SELECT count(*) FROM public.snp_responsibility_conflicts),
  3::bigint,
  'les conflits SONASP et Finance Comptoir sont déclarés'
);
SELECT is(
  (SELECT count(*) FROM public.snp_role_responsibility_ceiling WHERE required),
  5::bigint,
  'les responsabilités structurelles des cinq rôles partenaires sont obligatoires'
);
SELECT ok(
  (SELECT count(*)=18 AND bool_and(can_view AND can_create AND can_edit AND can_delete AND can_approve)
   FROM public.snp_role_module_ceilings WHERE role='admin'),
  'le plafond Administrateur permet à Owner de configurer les dix-huit domaines'
);
SELECT ok(
  (SELECT count(*)=18 AND bool_and(can_view AND can_create AND can_edit AND can_delete AND can_approve)
   FROM public.snp_role_module_ceilings WHERE role='owner'),
  'Owner dispose de toutes les actions sur les dix-huit domaines fonctionnels'
);
SELECT ok(
  NOT EXISTS(
    SELECT 1 FROM public.modules
    WHERE coalesce(is_active,true) AND coalesce(access_domain,'unknown')='unknown'
  ),
  'tout module actif possède un domaine stable reconnu'
);
SELECT ok(
  EXISTS(
    SELECT 1 FROM public.snp_role_module_ceilings
    WHERE role='comptoir' AND access_domain='tax'
      AND can_view AND can_create AND can_edit
  ),
  'le Comptoir peut traiter la fiscalité dans son périmètre'
);
SELECT ok(
  EXISTS(
    SELECT 1 FROM public.snp_role_module_ceilings
    WHERE role='dgi' AND access_domain='payments' AND can_view AND can_approve
  ),
  'la DGI peut rapprocher les paiements lorsqu’elle porte la responsabilité dédiée'
);

SELECT throws_ok(
  $$SELECT public.snp_validate_responsibilities(
    'management',
    '{"sonasp.prepare":true,"sonasp.approve":true}'::jsonb
  )$$,
  '42501',
  'Séparation des fonctions : responsabilités incompatibles.',
  'préparer et approuver sont incompatibles'
);
SELECT throws_ok(
  $$SELECT public.snp_validate_responsibilities(
    'management',
    '{"sonasp.finance.execute":true,"sonasp.finance.reconcile":true}'::jsonb
  )$$,
  '42501',
  'Séparation des fonctions : responsabilités incompatibles.',
  'exécuter et rapprocher sont incompatibles'
);
SELECT throws_ok(
  $$SELECT public.snp_validate_responsibilities('dgi', '{}'::jsonb)$$,
  '22023',
  'Une responsabilité obligatoire est absente.',
  'un compte DGI sans contrôle fiscal est refusé'
);
SELECT lives_ok(
  $$SELECT public.snp_validate_responsibilities(
    'dgi',
    '{"dgi.fiscal.control":true,"dgi.fiscal.reconcile":false}'::jsonb
  )$$,
  'le socle obligatoire DGI est accepté'
);
SELECT has_function(
  'public',
  'snp_user_permission_allowed',
  ARRAY['uuid','uuid','text'],
  'le contrôle serveur combine rôle, responsabilité, module et action'
);

SELECT * FROM finish();

ROLLBACK;
