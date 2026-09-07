BEGIN READ ONLY;
SET LOCAL statement_timeout='20s';
SELECT jsonb_build_object('checked_at',clock_timestamp(),
 'functions',(SELECT jsonb_agg(jsonb_build_object('name',proname,'signature',oid::regprocedure::text,'definition',pg_get_functiondef(oid)) ORDER BY proname)
  FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('snp_lister_affiliations','snp_affiliation_history','snp_save_artisanal_site','snp_save_artisan_dossier')),
 'storage_columns',(SELECT jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod)) ORDER BY attnum)
  FROM pg_attribute WHERE attrelid='storage.objects'::regclass AND attnum>0 AND NOT attisdropped)
) AS contracts;
ROLLBACK;
