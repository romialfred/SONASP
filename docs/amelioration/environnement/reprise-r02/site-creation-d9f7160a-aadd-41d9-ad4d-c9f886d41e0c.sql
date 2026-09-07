BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='20s';
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.artisanal_sites WHERE id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid AND left(name,14)='QA20260907-R02') THEN
  RAISE EXCEPTION 'UUID absent ou dossier hors du préfixe QA20260907-R02 autorisé';
 END IF;
END; $guard$;
SELECT jsonb_build_object('checked_at',clock_timestamp(),'run_prefix','QA20260907-R02','kind','site','id','d9f7160a-aadd-41d9-ad4d-c9f886d41e0c',
 'parent',(SELECT to_jsonb(t)-'photos' || jsonb_build_object('photos',coalesce((SELECT jsonb_agg(CASE WHEN photo ~ '^sites/[a-zA-Z0-9-]+\.jpg$' THEN photo ELSE '[reference expurgée]' END ORDER BY n) FROM unnest(t.photos) WITH ORDINALITY p(photo,n)),'[]'::jsonb),'photo_reference_md5',coalesce((SELECT jsonb_agg(md5(photo) ORDER BY n) FROM unnest(t.photos) WITH ORDINALITY p(photo,n)),'[]'::jsonb)) FROM public.artisanal_sites t WHERE id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid),'assignments',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]'::jsonb) FROM public.artisanal_site_assignments t WHERE site_id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid),
 'references',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY table_name,column_name),'[]'::jsonb) FROM (SELECT 'artisanal_site_assignments' AS table_name,'site_id' AS column_name,count(*) AS row_count FROM public.artisanal_site_assignments WHERE site_id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid
UNION ALL
SELECT 'artisanal_site_productions' AS table_name,'site_id' AS column_name,count(*) AS row_count FROM public.artisanal_site_productions WHERE site_id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid
UNION ALL
SELECT 'snp_artisan_vente_site_origins' AS table_name,'site_id' AS column_name,count(*) AS row_count FROM public.snp_artisan_vente_site_origins WHERE site_id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid
UNION ALL
SELECT 'snp_artisans_miniers' AS table_name,'artisanal_site_id' AS column_name,count(*) AS row_count FROM public.snp_artisans_miniers WHERE artisanal_site_id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid
UNION ALL
SELECT 'snp_collector_sales' AS table_name,'site_id' AS column_name,count(*) AS row_count FROM public.snp_collector_sales WHERE site_id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid
UNION ALL
SELECT 'snp_collector_sites' AS table_name,'site_id' AS column_name,count(*) AS row_count FROM public.snp_collector_sites WHERE site_id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid) r),
 'storage',(SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',p.bucket_id,'path',p.name,'found',o.id IS NOT NULL,
   'object_id',o.id,'created_at',o.created_at,'updated_at',o.updated_at,'size',o.metadata->>'size','mimetype',o.metadata->>'mimetype',
   'metadata_md5',md5(o.metadata::text)) ORDER BY p.bucket_id,p.name),'[]'::jsonb)
   FROM (SELECT 'artisanal-sites' AS bucket_id,p.photo AS name FROM public.artisanal_sites s CROSS JOIN LATERAL unnest(s.photos) p(photo) WHERE s.id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid AND p.photo ~ '^sites/'
   UNION ALL SELECT 'artisanal-site-aea',aea_document_path FROM public.artisanal_sites WHERE id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid AND aea_document_path IS NOT NULL) p LEFT JOIN storage.objects o ON o.bucket_id=p.bucket_id AND o.name=p.name)
) AS dossier;
ROLLBACK;
