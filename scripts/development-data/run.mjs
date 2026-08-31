import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here=dirname(fileURLToPath(import.meta.url));
const args=new Set(process.argv.slice(2));
const commit=args.has('--commit');
const linked=args.has('--linked');
// Keep publication unavailable until prerequisites, documents and remote dry-run
// have been approved and checked. The current deliverable is preparation only.
if (commit) throw new Error('Import non publié : correctifs serveur et pièces PDF à valider avant tout COMMIT.');
if (commit && !args.has('--development-confirmed')) throw new Error('Explicit --development-confirmed required');
const chapters=['seed-historical.sql'];
if (!args.has('--foundation-only')) chapters.push('seed-workflows.sql','seed-artisanal.sql');
const referenceSql=[];
if(!linked) {
  const refs=JSON.parse(readFileSync(resolve(here,'../../output/development-data/reference-data.json'),'utf8')).rows;
  for(const [section,table] of [['capabilities','snp_capability_catalog'],['management_capabilities','snp_role_capabilities']]) {
    let data=refs.find(row=>row.section===section)?.data||[];
    if(section==='management_capabilities') data=data.filter(row=>row.capability_code.startsWith('reserve.'));
    referenceSql.push(`INSERT INTO public.${table} SELECT * FROM jsonb_populate_recordset(NULL::public.${table},'${JSON.stringify(data).replaceAll("'","''")}'::jsonb) ON CONFLICT DO NOTHING;`);
  }
}
const sql=[
  'BEGIN;',
  "SET LOCAL sonasp.seed_project='yyverzuhkdonjjuficor-development-confirmed';",
  ...referenceSql,
  ...(linked?[]:["INSERT INTO public.mining_companies(id,code,name,country,company_type) SELECT 'd8302026-0000-4000-8000-000000000000','SONASP','SONASP - isolated fixture','Burkina Faso','institution' WHERE NOT EXISTS(SELECT 1 FROM public.mining_companies WHERE code='SONASP');"]),
  ...(linked?[]:["INSERT INTO public.snp_capability_catalog(code,domain,label,description,sensitive) SELECT code,'reconciliation',code,'Local fixture',false FROM unnest(ARRAY['reconciliation.create','reconciliation.edit','reconciliation.approve']) code ON CONFLICT DO NOTHING;"]),
  'CREATE TEMP TABLE seed_profile_baseline ON COMMIT DROP AS SELECT id,to_jsonb(p) AS payload FROM public.user_profiles p;',
  ...chapters.map(name=>readFileSync(resolve(here,name),'utf8')),
  "SELECT set_config('request.jwt.claims','{}',true);",
  "UPDATE public.snp_notifications_livraisons l SET statut='abandonne',message_erreur='TEST3Y-20260830 : notification externe de développement non envoyée.' FROM public.snp_notifications n WHERE n.id=l.notification_id AND n.emise_par IN(SELECT pg_temp.seed_id('actor',i) FROM generate_series(1,7) i) AND l.canal IN('courriel','sms') AND l.statut='en_attente';",
  "UPDATE public.snp_workflow_notification_outbox SET status='cancelled',last_error='TEST3Y-20260830 : aucune notification externe.' WHERE status='pending' AND (aggregate_id::text LIKE 'd8302026-%' OR payload->>'actor_id' LIKE 'd8302026-%');",
  "UPDATE public.user_profiles SET is_active=false WHERE id::text LIKE 'd8302026-%' AND email LIKE 'test3y-actor-%@example.invalid' AND is_active;",
  ...(!args.has('--foundation-only')?[readFileSync(resolve(here,'postflight.sql'),'utf8')]:[]),
  'SELECT * FROM seed_results;',
  ...(!args.has('--foundation-only')?["SELECT 'SEED_DOCUMENTS:'||coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb)::text FROM seed_documents d;"]:[]),
  commit?'COMMIT;':'ROLLBACK;',
].join('\n');
const output=resolve(here,'../../output/development-data');
mkdirSync(output,{recursive:true});
const sqlPath=resolve(output,commit?'historical-commit.sql':'historical-dry-run.sql');
writeFileSync(sqlPath,sql);
const command=linked
  ? (process.env.SUPABASE_CLI || 'C:/Users/romia/AppData/Local/npm-cache/_npx/b96a6bd565c470ce/node_modules/@supabase/cli-windows-x64/bin/supabase.exe')
  : 'docker';
const commandArgs=linked
  ? ['db','query','--linked','--file',sqlPath,'-o','json']
  : ['exec','-i','supabase_db_SONASP-local-mirror','psql','-X','-t','-A','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','sonasp_seed_validation_live_20260830'];
const result=spawnSync(command,commandArgs,{input:linked?undefined:sql,encoding:'utf8',maxBuffer:12*1024*1024,timeout:240000});
const receipt={timestamp:new Date().toISOString(),target:linked?'yyverzuhkdonjjuficor':'sonasp_seed_validation_live_20260830',commit,
  exitCode:result.status,stdout:result.stdout,stderr:result.stderr};
writeFileSync(resolve(output,`${linked?'linked':'local'}-${commit?'commit':'dry-run'}.json`),JSON.stringify(receipt,null,2));
const docLine=(result.stdout||'').split('\n').find(line=>line.startsWith('SEED_DOCUMENTS:'));
if(docLine) {
  const documents=JSON.parse(docLine.slice('SEED_DOCUMENTS:'.length));
  writeFileSync(resolve(output,'documents.json'),JSON.stringify(documents,null,2));
  console.log(`Document manifest: ${documents.length} documents`);
}
console.log((result.stdout||'').split('\n').filter(line=>!line.startsWith('SEED_DOCUMENTS:')).join('\n'));
console.error(result.stderr || '');
if(result.error) console.error(result.error.message);
process.exitCode=result.status ?? 1;
