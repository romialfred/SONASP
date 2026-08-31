import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const db='sonasp_seed_validation_live_20260830';
const run=sql=>execFileSync('docker',['exec','-i','supabase_db_SONASP-local-mirror','psql','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',maxBuffer:4*1024*1024});
const inspected=JSON.parse(readFileSync('output/account-deletion-inspection.json','utf8').replace(/^\uFEFF/,''));
const reviewed=inspected.rows.find(r=>r.section==='registry_drift').data;
const quote=s=>`'${s.replaceAll("'","''")}'`;
const pairs=reviewed.map(r=>`(${quote(r.table_name)},${quote(r.column_name)})`).join(',');
// Schema-only mirror has no registry rows. Reproduce the published missing entries.
console.log(run(`CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.snp_account_deletion_dependency_registry) THEN
 INSERT INTO public.snp_account_deletion_dependency_registry(
  schema_name,table_name,column_name,classification,constraint_name,
  referenced_schema_name,referenced_table_name,referenced_column_name,delete_action,source)
 SELECT schema_name,table_name,column_name,classification,constraint_name,
  referenced_schema_name,referenced_table_name,referenced_column_name,delete_action,source
 FROM public.snp_2m_current_dependency_inventory()
 WHERE (table_name,column_name) NOT IN (${pairs});
END IF; END $$;`));
console.log(run(readFileSync('supabase/migrations/20260830170000_reparer_controles_suppression_comptes.sql','utf8')));
for(const file of ['supabase/tests/account_deletion_dependencies_test.sql','supabase/tests/lot_2m_administration_comptes_contract_test.sql']) {
 const result=run(readFileSync(file,'utf8'));
 console.log(result);
 if(/not ok|Looks like you failed/i.test(result)) throw new Error(`Échec tests : ${file}`);
}
