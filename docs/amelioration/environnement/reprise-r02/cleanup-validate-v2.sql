BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $cleanup$
DECLARE
  before_preservation jsonb;
  after_preservation jsonb;
  deleted_count integer;
BEGIN
  IF (jsonb_build_object(
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
)) IS DISTINCT FROM '{"foreign_keys":[{"columns":["site_id"],"definition":"FOREIGN KEY (site_id) REFERENCES artisanal_sites(id) ON DELETE CASCADE","delete_action":"c","name":"artisanal_site_assignments_site_id_fkey","referenced_columns":["id"],"referenced_table":"artisanal_sites","table":"artisanal_site_assignments"},{"columns":["site_id"],"definition":"FOREIGN KEY (site_id) REFERENCES artisanal_sites(id) ON DELETE RESTRICT","delete_action":"r","name":"artisanal_site_productions_site_id_fkey","referenced_columns":["id"],"referenced_table":"artisanal_sites","table":"artisanal_site_productions"},{"columns":["site_id"],"definition":"FOREIGN KEY (site_id) REFERENCES artisanal_sites(id) ON DELETE RESTRICT","delete_action":"r","name":"snp_artisan_vente_site_origins_site_id_fkey","referenced_columns":["id"],"referenced_table":"artisanal_sites","table":"snp_artisan_vente_site_origins"},{"columns":["artisanal_site_id"],"definition":"FOREIGN KEY (artisanal_site_id) REFERENCES artisanal_sites(id) ON DELETE SET NULL","delete_action":"n","name":"snp_artisans_miniers_artisanal_site_id_fkey","referenced_columns":["id"],"referenced_table":"artisanal_sites","table":"snp_artisans_miniers"},{"columns":["site_id"],"definition":"FOREIGN KEY (site_id) REFERENCES artisanal_sites(id)","delete_action":"a","name":"snp_collector_sales_site_id_fkey","referenced_columns":["id"],"referenced_table":"artisanal_sites","table":"snp_collector_sales"},{"columns":["site_id"],"definition":"FOREIGN KEY (site_id) REFERENCES artisanal_sites(id)","delete_action":"a","name":"snp_collector_sites_site_id_fkey","referenced_columns":["id"],"referenced_table":"artisanal_sites","table":"snp_collector_sites"}],"rules":[],"triggers":[{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_135269\" AFTER INSERT ON public.artisanal_site_assignments FROM artisanal_sites NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_ins\"()","enabled":"O","function":"\"RI_FKey_check_ins\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_c_135269","table":"artisanal_site_assignments"},{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_135270\" AFTER UPDATE ON public.artisanal_site_assignments FROM artisanal_sites NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_upd\"()","enabled":"O","function":"\"RI_FKey_check_upd\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_c_135270","table":"artisanal_site_assignments"},{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_135274\" AFTER INSERT ON public.artisanal_site_assignments FROM auth.users NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_ins\"()","enabled":"O","function":"\"RI_FKey_check_ins\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_c_135274","table":"artisanal_site_assignments"},{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_135275\" AFTER UPDATE ON public.artisanal_site_assignments FROM auth.users NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_upd\"()","enabled":"O","function":"\"RI_FKey_check_upd\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_c_135275","table":"artisanal_site_assignments"},{"definition":"CREATE TRIGGER trg_artisanal_site_assignments_updated_at BEFORE UPDATE ON public.artisanal_site_assignments FOR EACH ROW EXECUTE FUNCTION set_artisanal_site_updated_at()","enabled":"O","function":"set_artisanal_site_updated_at()","function_md5":"8d25d0a381778d58d8994979b1999616","internal":false,"name":"trg_artisanal_site_assignments_updated_at","table":"artisanal_site_assignments"},{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_135267\" AFTER DELETE ON public.artisanal_sites FROM artisanal_site_assignments NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_cascade_del\"()","enabled":"O","function":"\"RI_FKey_cascade_del\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_a_135267","table":"artisanal_sites"},{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_135268\" AFTER UPDATE ON public.artisanal_sites FROM artisanal_site_assignments NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_upd\"()","enabled":"O","function":"\"RI_FKey_noaction_upd\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_a_135268","table":"artisanal_sites"},{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_135293\" AFTER DELETE ON public.artisanal_sites FROM artisanal_site_productions NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_restrict_del\"()","enabled":"O","function":"\"RI_FKey_restrict_del\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_a_135293","table":"artisanal_sites"},{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_135294\" AFTER UPDATE ON public.artisanal_sites FROM artisanal_site_productions NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_upd\"()","enabled":"O","function":"\"RI_FKey_noaction_upd\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_a_135294","table":"artisanal_sites"},{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_135310\" AFTER DELETE ON public.artisanal_sites FROM snp_artisans_miniers NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_setnull_del\"()","enabled":"O","function":"\"RI_FKey_setnull_del\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_a_135310","table":"artisanal_sites"},{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_135311\" AFTER UPDATE ON public.artisanal_sites FROM snp_artisans_miniers NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_upd\"()","enabled":"O","function":"\"RI_FKey_noaction_upd\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_a_135311","table":"artisanal_sites"},{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_185249\" AFTER DELETE ON public.artisanal_sites FROM snp_artisan_vente_site_origins NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_restrict_del\"()","enabled":"O","function":"\"RI_FKey_restrict_del\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_a_185249","table":"artisanal_sites"},{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_185250\" AFTER UPDATE ON public.artisanal_sites FROM snp_artisan_vente_site_origins NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_upd\"()","enabled":"O","function":"\"RI_FKey_noaction_upd\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_a_185250","table":"artisanal_sites"},{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_186519\" AFTER DELETE ON public.artisanal_sites FROM snp_collector_sites NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_del\"()","enabled":"O","function":"\"RI_FKey_noaction_del\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_a_186519","table":"artisanal_sites"},{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_186520\" AFTER UPDATE ON public.artisanal_sites FROM snp_collector_sites NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_upd\"()","enabled":"O","function":"\"RI_FKey_noaction_upd\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_a_186520","table":"artisanal_sites"},{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_186563\" AFTER DELETE ON public.artisanal_sites FROM snp_collector_sales NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_del\"()","enabled":"O","function":"\"RI_FKey_noaction_del\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_a_186563","table":"artisanal_sites"},{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_a_186564\" AFTER UPDATE ON public.artisanal_sites FROM snp_collector_sales NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_noaction_upd\"()","enabled":"O","function":"\"RI_FKey_noaction_upd\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_a_186564","table":"artisanal_sites"},{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_135246\" AFTER INSERT ON public.artisanal_sites FROM auth.users NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_ins\"()","enabled":"O","function":"\"RI_FKey_check_ins\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_c_135246","table":"artisanal_sites"},{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_135247\" AFTER UPDATE ON public.artisanal_sites FROM auth.users NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_upd\"()","enabled":"O","function":"\"RI_FKey_check_upd\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_c_135247","table":"artisanal_sites"},{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_135251\" AFTER INSERT ON public.artisanal_sites FROM auth.users NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_ins\"()","enabled":"O","function":"\"RI_FKey_check_ins\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_c_135251","table":"artisanal_sites"},{"definition":"CREATE CONSTRAINT TRIGGER \"RI_ConstraintTrigger_c_135252\" AFTER UPDATE ON public.artisanal_sites FROM auth.users NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION \"RI_FKey_check_upd\"()","enabled":"O","function":"\"RI_FKey_check_upd\"()","function_md5":null,"internal":true,"name":"RI_ConstraintTrigger_c_135252","table":"artisanal_sites"},{"definition":"CREATE TRIGGER snp_artisanal_site_aea_guard BEFORE INSERT OR UPDATE ON public.artisanal_sites FOR EACH ROW EXECUTE FUNCTION snp_check_artisanal_site_aea()","enabled":"O","function":"snp_check_artisanal_site_aea()","function_md5":"92f6e1632da2529eb37c01633d76f669","internal":false,"name":"snp_artisanal_site_aea_guard","table":"artisanal_sites"},{"definition":"CREATE TRIGGER trg_artisanal_sites_updated_at BEFORE UPDATE ON public.artisanal_sites FOR EACH ROW EXECUTE FUNCTION set_artisanal_site_updated_at()","enabled":"O","function":"set_artisanal_site_updated_at()","function_md5":"8d25d0a381778d58d8994979b1999616","internal":false,"name":"trg_artisanal_sites_updated_at","table":"artisanal_sites"}]}'::jsonb THEN
    RAISE EXCEPTION 'Schéma, FK, règles ou déclencheurs divergents : nouvelle revue nécessaire';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.artisanal_sites t WHERE t.id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid
    AND t.name='QA20260907-R02-SITE' AND left(t.name,length('QA20260907-R02'))='QA20260907-R02'
    AND md5(to_jsonb(t)::text)='7a9bcab1cdfb1062397116a3c7c1efe8') THEN
    RAISE EXCEPTION 'Site absent, modifié ou hors manifeste : nettoyage refusé';
  END IF;
  IF (SELECT coalesce(array_agg(id ORDER BY id),ARRAY[]::uuid[]) FROM public.artisanal_site_assignments WHERE site_id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid)
    IS DISTINCT FROM ARRAY['12bd6c4e-52f4-4e9d-a2aa-81e101ab5e12','d585b8e2-8f0c-4acd-bb90-bfd03acd6a8c']::uuid[] THEN
    RAISE EXCEPTION 'Responsables différents du manifeste : nettoyage refusé';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.artisanal_site_assignments t WHERE t.id='12bd6c4e-52f4-4e9d-a2aa-81e101ab5e12'::uuid AND t.site_id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid
    AND md5(to_jsonb(t)::text)='946cba19a76e83e069707f15d8adb9d9') THEN RAISE EXCEPTION 'Responsable modifié : nettoyage refusé'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.artisanal_site_assignments t WHERE t.id='d585b8e2-8f0c-4acd-bb90-bfd03acd6a8c'::uuid AND t.site_id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid
    AND md5(to_jsonb(t)::text)='07672babd9306e0942c5dc7806c6c02f') THEN RAISE EXCEPTION 'Responsable modifié : nettoyage refusé'; END IF;
  IF EXISTS(SELECT 1 FROM public.artisanal_sites WHERE id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid
    AND (cardinality(photos)<>0 OR aea_document_path IS NOT NULL)) THEN
    RAISE EXCEPTION 'Pièce distante présente : nettoyage hors portée';
  END IF;

  IF EXISTS(SELECT 1 FROM public.artisanal_site_productions WHERE site_id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid) THEN
    RAISE EXCEPTION 'Dépendance externe artisanal_site_productions.site_id : nettoyage refusé'; END IF;

  IF EXISTS(SELECT 1 FROM public.snp_artisan_vente_site_origins WHERE site_id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid) THEN
    RAISE EXCEPTION 'Dépendance externe snp_artisan_vente_site_origins.site_id : nettoyage refusé'; END IF;

  IF EXISTS(SELECT 1 FROM public.snp_artisans_miniers WHERE artisanal_site_id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid) THEN
    RAISE EXCEPTION 'Dépendance externe snp_artisans_miniers.artisanal_site_id : nettoyage refusé'; END IF;

  IF EXISTS(SELECT 1 FROM public.snp_collector_sales WHERE site_id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid) THEN
    RAISE EXCEPTION 'Dépendance externe snp_collector_sales.site_id : nettoyage refusé'; END IF;

  IF EXISTS(SELECT 1 FROM public.snp_collector_sites WHERE site_id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid) THEN
    RAISE EXCEPTION 'Dépendance externe snp_collector_sites.site_id : nettoyage refusé'; END IF;
  before_preservation := (SELECT jsonb_build_object('tables',(SELECT jsonb_agg(to_jsonb(r) ORDER BY table_name) FROM (
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
 FROM storage.objects o WHERE bucket_id IN('artisanal-sites','artisanal-site-aea','artisan-dossiers'))));
  after_preservation := (SELECT jsonb_build_object('tables',(SELECT jsonb_agg(to_jsonb(r) ORDER BY table_name) FROM (
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
 FROM storage.objects o WHERE bucket_id IN('artisanal-sites','artisanal-site-aea','artisan-dossiers'))));
  IF before_preservation IS DISTINCT FROM after_preservation THEN
    RAISE EXCEPTION 'Une donnée hors manifeste a changé : annulation intégrale';
  END IF;
END; $cleanup$;
SELECT jsonb_build_object('checked_at',clock_timestamp(),'read_only',current_setting('transaction_read_only'),
 'run_prefix','QA20260907-R02','guards_passed',true,'before_and_after_expressions_evaluated',true,
 'remaining_site',(SELECT count(*) FROM public.artisanal_sites WHERE id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid),
 'remaining_assignments',(SELECT count(*) FROM public.artisanal_site_assignments WHERE site_id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid)) AS cleanup_readonly_validation;
ROLLBACK;
