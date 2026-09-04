-- À exécuter exclusivement dans une copie locale isolée après les migrations.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT plan(6);

SELECT has_function(
  'public', 'snp_dgi_charger_tableau_collecte', ARRAY['date','date'],
  'la projection agrégée du tableau DGI existe'
);
SELECT function_returns(
  'public', 'snp_dgi_charger_tableau_collecte', ARRAY['date','date'], 'jsonb',
  'la projection retourne un contrat JSON borné'
);
SELECT ok(
  (SELECT procedure.prosecdef
   FROM pg_catalog.pg_proc procedure
   WHERE procedure.oid =
     'public.snp_dgi_charger_tableau_collecte(date,date)'::regprocedure),
  'la fonction agrège les données derrière un garde-fou SECURITY DEFINER'
);
SELECT ok(
  NOT has_function_privilege('anon',
    'public.snp_dgi_charger_tableau_collecte(date,date)', 'EXECUTE'),
  'le rôle anonyme ne peut pas exécuter la projection'
);
SELECT ok(
  has_function_privilege('authenticated',
    'public.snp_dgi_charger_tableau_collecte(date,date)', 'EXECUTE'),
  'un compte authentifié peut atteindre le garde-fou DGI'
);
SELECT is(
  (SELECT purpose FROM public.snp_rpc_execution_allowlist
   WHERE function_signature =
     'public.snp_dgi_charger_tableau_collecte(date,date)'::regprocedure::text
     AND grantee = 'authenticated'),
  'runtime-browser',
  'la fonction est explicitement répertoriée pour le navigateur'
);

SELECT * FROM finish();
ROLLBACK;
