-- Read-only inventory. No personal data, no credentials, no business mutation.
SELECT 'tables' AS section, jsonb_agg(jsonb_build_object(
  'table', relname, 'estimated_rows', n_live_tup
) ORDER BY relname) AS data FROM pg_stat_user_tables WHERE schemaname='public'
UNION ALL
SELECT 'workflow_functions', jsonb_agg(jsonb_build_object(
  'name', p.proname, 'arguments', pg_get_function_identity_arguments(p.oid),
  'definition_md5', md5(pg_get_functiondef(p.oid))
) ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
  'snp_conciliation_ouvrir','snp_conciliation_enregistrer_analyse','snp_conciliation_valider',
  'snp_conciliation_impacts_fiscaux','snp_save_reserve_allocation','snp_transition_reserve_allocation',
  'snp_creer_vente_export','snp_creer_achat_mine','snp_valider_achat_mine'
)
UNION ALL
SELECT 'actors_by_role', jsonb_agg(to_jsonb(x)) FROM (
  SELECT role,is_active,count(*) AS count FROM public.user_profiles GROUP BY role,is_active
) x;
