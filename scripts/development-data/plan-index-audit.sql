-- Read-only diagnostics for purchase plan fixture collisions.
SELECT jsonb_build_object(
  'indexes', COALESCE((SELECT jsonb_agg(jsonb_build_object('name',indexname,'definition',indexdef) ORDER BY indexname)
    FROM pg_indexes WHERE schemaname='public' AND tablename='snp_plans_achat'),'[]'::jsonb),
  'plans_2024_2026', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'year',annee,'month',mois,'status',statut,'number',numero_plan,'id',id) ORDER BY annee,mois)
    FROM public.snp_plans_achat WHERE annee BETWEEN 2024 AND 2026),'[]'::jsonb)
) AS plan_audit;
