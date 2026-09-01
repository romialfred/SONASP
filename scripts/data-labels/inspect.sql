BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SELECT 'references' AS section, jsonb_agg(to_jsonb(q)) AS data FROM (
  SELECT 'sales' AS entity, id::text, sale_number AS reference, sale_date::text AS date
  FROM public.sales
  UNION ALL
  SELECT 'shipping_preparations', id::text, expedition_lot_number, created_at::date::text
  FROM public.shipping_preparations
  UNION ALL
  SELECT 'snp_achats_mines', id::text, numero_achat, date_achat::text
  FROM public.snp_achats_mines
) q
UNION ALL
SELECT 'generators', jsonb_agg(jsonb_build_object('name', p.proname, 'definition', pg_get_functiondef(p.oid)))
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f'
  AND (p.proname IN ('generate_numero_achat_mine', 'snp_creer_vente_export')
       OR (p.proname ~ '(generate|generer|creer)' AND pg_get_functiondef(p.oid) ~ '(SL-|EXP-|expedition_lot_number)'))
UNION ALL
SELECT 'triggers', jsonb_agg(jsonb_build_object('table', c.relname, 'name', t.tgname,
  'definition', pg_get_triggerdef(t.oid), 'function', p.proname))
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_proc p ON p.oid = t.tgfoid
WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal
  AND c.relname IN ('sales', 'shipping_preparations', 'snp_achats_mines', 'daily_production', 'quarterly_forecasts')
UNION ALL
SELECT 'reference_dependencies', jsonb_agg(jsonb_build_object('table', c.conrelid::regclass::text,
  'name', c.conname, 'definition', pg_get_constraintdef(c.oid)))
FROM pg_constraint c WHERE c.contype = 'f'
AND c.confrelid IN ('public.sales'::regclass, 'public.shipping_preparations'::regclass, 'public.snp_achats_mines'::regclass);
ROLLBACK;
