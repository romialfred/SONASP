// Atomic, explicitly scoped forward deployment; no migration-history repair.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
const [mode, cli, folder] = process.argv.slice(2);
if (!['inspect', 'rehearse', 'apply'].includes(mode) || !cli || !folder) throw new Error('mode CLI audit-folder required');
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'yyverzuhkdonjjuficor') throw new Error('Unexpected project');
for (const f of ['public-before.sql','public-data-before.sql']) if (statSync(path.join(folder,f)).size < 10000) throw new Error('Backup missing');
const quote = s => "'" + String(s).replaceAll("'", "''") + "'";
const digest = s => createHash('sha256').update(s.replace(/\r\n?/g,'\n')).digest('hex');
const cliCommand = process.platform === 'win32' && /\.cmd$/i.test(cli)
  ? process.execPath
  : cli;
const cliPrefix = process.platform === 'win32' && /\.cmd$/i.test(cli)
  ? [path.resolve(path.dirname(cli),'..','supabase','dist','supabase.js')]
  : [];
const catalogue = JSON.parse(readFileSync('supabase/migrations.catalogue.json','utf8'));
const migrations = JSON.parse(readFileSync('scripts/release/full-release-spec.json','utf8')).map(name => {
  const file = 'supabase/migrations/' + name;
  const sql = readFileSync(file,'utf8');
  const checksum = digest(sql);
  if (catalogue.files.find(f=>f.path===file)?.sha256 !== checksum) throw new Error('Catalogue mismatch: '+name);
  if ((sql.match(/^BEGIN;\s*$/gm)||[]).length!==1 || (sql.match(/^COMMIT;\s*$/gm)||[]).length!==1) throw new Error('Unexpected transaction: '+name);
  return {name,version:name.slice(0,14),checksum,sql,body:sql.replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,'')};
});
const versions = migrations.map(m=>quote(m.version)).join(',');
function query(sql,label) {
  const file = path.join(folder,label+'.sql');
  writeFileSync(file,sql);
  try {
    const raw = execFileSync(cliCommand,[...cliPrefix,'db','query','--linked','--file',file,'-o','json'],{encoding:'utf8',timeout:120000,maxBuffer:20*1024*1024,stdio:['ignore','pipe','pipe']});
    const rows = JSON.parse(raw.slice(raw.indexOf('{'))).rows;
    writeFileSync(path.join(folder,label+'.json'),JSON.stringify(rows,null,2));
    return rows;
  } catch(e) {
    writeFileSync(path.join(folder,label+'.error.txt'),String(e.stderr || e.message));
    throw new Error(label+' failed. Inspect private log and history before retry.');
  }
}
const protectedFunctions = ['snp_role_rank','snp_configurer_acces_compte','snp_validate_responsibilities','snp_actor_has_capability','snp_user_permission_allowed','snp_is_owner','snp_can_administer_accounts'];
const snapshotSql = `SELECT jsonb_build_object('versions',(SELECT coalesce(jsonb_agg(version ORDER BY version),'[]') FROM supabase_migrations.schema_migrations WHERE version IN(${versions})),
 'owner_active',EXISTS(SELECT 1 FROM public.user_profiles WHERE email='romuald.tiegnan@gmail.com' AND role='owner' AND is_active),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'hash',md5(pg_get_functiondef(p.oid))) ORDER BY p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN(${protectedFunctions.map(quote)}))) snapshot;`;
const before = query(snapshotSql,mode+'-before')[0].snapshot;
if (!before.owner_active || before.versions.length) throw new Error('Unexpected baseline; stop.');
const mutableRelations = [
  'freight_shipments','shipping_preparations','export_licenses',
  'freight_shipment_signatories',
  'snp_export_license_reservations','snp_conciliations',
  'snp_grand_livre_commercial','reserve_allocations','sales',
];
const excluded = [
  'inventory_transactions','gold_inventory','snp_data_quality_issues',
  'snp_sod_legacy_review','snp_role_module_ceilings','snp_role_capabilities',
  'snp_rpc_execution_allowlist','snp_account_deletion_dependency_registry',
  'snp_capability_catalog','snp_achats_audit',...mutableRelations,
];
const fingerprint = `CREATE FUNCTION pg_temp.release_fingerprints() RETURNS TABLE(relation text,row_count bigint,checksum text) LANGUAGE plpgsql AS $fp$ DECLARE item record; BEGIN
 FOR item IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p') AND c.relname NOT IN(${excluded.map(quote)}) ORDER BY c.relname LOOP
 RETURN QUERY EXECUTE format('SELECT %L::text,count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'''' ORDER BY md5(to_jsonb(t)::text)),'''')) FROM public.%I t',item.relname,item.relname);
 END LOOP; END $fp$;`;
const mutableCounts = `CREATE FUNCTION pg_temp.release_mutable_counts() RETURNS TABLE(relation text,row_count bigint) LANGUAGE plpgsql AS $mc$ DECLARE item text; BEGIN
 FOR item IN SELECT unnest(ARRAY[${mutableRelations.map(quote)}]) LOOP
   IF to_regclass('public.'||item) IS NOT NULL THEN
     RETURN QUERY EXECUTE format('SELECT %L::text,count(*) FROM public.%I',item,item);
   END IF;
 END LOOP; END $mc$;`;
const guard = `DO $g$ BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version IN(${versions})) THEN RAISE EXCEPTION 'Already recorded'; END IF;
 ${before.functions.map(f=>`IF md5(pg_get_functiondef(${quote(f.signature)}::regprocedure)) IS DISTINCT FROM ${quote(f.hash)} THEN RAISE EXCEPTION 'Protected IAM function changed'; END IF;`).join('\n')}
 END $g$;`;
const immutableDataGuard = mode === 'inspect' ? '' : "IF EXISTS(SELECT * FROM release_before EXCEPT SELECT a.* FROM pg_temp.release_fingerprints() a JOIN release_before b USING(relation)) THEN RAISE EXCEPTION 'Business/account data changed'; END IF;";
const checks = `DO $c$ BEGIN
 ${immutableDataGuard}
 IF EXISTS(SELECT * FROM release_mutable_before EXCEPT SELECT * FROM pg_temp.release_mutable_counts()) OR EXISTS(SELECT * FROM pg_temp.release_mutable_counts() EXCEPT SELECT * FROM release_mutable_before) THEN RAISE EXCEPTION 'A reconciliation changed the number of business rows'; END IF;
 IF EXISTS(SELECT 1 FROM public.inventory_transactions WHERE transaction_type='entry' GROUP BY inventory_id HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate entries remain'; END IF;
 IF (SELECT count(*) FROM public.gold_inventory)<>(SELECT count(*) FROM release_stock_before) OR EXISTS(SELECT id,final_fine_grams,quantity_allocated_oz,quantity_sold_oz,quantity_national_reserve_oz FROM release_stock_before EXCEPT SELECT id,final_fine_grams,quantity_allocated_oz,quantity_sold_oz,quantity_national_reserve_oz FROM public.gold_inventory) THEN RAISE EXCEPTION 'Physical assets changed'; END IF;
 IF has_table_privilege('authenticated','public.gold_inventory','UPDATE') OR has_table_privilege('authenticated','public.inventory_transactions','DELETE') THEN RAISE EXCEPTION 'Stock direct mutations remain'; END IF;
 IF (SELECT count(*) FROM public.snp_role_module_ceilings WHERE role='admin' AND can_view AND can_create AND can_edit AND can_delete AND can_approve)<>18 THEN RAISE EXCEPTION 'Admin ceiling regressed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.snp_access_role_policies WHERE role='owner' AND NOT is_legacy) THEN RAISE EXCEPTION 'Owner unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM public.shipping_production_items item JOIN public.shipping_preparations preparation ON preparation.id=item.shipping_preparation_id JOIN public.daily_production production ON production.id=item.daily_production_id WHERE preparation.mining_company_id IS NULL OR production.mining_company_id IS NULL OR preparation.mining_company_id IS DISTINCT FROM production.mining_company_id) THEN RAISE EXCEPTION 'Shipping tenant scope remains inconsistent'; END IF;
 IF EXISTS(SELECT 1 FROM public.shipping_production_items item JOIN public.daily_production production ON production.id=item.daily_production_id GROUP BY production.id,production.bullion_grams,production.pure_gold_grams,production.estimated_fineness_pct HAVING sum(item.net_weight_grams)>production.bullion_grams+0.0001 OR sum(item.pure_gold_grams)>least(production.bullion_grams,coalesce(production.pure_gold_grams,production.bullion_grams*production.estimated_fineness_pct/100.0))+0.0001) THEN RAISE EXCEPTION 'Shipping over-allocation remains'; END IF;
 IF EXISTS(SELECT 1 FROM public.snp_grand_livre_commercial entry JOIN public.snp_conciliations conciliation ON conciliation.id=entry.conciliation_id JOIN public.sales sale ON sale.id=conciliation.sale_id WHERE entry.type_mouvement='ajustement_conciliation' AND (entry.devise IS DISTINCT FROM conciliation.devise_finale OR conciliation.devise_initiale IS DISTINCT FROM conciliation.devise_finale OR sale.currency IS DISTINCT FROM conciliation.devise_finale)) THEN RAISE EXCEPTION 'Conciliation currency remains inconsistent'; END IF;
 IF EXISTS(SELECT 1 FROM public.sales sale WHERE sale.payment_amount IS DISTINCT FROM coalesce((SELECT round(sum(payment.amount),2) FROM public.payments payment WHERE payment.sale_id=sale.id AND NOT payment.is_virtual AND payment.status IN('processing','approved')),0)) THEN RAISE EXCEPTION 'Sale payment summary is inconsistent'; END IF;
 IF to_regprocedure('public.snp_activate_reserve_allocation(uuid,uuid,text)') IS NULL OR has_function_privilege('anon','public.snp_activate_reserve_allocation(uuid,uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'Reserve activation contract is unsafe'; END IF;
 IF to_regprocedure('public.snp_lots_vente_export_eligibles()') IS NULL OR has_function_privilege('anon','public.snp_lots_vente_export_eligibles()','EXECUTE') THEN RAISE EXCEPTION 'Eligible sale-lot contract is unsafe'; END IF;
 IF to_regprocedure('public.snp_authorize_scoped_action(text,uuid)') IS NULL OR to_regprocedure('public.snp_guard_refining_approval()') IS NULL THEN RAISE EXCEPTION 'Required helpers missing'; END IF;
 END $c$;`;
const sql = ["BEGIN ISOLATION LEVEL REPEATABLE READ; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='45s';",
 "SELECT pg_advisory_xact_lock(hashtextextended('sonasp-full-release-20260901',0));",guard,fingerprint,mutableCounts,
 'CREATE TEMP TABLE release_before ON COMMIT DROP AS SELECT * FROM pg_temp.release_fingerprints();',
 'CREATE TEMP TABLE release_mutable_before ON COMMIT DROP AS SELECT * FROM pg_temp.release_mutable_counts();',
 'CREATE TEMP TABLE release_stock_before ON COMMIT DROP AS SELECT * FROM public.gold_inventory;',
 ...migrations.map(m=>m.body),'SET CONSTRAINTS ALL IMMEDIATE;',checks,guard,
 ...(mode==='apply'?migrations.map(m=>`INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES(${quote(m.version)},${quote(m.name.slice(15,-4))},ARRAY[${quote(m.sql)}]);`):[]),
 `SELECT jsonb_build_object('mode',${quote(mode)},'protected_tables',(SELECT count(*) FROM release_before),'physical_assets_unchanged',true,'owner_admin_unchanged',true,'unexpected_changes',(SELECT coalesce(jsonb_agg(jsonb_build_object('relation',before.relation,'before_count',before.row_count,'after_count',after.row_count,'before_checksum',before.checksum,'after_checksum',after.checksum) ORDER BY before.relation),'[]'::jsonb) FROM release_before before JOIN pg_temp.release_fingerprints() after USING(relation) WHERE (before.row_count,before.checksum) IS DISTINCT FROM (after.row_count,after.checksum))) validation;`,
 mode==='apply'?'COMMIT;':'ROLLBACK;'].join('\n');
console.log(JSON.stringify({mode,migrations:migrations.map(({name,checksum})=>({name,checksum})),backup:folder}));
const result = query(sql,mode+'-transaction');
const after = query(snapshotSql,mode+'-after')[0].snapshot;
if (!after.owner_active || after.versions.length!==(mode==='apply'?migrations.length:0) || JSON.stringify(before.functions)!==JSON.stringify(after.functions)) throw new Error('Postflight failed; inspect history.');
writeFileSync(path.join(folder,mode+'-receipt.json'),JSON.stringify({project:'yyverzuhkdonjjuficor',mode,at:new Date().toISOString(),migrations:migrations.map(({name,checksum})=>({name,checksum})),result,after},null,2));
console.log(JSON.stringify({completed:mode,result,versions:after.versions}));
