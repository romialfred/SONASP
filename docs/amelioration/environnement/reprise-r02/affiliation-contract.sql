BEGIN READ ONLY;
SET LOCAL statement_timeout='20s';
SELECT jsonb_build_object('checked_at',clock_timestamp(),
 'functions',(SELECT jsonb_agg(jsonb_build_object('name',proname,'signature',oid::regprocedure::text,'definition',pg_get_functiondef(oid),'md5',md5(pg_get_functiondef(oid))) ORDER BY proname)
  FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('snp_affiliation_card_json','snp_affiliation_readable'))
) AS affiliation_contract;
ROLLBACK;
