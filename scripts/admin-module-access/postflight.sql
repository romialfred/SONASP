-- Lecture seule, utilisable avant/après déploiement.
SELECT
  u.role,u.is_active,
  (SELECT jsonb_agg(m.name ORDER BY m.name) FROM public.modules m JOIN public.snp_modules nav ON nav.code=m.name
    WHERE nav.parent_id IS NULL AND m.is_active AND NOT EXISTS(SELECT 1 FROM public.user_permissions p
      WHERE p.user_id=u.id AND p.module_id=m.id AND p.can_view)) AS missing_root_modules,
  (SELECT count(*) FROM public.modules m JOIN public.snp_modules nav ON nav.code=m.name
    WHERE nav.parent_id IS NULL AND m.is_active) AS root_modules,
  (SELECT count(*) FROM public.modules m JOIN public.snp_modules nav ON nav.code=m.name
    JOIN public.user_permissions p ON p.module_id=m.id AND p.user_id=u.id AND p.can_view
    WHERE nav.parent_id IS NULL AND m.is_active) AS granted_root_modules,
  (SELECT count(*) FROM public.modules m WHERE m.is_active
    AND public.snp_user_permission_allowed(u.id,m.id,'edit')) AS assignable_edit_modules,
  public.snp_user_permission_allowed(u.id,(SELECT id FROM public.modules WHERE name='refining'),'edit')
    AS refining_edit_assignable,
  has_table_privilege('authenticated','public.user_permissions','UPDATE') AS direct_update_granted
FROM public.user_profiles u WHERE u.id='c7570144-0075-4cb0-8a59-4713c1ebe07f'
  AND lower(u.email)='otingueri@gmail.com';
