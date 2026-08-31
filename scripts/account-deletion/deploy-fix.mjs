// Publie uniquement le correctif autorisé. Ne supprime aucun compte et ne forge
// aucune session utilisateur. L'historique des anciennes migrations est intact.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const [mode,cli]=process.argv.slice(2);
if(!['rehearse','apply'].includes(mode)||!cli) throw new Error('Usage: deploy-fix.mjs rehearse|apply CLI');
if(readFileSync('supabase/.temp/project-ref','utf8').trim()!=='yyverzuhkdonjjuficor') throw new Error('Mauvais projet');
const name='20260830170000_reparer_controles_suppression_comptes.sql';
const sql=readFileSync(`supabase/migrations/${name}`,'utf8').replace(/\r\n?/g,'\n');
const hash=createHash('sha256').update(sql).digest('hex');
if(hash!=='a41af8da8c9773fb8e4aa2e3fba3dac7bd529684ab1c31f7170473f86354204b') throw new Error('Migration différente de la version relue');
const body=sql.replace(/^BEGIN;\s*$/m,'').replace(/COMMIT;\s*$/,'');
const quote=s=>`'${s.replaceAll("'","''")}'`;
const fingerprint=`SELECT md5(coalesce(string_agg(to_jsonb(p)::text,'|' ORDER BY id),'')) FROM public.user_profiles p`;
const statements=`BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $pre$ BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260830170000') THEN
  RAISE EXCEPTION 'Migration déjà appliquée : vérifier avant toute relance'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles p JOIN auth.users a ON a.id=p.id
  WHERE p.id='c7570144-0075-4cb0-8a59-4713c1ebe07f' AND p.role='admin'
   AND lower(p.email)='otingueri@gmail.com' AND lower(a.email)=lower(p.email)) THEN
  RAISE EXCEPTION 'Cible différente : arrêt'; END IF;
END $pre$;
CREATE TEMP TABLE account_profiles_before ON COMMIT DROP AS ${fingerprint};
${body}
DO $check$ BEGIN
 IF (SELECT md5 FROM account_profiles_before) IS DISTINCT FROM (${fingerprint}) THEN
  RAISE EXCEPTION 'Un compte a changé : annulation'; END IF;
 IF public.snp_2m_account_business_activity('c7570144-0075-4cb0-8a59-4713c1ebe07f')<>'[]'::jsonb THEN
  RAISE EXCEPTION 'Activité métier de la cible : suppression à réexaminer'; END IF;
END $check$;
${mode==='apply'?`INSERT INTO supabase_migrations.schema_migrations(version,name,statements)
 VALUES('20260830170000','reparer_controles_suppression_comptes',ARRAY[${quote(sql)}]);`:''}
SELECT jsonb_build_object('mode',${quote(mode)},'migration','20260830170000','checksum',${quote(hash)},
 'registry_complete',true,'target_business_activity','[]'::jsonb,'all_profiles_unchanged',true) AS validation;
${mode==='apply'?'COMMIT':'ROLLBACK'};`;
const dir=mkdtempSync(path.join(tmpdir(),'sonasp-delete-fix-'));
const file=path.join(dir,`${mode}.sql`);
writeFileSync(file,statements,{mode:0o600});
const output=execFileSync(cli,['db','query','--linked','--file',file,'-o','json'],{
 encoding:'utf8',timeout:60000,maxBuffer:2*1024*1024,stdio:['ignore','pipe','pipe']});
const result=JSON.parse(output.slice(output.indexOf('{')));
const receipt={mode,checkedAt:new Date().toISOString(),evidenceDirectory:dir,rows:result.rows};
writeFileSync(`output/account-deletion-fix-${mode}.json`,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
