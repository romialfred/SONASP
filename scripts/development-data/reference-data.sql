-- Only public, non-personal workflow reference data needed by isolated tests.
SELECT 'capabilities' AS section, coalesce(jsonb_agg(to_jsonb(c)),'[]') AS data
FROM public.snp_capability_catalog c
WHERE c.domain IN ('reconciliation','reserve') OR c.code LIKE 'reserve.%'
UNION ALL
SELECT 'management_capabilities',coalesce(jsonb_agg(to_jsonb(c)),'[]')
FROM public.snp_role_capabilities c
WHERE c.role='management' AND (c.capability_code LIKE 'reserve.%' OR c.capability_code LIKE 'reconciliation.%')
UNION ALL
SELECT 'auth_triggers',coalesce(jsonb_agg(jsonb_build_object('trigger',t.tgname,'definition',pg_get_functiondef(t.tgfoid))),'[]')
FROM pg_trigger t WHERE t.tgrelid='auth.users'::regclass AND NOT t.tgisinternal;
