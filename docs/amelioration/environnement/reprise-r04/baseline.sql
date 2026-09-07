BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
SELECT jsonb_build_object('checked_at',clock_timestamp(),'run_prefix','QA20260907-R04',
 'transaction_read_only',current_setting('transaction_read_only'),
 'tables',(SELECT jsonb_agg(to_jsonb(t) ORDER BY table_name) FROM (SELECT 'artisanal_site_assignments' AS table_name,count(*) AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS aggregate_md5,
  coalesce(jsonb_agg(jsonb_build_object('id',id,'md5',md5(to_jsonb(t)::text)) ORDER BY id),'[]'::jsonb) AS rows
 FROM public.artisanal_site_assignments t
UNION ALL
SELECT 'artisanal_sites' AS table_name,count(*) AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS aggregate_md5,
  coalesce(jsonb_agg(jsonb_build_object('id',id,'md5',md5(to_jsonb(t)::text)) ORDER BY id),'[]'::jsonb) AS rows
 FROM public.artisanal_sites t
UNION ALL
SELECT 'snp_adhesion_baremes' AS table_name,count(*) AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS aggregate_md5,
  coalesce(jsonb_agg(jsonb_build_object('id',id,'md5',md5(to_jsonb(t)::text)) ORDER BY id),'[]'::jsonb) AS rows
 FROM public.snp_adhesion_baremes t
UNION ALL
SELECT 'snp_adhesion_droits' AS table_name,count(*) AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS aggregate_md5,
  coalesce(jsonb_agg(jsonb_build_object('id',id,'md5',md5(to_jsonb(t)::text)) ORDER BY id),'[]'::jsonb) AS rows
 FROM public.snp_adhesion_droits t
UNION ALL
SELECT 'snp_adhesion_encaissements' AS table_name,count(*) AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS aggregate_md5,
  coalesce(jsonb_agg(jsonb_build_object('id',id,'md5',md5(to_jsonb(t)::text)) ORDER BY id),'[]'::jsonb) AS rows
 FROM public.snp_adhesion_encaissements t
UNION ALL
SELECT 'snp_artisan_documents' AS table_name,count(*) AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS aggregate_md5,
  coalesce(jsonb_agg(jsonb_build_object('id',id,'md5',md5(to_jsonb(t)::text)) ORDER BY id),'[]'::jsonb) AS rows
 FROM public.snp_artisan_documents t
UNION ALL
SELECT 'snp_artisan_moyens_paiement' AS table_name,count(*) AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS aggregate_md5,
  coalesce(jsonb_agg(jsonb_build_object('id',id,'md5',md5(to_jsonb(t)::text)) ORDER BY id),'[]'::jsonb) AS rows
 FROM public.snp_artisan_moyens_paiement t
UNION ALL
SELECT 'snp_artisan_responsables' AS table_name,count(*) AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS aggregate_md5,
  coalesce(jsonb_agg(jsonb_build_object('id',id,'md5',md5(to_jsonb(t)::text)) ORDER BY id),'[]'::jsonb) AS rows
 FROM public.snp_artisan_responsables t
UNION ALL
SELECT 'snp_artisans_miniers' AS table_name,count(*) AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS aggregate_md5,
  coalesce(jsonb_agg(jsonb_build_object('id',id,'md5',md5(to_jsonb(t)::text)) ORDER BY id),'[]'::jsonb) AS rows
 FROM public.snp_artisans_miniers t
UNION ALL
SELECT 'snp_cartes_professionnelles' AS table_name,count(*) AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS aggregate_md5,
  coalesce(jsonb_agg(jsonb_build_object('id',id,'md5',md5(to_jsonb(t)::text)) ORDER BY id),'[]'::jsonb) AS rows
 FROM public.snp_cartes_professionnelles t) t),
 'storage',(SELECT jsonb_build_object('count',count(*),
   'objects',coalesce(jsonb_agg(jsonb_build_object('id',id,'bucket',bucket_id,'path_md5',md5(name),
     'metadata_md5',md5(jsonb_build_object('bucket',bucket_id,'name',name,'metadata',metadata,'owner',owner,'created_at',created_at,'updated_at',updated_at)::text)) ORDER BY id),'[]'::jsonb))
   FROM storage.objects WHERE bucket_id IN('artisanal-sites','artisanal-site-aea','artisan-dossiers'))
) AS baseline;
ROLLBACK;
