-- R04 : métadonnées uniquement, aucune session Auth imitée ni écriture.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '20s';
WITH target AS (
  SELECT c.* FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND (
    c.relname IN ('artisanal_sites','artisanal_site_assignments','snp_artisans_miniers',
    'snp_artisan_responsables','snp_artisan_documents','snp_artisan_moyens_paiement',
    'snp_cartes_professionnelles','snp_adhesion_baremes','snp_adhesion_droits','snp_adhesion_encaissements')
    OR c.relname LIKE 'snp_affiliation%') AND c.relkind IN ('r','p','v','m')
)
SELECT jsonb_build_object(
  'checked_at',clock_timestamp(),'database',current_database(),'server_version',current_setting('server_version'),
  'transaction_read_only',current_setting('transaction_read_only'),
  'relations',(SELECT jsonb_agg(jsonb_build_object('name',relname,'kind',relkind,'rls',relrowsecurity,'forced_rls',relforcerowsecurity,
    'authenticated_select',has_table_privilege('authenticated',oid,'SELECT')) ORDER BY relname) FROM target),
  'columns',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
    'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY c.relname,a.attnum)
    FROM target c JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum),
  'foreign_keys',(SELECT jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'referenced_table',confrelid::regclass::text,
    'definition',pg_get_constraintdef(oid)) ORDER BY conrelid::regclass::text,conname) FROM pg_constraint
    WHERE contype='f' AND (conrelid IN(SELECT oid FROM target) OR confrelid IN(SELECT oid FROM target))),
  'triggers',(SELECT jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,'name',t.tgname,'enabled',t.tgenabled,
    'definition',pg_get_triggerdef(t.oid),'function',t.tgfoid::regprocedure::text,'function_md5',md5(pg_get_functiondef(t.tgfoid))) ORDER BY t.tgrelid::regclass::text,t.tgname)
    FROM pg_trigger t WHERE t.tgrelid IN(SELECT oid FROM target) AND NOT t.tgisinternal),
  'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname) FROM pg_policies p
    WHERE (schemaname='public' AND tablename IN(SELECT relname FROM target)) OR (schemaname='storage' AND tablename IN('objects','buckets')
      AND (coalesce(qual,'')||coalesce(with_check,'')) ~ 'artisanal-sites|artisanal-site-aea|artisan')),
  'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'signature',p.oid::regprocedure::text,
    'args',pg_get_function_arguments(p.oid),'returns',pg_get_function_result(p.oid),'definer',p.prosecdef,'config',p.proconfig,
    'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'md5',md5(pg_get_functiondef(p.oid))) ORDER BY p.proname,p.oid::regprocedure::text)
    FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN(
      'snp_save_artisanal_site','snp_save_artisan_dossier','snp_lister_affiliations','snp_affiliation_history',
      'snp_artisans_eligibles_operations','snp_artisan_affiliation_eligible','snp_upsert_artisan_moyen_paiement')),
  'buckets',(SELECT jsonb_agg(jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) ORDER BY id)
    FROM storage.buckets WHERE id IN ('artisanal-sites','artisanal-site-aea') OR id LIKE '%artisan%'),
  'recent_migrations',(SELECT jsonb_agg(jsonb_build_object('version',version,'name',name) ORDER BY version DESC)
    FROM (SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 6) m)
) AS preflight;
ROLLBACK;
