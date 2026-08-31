-- Read-only, exact account requested by the operator. No authentication secrets.
WITH counts AS MATERIALIZED (
  SELECT i.*, ((xpath('/row/n/text()', query_to_xml(format(
    'SELECT count(*) AS n FROM %I.%I WHERE %I = %L::uuid',
    i.schema_name, i.table_name, i.column_name,
    'c7570144-0075-4cb0-8a59-4713c1ebe07f'
  ), false, true, '')))[1]::text)::bigint AS row_count
  FROM public.snp_2m_current_dependency_inventory() i
), drift AS (
  SELECT i.* FROM public.snp_2m_current_dependency_inventory() i
  LEFT JOIN public.snp_account_deletion_dependency_registry r
    USING(schema_name,table_name,column_name)
  WHERE r.schema_name IS NULL OR ROW(i.classification,i.constraint_name,
    i.referenced_schema_name,i.referenced_table_name,i.referenced_column_name,
    i.delete_action,i.source) IS DISTINCT FROM ROW(r.classification,r.constraint_name,
    r.referenced_schema_name,r.referenced_table_name,r.referenced_column_name,
    r.delete_action,r.source)
)
SELECT 'target' section, coalesce(jsonb_agg(jsonb_build_object(
  'id',p.id,'email',p.email,'role',p.role,'is_active',p.is_active,'version',p.version,
  'auth_confirmed',exists(select 1 from auth.users a where a.id=p.id and lower(a.email)='otingueri@gmail.com')
)), '[]') data FROM public.user_profiles p WHERE lower(p.email)='otingueri@gmail.com'
UNION ALL
SELECT 'dependencies',coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.table_name,c.column_name),'[]')
FROM counts c WHERE row_count>0
UNION ALL
SELECT 'registry_drift',coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.table_name,d.column_name),'[]') FROM drift d
UNION ALL
SELECT 'functions',jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid)))
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
  'snp_2m_assert_dependency_registry_complete','log_account_status_change',
  'snp_sessions_revoquer_toutes','snp_admin_compte_finaliser_action'
)
UNION ALL
SELECT 'identity_triggers',jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,
  'definition',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(t.tgfoid)))
FROM pg_trigger t WHERE t.tgrelid IN ('auth.users'::regclass,'public.user_profiles'::regclass)
AND NOT t.tgisinternal;
