-- Diagnostic en lecture seule du compte désigné, sans jeton ni secret.
SELECT 'target' AS section, coalesce(jsonb_agg(jsonb_build_object(
  'id',id,'email',email,'role',role,'is_active',is_active,
  'mining_company_id',mining_company_id,'mfa_enrolled',mfa_enrolled_at IS NOT NULL
)),'[]') AS data FROM public.user_profiles WHERE lower(email)='otingueri@gmail.com'
UNION ALL
SELECT 'modules',coalesce(jsonb_agg(jsonb_build_object(
  'id',m.id,'name',m.name,'domain',m.access_domain,'active',m.is_active,
  'view',p.can_view,'create',p.can_create,'edit',p.can_edit,'delete',p.can_delete,'approve',p.can_approve,
  'ceiling_view',public.snp_user_permission_allowed(u.id,m.id,'view'),
  'ceiling_edit',public.snp_user_permission_allowed(u.id,m.id,'edit')
) ORDER BY m.name),'[]') FROM public.user_profiles u CROSS JOIN public.modules m
LEFT JOIN public.user_permissions p ON p.user_id=u.id AND p.module_id=m.id
WHERE lower(u.email)='otingueri@gmail.com'
UNION ALL
SELECT 'functions',jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid)))
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN(
 'snp_permission_allowed','snp_user_permission_allowed','snp_actor_can_module_action',
 'snp_remplacer_habilitations_compte','snp_peut_administrer_compte','snp_configurer_acces_compte',
 'snp_role_permission_allowed','snp_role_module_allowed','snp_grant_modules_to_platform_account',
 'snp_module_permission_ceiling','snp_module_domain','snp_role_domain_allowed')
UNION ALL
SELECT 'admin_capabilities',coalesce(jsonb_agg(capability_code ORDER BY capability_code),'[]')
FROM public.snp_role_capabilities WHERE role='admin'
UNION ALL
SELECT 'admin_responsibility_ceiling',coalesce(jsonb_agg(responsibility_code),'[]')
FROM public.snp_role_responsibility_ceiling WHERE role='admin';
