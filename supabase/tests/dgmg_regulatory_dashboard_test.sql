-- À exécuter exclusivement dans une copie locale isolée après les migrations.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT plan(8);

SELECT has_function(
  'public', 'snp_dgmg_has_active_supervision_scope', ARRAY[]::text[],
  'le garde-fou de rattachement DGMG existe'
);
SELECT has_function(
  'public', 'snp_dgmg_charger_tableau_reglementaire',
  ARRAY['date','date','text','uuid','text','text'],
  'la projection agrégée du tableau DGMG existe'
);
SELECT function_returns(
  'public', 'snp_dgmg_charger_tableau_reglementaire',
  ARRAY['date','date','text','uuid','text','text'], 'jsonb',
  'la projection retourne un contrat JSON borné'
);
SELECT ok(
  (SELECT procedure.prosecdef FROM pg_catalog.pg_proc procedure
   WHERE procedure.oid =
     'public.snp_dgmg_charger_tableau_reglementaire(date,date,text,uuid,text,text)'::regprocedure),
  'la fonction agrège les données derrière un garde-fou SECURITY DEFINER'
);
SELECT ok(
  NOT has_function_privilege('anon',
    'public.snp_dgmg_charger_tableau_reglementaire(date,date,text,uuid,text,text)', 'EXECUTE'),
  'le rôle anonyme ne peut pas exécuter la projection'
);
SELECT ok(
  has_function_privilege('authenticated',
    'public.snp_dgmg_charger_tableau_reglementaire(date,date,text,uuid,text,text)', 'EXECUTE'),
  'un compte authentifié peut atteindre le garde-fou DGMG'
);
SELECT ok(
  NOT has_function_privilege('authenticated',
    'public.snp_dgmg_has_active_supervision_scope()', 'EXECUTE'),
  'le helper de rattachement reste interne'
);
SELECT is(
  (SELECT purpose FROM public.snp_rpc_execution_allowlist
   WHERE function_signature =
     'public.snp_dgmg_charger_tableau_reglementaire(date,date,text,uuid,text,text)'::regprocedure::text
     AND grantee = 'authenticated'),
  'runtime-browser',
  'la projection est explicitement répertoriée pour le navigateur'
);

SELECT * FROM finish();
ROLLBACK;
