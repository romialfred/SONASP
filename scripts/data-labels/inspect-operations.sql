BEGIN READ ONLY;
SELECT 'generators_and_guards' AS section, jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid))) AS data
FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f'
AND p.proname IN (
  SELECT DISTINCT p.proname FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
  WHERE NOT t.tgisinternal AND t.tgrelid IN ('public.snp_factures_achat'::regclass,'public.snp_reglements_achat'::regclass,
    'public.snp_regles_fiscales'::regclass,'public.snp_conciliations'::regclass,'public.stakeholder_bank_accounts'::regclass)
)
UNION ALL
SELECT 'columns',jsonb_agg(to_jsonb(c)) FROM (
  SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public'
  AND table_name IN ('snp_factures_achat','snp_reglements_achat','snp_conciliations','expedition_lot_counters')
) c
UNION ALL
SELECT 'trigger_definitions',jsonb_agg(jsonb_build_object('table',tgrelid::regclass::text,'definition',pg_get_triggerdef(oid)))
FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN ('public.snp_factures_achat'::regclass,'public.snp_reglements_achat'::regclass,
    'public.snp_regles_fiscales'::regclass,'public.snp_conciliations'::regclass,'public.stakeholder_bank_accounts'::regclass)
UNION ALL
SELECT 'reference_values',jsonb_agg(q) FROM (
  SELECT 'snp_factures_achat' AS table_name,id,numero_facture AS reference,to_jsonb(f)->>'date_facture' AS date FROM public.snp_factures_achat f
  UNION ALL SELECT 'snp_reglements_achat',id,reference_reglement,to_jsonb(r)->>'date_paiement' FROM public.snp_reglements_achat r
) q;
ROLLBACK;
