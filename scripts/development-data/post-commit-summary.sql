-- Synthèse de contrôle en lecture seule du lot HIST-2024-2026.
SELECT jsonb_build_object(
  'batch','HIST-2024-2026',
  'counts',jsonb_build_object(
    'productions',(SELECT count(*) FROM public.daily_production WHERE id::text LIKE 'd8302026-%'),
    'forecasts',(SELECT count(*) FROM public.production_forecasts WHERE id::text LIKE 'd8302026-%'),
    'purchases',(SELECT count(*) FROM public.snp_achats_mines WHERE id::text LIKE 'd8302026-%'),
    'shipping',(SELECT count(*) FROM public.shipping_preparations WHERE id::text LIKE 'd8302026-%'),
    'freight',(SELECT count(*) FROM public.freight_shipments WHERE id::text LIKE 'd8302026-%'),
    'refining',(SELECT count(*) FROM public.refining_records WHERE id::text LIKE 'd8302026-%'),
    'inventory',(SELECT count(*) FROM public.gold_inventory WHERE id::text LIKE 'd8302026-%'),
    'export_sales',(SELECT count(*) FROM public.sales WHERE id::text LIKE 'd8302026-%'),
    'conciliations',(SELECT count(*) FROM public.snp_conciliations WHERE sale_id::text LIKE 'd8302026-%'),
    'international_payments',(SELECT count(*) FROM public.payments WHERE id::text LIKE 'd8302026-%'),
    'reserve_allocations',(SELECT count(*) FROM public.reserve_allocations WHERE id::text LIKE 'd8302026-%'),
    'artisanal_sales',(SELECT count(*) FROM public.snp_artisan_ventes_or WHERE id::text LIKE 'd8302026-%'),
    'artisanal_invoices',(SELECT count(*) FROM public.snp_artisan_factures_definitives WHERE id::text LIKE 'd8302026-%'),
    'requisitions',(SELECT count(*) FROM public.snp_requisitions WHERE id::text LIKE 'd8302026-%'),
    'contracts',(SELECT count(*) FROM public.snp_contrats WHERE id::text LIKE 'd8302026-%')
  ),
  'production_by_year',(SELECT jsonb_object_agg(year,total) FROM (
    SELECT extract(year FROM production_date)::integer AS year,count(*) AS total
    FROM public.daily_production WHERE id::text LIKE 'd8302026-%' GROUP BY 1 ORDER BY 1
  ) y),
  'reserve_by_status',(SELECT jsonb_object_agg(status,total) FROM (
    SELECT status,count(*) AS total FROM public.reserve_allocations
    WHERE id::text LIKE 'd8302026-%' GROUP BY status ORDER BY status
  ) s),
  'payment_by_status',(SELECT jsonb_object_agg(status,total) FROM (
    SELECT status,count(*) AS total FROM public.payments
    WHERE id::text LIKE 'd8302026-%' GROUP BY status ORDER BY status
  ) s),
  'editable_cases',jsonb_build_object(
    'pending_payments',(SELECT count(*) FROM public.payments WHERE id::text LIKE 'd8302026-%' AND status='pending'),
    'draft_requisitions',(SELECT count(*) FROM public.snp_requisitions WHERE id::text LIKE 'd8302026-%' AND statut='brouillon'),
    'draft_contracts',(SELECT count(*) FROM public.snp_contrats WHERE id::text LIKE 'd8302026-%' AND statut='brouillon'),
    'pending_artisanal_sales',(SELECT count(*) FROM public.snp_artisan_ventes_or WHERE id::text LIKE 'd8302026-%' AND statut='en_attente'),
    'draft_reserve_allocations',(SELECT count(*) FROM public.reserve_allocations WHERE id::text LIKE 'd8302026-%' AND status='DRAFT')
  ),
  'blocked_export_backing_gaps',(SELECT count(*) FROM public.snp_export_sale_physical_backing_gaps WHERE resolution='blocked'),
  'seed_actors',jsonb_build_object(
    'profiles',(SELECT count(*) FROM public.user_profiles WHERE id::text LIKE 'd8302026-%'),
    'active',(SELECT count(*) FROM public.user_profiles WHERE id::text LIKE 'd8302026-%' AND is_active)
  )
) AS post_commit_summary;
