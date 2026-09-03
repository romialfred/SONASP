import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here=dirname(fileURLToPath(import.meta.url));
const args=new Set(process.argv.slice(2));
const commit=args.has('--commit');
const linked=args.has('--linked');
if (commit && !linked) throw new Error('Un COMMIT est autorisé uniquement sur le projet lié explicitement.');
for (const flag of ['--development-confirmed','--dry-run-reviewed','--rollback-snapshot']) {
  if (commit && !args.has(flag)) throw new Error(`Le COMMIT exige ${flag}.`);
}
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
  "UPDATE public.snp_notifications_livraisons l SET statut='abandonne',message_erreur='HIST-2024-2026 : notification externe de développement non envoyée.' FROM public.snp_notifications n WHERE n.id=l.notification_id AND n.emise_par IN(SELECT pg_temp.seed_id('actor',i) FROM generate_series(1,7) i) AND l.canal IN('courriel','sms') AND l.statut='en_attente';",
  "UPDATE public.snp_workflow_notification_outbox SET status='cancelled',last_error='HIST-2024-2026 : aucune notification externe.' WHERE status='pending' AND (aggregate_id::text LIKE 'd8302026-%' OR payload->>'actor_id' LIKE 'd8302026-%');",
  "UPDATE public.user_profiles SET is_active=false WHERE id::text LIKE 'd8302026-%' AND email LIKE 'history-actor-%@example.invalid' AND is_active;",
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
if (commit) {
  const snapshotPath=resolve(here,'snapshot-before.sql');
  const snapshot=spawnSync(command,['db','query','--linked','--file',snapshotPath,'-o','json'],{
    encoding:'utf8',maxBuffer:4*1024*1024,timeout:120000,
  });
  const snapshotReceipt={timestamp:new Date().toISOString(),target:'yyverzuhkdonjjuficor',
    exitCode:snapshot.status,stdout:snapshot.stdout,stderr:snapshot.stderr};
  writeFileSync(resolve(output,'pre-commit-snapshot.json'),JSON.stringify(snapshotReceipt,null,2));
  if(snapshot.error || snapshot.status!==0) {
    console.error(snapshot.stderr || snapshot.error?.message || 'Échec de l’instantané pré-commit.');
    process.exit(1);
  }
}
const result=spawnSync(command,commandArgs,{input:linked?undefined:sql,encoding:'utf8',maxBuffer:12*1024*1024,timeout:240000});
const receipt={timestamp:new Date().toISOString(),target:linked?'yyverzuhkdonjjuficor':'sonasp_seed_validation_live_20260830',commit,
  exitCode:result.status,stdout:result.stdout,stderr:result.stderr};
writeFileSync(resolve(output,`${linked?'linked':'local'}-${commit?'commit':'dry-run'}.json`),JSON.stringify(receipt,null,2));
let documents=[];
try {
  const payload=JSON.parse(result.stdout||'{}');
  const documentCell=(payload.rows||[])
    .flatMap(row=>Object.values(row))
    .find(value=>typeof value==='string' && value.startsWith('SEED_DOCUMENTS:'));
  if(documentCell) documents=JSON.parse(documentCell.slice('SEED_DOCUMENTS:'.length));
} catch {
  const documentLine=(result.stdout||'').split('\n').find(line=>line.startsWith('SEED_DOCUMENTS:'));
  if(documentLine) documents=JSON.parse(documentLine.slice('SEED_DOCUMENTS:'.length));
}
if(documents.length) {
  writeFileSync(resolve(output,'documents.json'),JSON.stringify(documents,null,2));
  console.log(`Document manifest: ${documents.length} documents`);
}
console.log(result.stdout||'');
console.error(result.stderr || '');
if(result.error) console.error(result.error.message);
process.exitCode=result.status ?? 1;
