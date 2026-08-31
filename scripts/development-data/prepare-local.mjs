// Fresh, isolated validation database. Never resets or connects to a remote database.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const container='supabase_db_SONASP-local-mirror';
const database='sonasp_seed_validation_live_20260830';
const schema=process.argv[2];
if (!schema) throw new Error('Provide the path to the observed public schema dump.');
function docker(args,input) {
  const result=spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:40*1024*1024,timeout:120000});
  if(result.status!==0) throw new Error(result.stderr||result.error?.message||'Docker command failed');
  return result.stdout;
}
const existing=docker(['exec',container,'psql','-X','-U','supabase_admin','-d','postgres','-t','-A','-c',`SELECT 1 FROM pg_database WHERE datname='${database}'`]);
const resume=process.argv.includes('--resume-public');
const migrationsOnly=process.argv.includes('--migrations-only');
if(existing.trim() && !resume && !migrationsOnly) throw new Error('Validation database already exists; it will not be overwritten.');
const supportArgs=['exec',container,'pg_dump','-U','supabase_admin','-d','postgres','--schema-only','--schema=auth','--schema=storage','--schema=extensions'];
if(!existing.trim()) docker(['exec',container,'createdb','-U','supabase_admin','-O','postgres',database]);
const psql=['exec','-i',container,'psql','-X','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d',database];
docker(psql,`ALTER DATABASE ${database} OWNER TO postgres;`);
if(!migrationsOnly) {
if(resume) {
  const tables=docker(['exec',container,'psql','-X','-U','supabase_admin','-d',database,'-t','-A','-c',"SELECT count(*) FROM pg_tables WHERE schemaname='public'"]);
  if(tables.trim()!=='0') throw new Error('Cannot resume: public schema is not empty.');
} else docker(psql,docker([...supportArgs,'--section=pre-data']));
docker(psql,'CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;');
const supportPost=docker([...supportArgs,'--section=post-data']);
const policies=[...supportPost.matchAll(/CREATE POLICY[\s\S]*?;\r?\n/g)].map(match=>match[0]);
const hasAuthPk=docker(['exec',container,'psql','-X','-U','supabase_admin','-d',database,'-t','-A','-c',"SELECT count(*) FROM pg_constraint WHERE conrelid='auth.users'::regclass AND contype='p'"]);
if(hasAuthPk.trim()==='0') docker(psql,'BEGIN;\n'+supportPost.replace(/CREATE POLICY[\s\S]*?;\r?\n/g,'')+'\nCOMMIT;');
docker(psql,'BEGIN;\n'+readFileSync(resolve(schema),'utf8')+'\nCOMMIT;');
docker(psql,policies.join('\n'));
}
for(const migration of ['20260829204000_durcir_grand_livre_stock_reserve.sql','20260830120000_fiabiliser_conciliation_expeditions_et_impacts.sql']) {
  // Local migrations only, owned like the observed remote SECURITY DEFINER functions.
  docker(psql,'SET ROLE postgres;\n'+readFileSync(resolve('supabase/migrations',migration),'utf8'));
}
console.log(`Prepared ${database}; remote database unchanged.`);
