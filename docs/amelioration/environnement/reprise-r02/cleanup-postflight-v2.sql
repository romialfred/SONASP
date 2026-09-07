BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
WITH baseline_read AS (SELECT jsonb_build_object('checked_at',clock_timestamp(),'run_prefix','QA20260907-R02',
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
     'content_md5',md5(jsonb_build_object('bucket',bucket_id,'name',name,'metadata',metadata,'owner',owner,'created_at',created_at,'updated_at',updated_at)::text)) ORDER BY id),'[]'::jsonb))
   FROM storage.objects WHERE bucket_id IN('artisanal-sites','artisanal-site-aea','artisan-dossiers'))
) AS baseline)
SELECT jsonb_build_object('checked_at',clock_timestamp(),'run_prefix','QA20260907-R02',
 'remaining_site',(SELECT count(*) FROM public.artisanal_sites WHERE id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid),
 'remaining_assignments',(SELECT count(*) FROM public.artisanal_site_assignments WHERE site_id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid OR id=ANY(ARRAY['12bd6c4e-52f4-4e9d-a2aa-81e101ab5e12','d585b8e2-8f0c-4acd-bb90-bfd03acd6a8c']::uuid[])),
 'schema',jsonb_build_object(
 'foreign_keys',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,
   'referenced_table',c.confrelid::regclass::text,'definition',pg_get_constraintdef(c.oid),'delete_action',c.confdeltype,
   'columns',(SELECT jsonb_agg(a.attname ORDER BY k.n) FROM unnest(c.conkey) WITH ORDINALITY k(attnum,n) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum),
   'referenced_columns',(SELECT jsonb_agg(a.attname ORDER BY k.n) FROM unnest(c.confkey) WITH ORDINALITY k(attnum,n) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.attnum))
   ORDER BY c.conrelid::regclass::text,c.conname),'[]'::jsonb) FROM pg_constraint c
   WHERE c.contype='f' AND c.confrelid IN ('public.artisanal_sites'::regclass,'public.artisanal_site_assignments'::regclass)),
 'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,'name',t.tgname,'internal',t.tgisinternal,
   'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'function',t.tgfoid::regprocedure::text,
   'function_md5',CASE WHEN NOT t.tgisinternal THEN md5(pg_get_functiondef(t.tgfoid)) ELSE NULL END)
   ORDER BY t.tgrelid::regclass::text,t.tgname),'[]'::jsonb) FROM pg_trigger t
   WHERE t.tgrelid IN ('public.artisanal_sites'::regclass,'public.artisanal_site_assignments'::regclass)),
 'rules',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',r.ev_class::regclass::text,'name',r.rulename,'definition',pg_get_ruledef(r.oid))
   ORDER BY r.ev_class::regclass::text,r.rulename),'[]'::jsonb) FROM pg_rewrite r
   WHERE r.ev_class IN ('public.artisanal_sites'::regclass,'public.artisanal_site_assignments'::regclass))
),'baseline',(SELECT baseline FROM baseline_read),'outside_preservation',(SELECT jsonb_build_object('tables',(SELECT jsonb_agg(to_jsonb(r) ORDER BY table_name) FROM (
SELECT 'artisanal_site_assignments' AS table_name,count(*) AS row_count,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text COLLATE "C"),'')) AS aggregate_md5 FROM public.artisanal_site_assignments t WHERE NOT(t.id=ANY(ARRAY['12bd6c4e-52f4-4e9d-a2aa-81e101ab5e12','d585b8e2-8f0c-4acd-bb90-bfd03acd6a8c']::uuid[]))
UNION ALL
SELECT 'artisanal_site_productions' AS table_name,count(*) AS row_count,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text COLLATE "C"),'')) AS aggregate_md5 FROM public.artisanal_site_productions t
UNION ALL
SELECT 'artisanal_sites' AS table_name,count(*) AS row_count,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text COLLATE "C"),'')) AS aggregate_md5 FROM public.artisanal_sites t WHERE t.id<>'d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid
UNION ALL
SELECT 'snp_adhesion_baremes' AS table_name,count(*) AS row_count,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text COLLATE "C"),'')) AS aggregate_md5 FROM public.snp_adhesion_baremes t
UNION ALL
SELECT 'snp_adhesion_droits' AS table_name,count(*) AS row_count,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text COLLATE "C"),'')) AS aggregate_md5 FROM public.snp_adhesion_droits t
UNION ALL
SELECT 'snp_adhesion_encaissements' AS table_name,count(*) AS row_count,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text COLLATE "C"),'')) AS aggregate_md5 FROM public.snp_adhesion_encaissements t
UNION ALL
SELECT 'snp_artisan_documents' AS table_name,count(*) AS row_count,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text COLLATE "C"),'')) AS aggregate_md5 FROM public.snp_artisan_documents t
UNION ALL
SELECT 'snp_artisan_moyens_paiement' AS table_name,count(*) AS row_count,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text COLLATE "C"),'')) AS aggregate_md5 FROM public.snp_artisan_moyens_paiement t
UNION ALL
SELECT 'snp_artisan_responsables' AS table_name,count(*) AS row_count,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text COLLATE "C"),'')) AS aggregate_md5 FROM public.snp_artisan_responsables t
UNION ALL
SELECT 'snp_artisan_vente_site_origins' AS table_name,count(*) AS row_count,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text COLLATE "C"),'')) AS aggregate_md5 FROM public.snp_artisan_vente_site_origins t
UNION ALL
SELECT 'snp_artisans_miniers' AS table_name,count(*) AS row_count,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text COLLATE "C"),'')) AS aggregate_md5 FROM public.snp_artisans_miniers t
UNION ALL
SELECT 'snp_cartes_professionnelles' AS table_name,count(*) AS row_count,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text COLLATE "C"),'')) AS aggregate_md5 FROM public.snp_cartes_professionnelles t
UNION ALL
SELECT 'snp_collector_sales' AS table_name,count(*) AS row_count,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text COLLATE "C"),'')) AS aggregate_md5 FROM public.snp_collector_sales t
UNION ALL
SELECT 'snp_collector_sites' AS table_name,count(*) AS row_count,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text COLLATE "C"),'')) AS aggregate_md5 FROM public.snp_collector_sites t
) r),'storage',(SELECT jsonb_build_object('count',count(*),'metadata_md5',md5(coalesce(string_agg(to_jsonb(o)::text,'' ORDER BY id),'')))
 FROM storage.objects o WHERE bucket_id IN('artisanal-sites','artisanal-site-aea','artisan-dossiers'))))) AS cleanup_postflight;
ROLLBACK;
