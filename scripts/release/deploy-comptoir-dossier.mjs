import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const [mode,cli,folder]=process.argv.slice(2);
if(!['backup','rehearse','apply','verify'].includes(mode)||!cli||!folder)throw new Error('Usage: deploy-comptoir-dossier.mjs backup|rehearse|apply|verify CLI private-folder');
const project='yyverzuhkdonjjuficor',version='20260906174800',file=`supabase/migrations/${version}_dossiers_comptoirs_entreprises.sql`;
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),project);
const target=path.resolve(folder),backupRoot=path.resolve('backups')+path.sep;
assert.ok(target.startsWith(backupRoot),'Private backup must stay in workspace/backups');mkdirSync(target,{recursive:true});
const sql=readFileSync(file,'utf8').replace(/\r\n?/g,'\n');
const checksum=createHash('sha256').update(sql).digest('hex');
const catalogue=JSON.parse(readFileSync('supabase/migrations.catalogue.json','utf8'));
assert.equal(catalogue.files.find(f=>f.path===file)?.sha256,checksum);
assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,1);
const body=sql.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
const tables=['snp_organizations','snp_artisans_miniers','snp_artisan_responsables','snp_artisan_documents','artisanal_sites','snp_artisan_ventes_or','snp_artisan_paiements','snp_artisan_factures_definitives','snp_cartes_professionnelles','snp_collectors','snp_collector_sites','snp_collector_sales','user_profiles','user_sessions'];
const newTables=['snp_comptoir_tax_offices','snp_comptoir_dossiers','snp_comptoir_documents','snp_comptoir_dossier_audit'];
const fingerprints=tables.map(t=>`SELECT '${t}' table_name,count(*) row_count,md5(coalesce(string_agg(to_jsonb(t)::text,'|' ORDER BY to_jsonb(t)::text),'')) fingerprint FROM public.${t} t`).join('\nUNION ALL\n');
function query(text,label){
 const filename=path.join(target,label+'.sql');writeFileSync(filename,text);
 try{const raw=execFileSync(cli,['db','query','--linked','--file',filename,'-o','json'],{encoding:'utf8',timeout:120000,maxBuffer:40*1024*1024,stdio:['ignore','pipe','pipe']});const rows=JSON.parse(raw.slice(raw.indexOf('{'))).rows;writeFileSync(path.join(target,label+'.json'),JSON.stringify(rows,null,2));return rows;}
 catch(e){writeFileSync(path.join(target,label+'.error.log'),String(e.stderr||e.message));throw new Error(`${label} failed; inspect the saved log and migration state before retrying.`);}
}
const schema=`SELECT jsonb_build_object(
 'recorded',EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='${version}'),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'acl',p.proacl) ORDER BY p.oid::regprocedure::text) FROM pg_proc p WHERE pronamespace='public'::regnamespace AND prokind='f'),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname) FROM pg_policies p WHERE schemaname IN ('public','storage')),
 'columns',(SELECT jsonb_agg(to_jsonb(c) ORDER BY table_name,ordinal_position) FROM information_schema.columns c WHERE table_schema='public' AND table_name IN (${tables.map(quote)},${newTables.map(quote)})),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('table',tgrelid::regclass::text,'name',tgname,'definition',pg_get_triggerdef(oid)) ORDER BY tgrelid::regclass::text,tgname) FROM pg_trigger WHERE tgrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace) AND NOT tgisinternal)
 ) AS snapshot;`;
const verify=`SELECT
 EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='${version}') migration_recorded,
 (SELECT bool_and(relrowsecurity) AND count(*)=4 FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN (${newTables.map(quote)})) rls_enabled,
 (SELECT count(*)=70 FROM public.snp_comptoir_tax_offices) tax_reference_ready,
 NOT has_function_privilege('anon','public.snp_save_comptoir_dossier(uuid,jsonb,integer,timestamptz,uuid)','EXECUTE') anonymous_write_denied,
 NOT has_function_privilege('authenticated','public.snp_register_comptoir_document_gateway(jsonb,uuid)','EXECUTE') upload_gateway_only,
 NOT has_table_privilege('authenticated','public.snp_comptoir_dossiers','INSERT') direct_write_denied,
 EXISTS(SELECT 1 FROM storage.buckets WHERE id='comptoir-dossiers' AND NOT public) private_documents;`;
if(mode==='backup'){
 assert.ok(!existsSync(path.join(target,'baseline.json')),'Backup already exists');const snapshot=query(schema,'baseline')[0].snapshot;assert.equal(snapshot.recorded,false);
 query(fingerprints,'business-baseline');writeFileSync(path.join(target,'source.json'),JSON.stringify({version,checksum}));console.log(JSON.stringify({mode,project,checksum,tables:tables.length}));
}else if(mode==='verify'){
 const result=query(verify,'verification')[0];for(const[k,v]of Object.entries(result))assert.equal(v,true,k);console.log(JSON.stringify(result));
}else{
 assert.deepEqual(JSON.parse(readFileSync(path.join(target,'source.json'),'utf8')),{version,checksum});
 const before=JSON.parse(readFileSync(path.join(target,'baseline.json'),'utf8'))[0].snapshot;
 assert.deepEqual(query(schema,'before-'+mode)[0].snapshot,before,'Schema changed since backup');
 if(mode==='apply')assert.deepEqual(JSON.parse(readFileSync(path.join(target,'rehearsal-receipt.json'),'utf8')).source,{version,checksum});
 const probe=mode==='rehearse'?`
 SAVEPOINT comptoir_probe;
 CREATE TEMP TABLE comptoir_probe_actor AS SELECT id FROM public.user_profiles WHERE role='owner' AND is_active AND mining_company_id IS NULL AND mfa_enrolled_at IS NOT NULL ORDER BY id LIMIT 1;
 DO $probe$ BEGIN IF NOT EXISTS(SELECT 1 FROM comptoir_probe_actor) THEN RAISE EXCEPTION 'MFA administrator required for transactional rehearsal'; END IF; END $probe$;
 INSERT INTO public.user_sessions(user_id,token_hash,expires_at,is_active) SELECT id,extensions.digest('comptoir-transactional-probe-${version}','sha256'),clock_timestamp()+interval '10 minutes',true FROM comptoir_probe_actor;
 SELECT set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated','aal','aal2','session_id','comptoir-transactional-probe-${version}','exp',extract(epoch from clock_timestamp()+interval '10 minutes')::bigint)::text,true),
 set_config('request.jwt.claim.sub',id::text,true),set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.aal','aal2',true) FROM comptoir_probe_actor;
 SET LOCAL ROLE authenticated;
 DO $probe$ DECLARE r jsonb; n uuid:=gen_random_uuid(); request uuid:=gen_random_uuid(); BEGIN
  r:=public.snp_save_comptoir_dossier(n,'{"name":"Comptoir contrôle transactionnel","legal_form":"SARL","country":"BF","city":"Ouagadougou","rccm_number":"QA-ROLLBACK-RCCM","ifu_number":"QA-ROLLBACK-IFU","tax_regime":"RNI","tax_office_code":"DGE","authorization_number":"QA","authorization_issued_on":"2026-01-01","authorization_expires_on":"2026-12-31","representative_last_name":"Contrôle","representative_first_name":"Jetable"}',0,NULL,request);
  IF r->>'id'<>n::text OR (r->>'version')::int<>1 OR r->'values'->>'representative_last_name'<>'Contrôle' THEN RAISE EXCEPTION 'Comptoir round trip failed'; END IF;
  IF jsonb_array_length(public.snp_list_comptoir_dossiers(n))<>1 THEN RAISE EXCEPTION 'Comptoir read failed'; END IF;
  PERFORM public.snp_list_collectors();
 END $probe$;
 RESET ROLE;
 ROLLBACK TO SAVEPOINT comptoir_probe;
 RELEASE SAVEPOINT comptoir_probe;
 `:'';
 const result=query(`BEGIN ISOLATION LEVEL REPEATABLE READ;
 SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='90s';SELECT pg_advisory_xact_lock(60906174800);
 DO $guard$ BEGIN IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='${version}') THEN RAISE EXCEPTION 'Migration already applied'; END IF; END $guard$;
 CREATE TEMP TABLE business_before ON COMMIT DROP AS ${fingerprints};
 ${body}
 ${probe}
 CREATE TEMP TABLE business_after ON COMMIT DROP AS ${fingerprints};
 DO $checks$ BEGIN
  IF EXISTS(SELECT * FROM business_before EXCEPT SELECT * FROM business_after) OR EXISTS(SELECT * FROM business_after EXCEPT SELECT * FROM business_before) THEN RAISE EXCEPTION 'Existing business records changed'; END IF;
  IF EXISTS(SELECT 1 FROM public.snp_comptoir_dossiers) OR EXISTS(SELECT 1 FROM public.snp_comptoir_documents) THEN RAISE EXCEPTION 'Unexpected company data'; END IF;
 END $checks$;
 ${mode==='apply'?`INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('${version}','dossiers_comptoirs_entreprises',ARRAY[${quote(sql)}]);COMMIT;`:'ROLLBACK;'}
 SELECT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='${version}') AS recorded;`,mode)[0];
 assert.equal(result.recorded,mode==='apply');
 if(mode==='rehearse')assert.deepEqual(query(schema,'after-rehearsal')[0].snapshot,before,'Rollback schema differs');
 const receipt={mode,project,source:{version,checksum},existingBusinessTablesUnchanged:tables.length,rollbackVerified:mode==='rehearse',realRpcRoundTrip:mode==='rehearse',at:new Date().toISOString()};
 writeFileSync(path.join(target,mode==='rehearse'?'rehearsal-receipt.json':'apply-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}
