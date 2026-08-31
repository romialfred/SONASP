// Read-only snapshot and function-body comparison for recent release migrations.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
const [cli,folder]=process.argv.slice(2);
if (!cli || !folder) throw new Error('CLI and audit folder required');
const sql=`SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'signature',p.oid::regprocedure::text,'body',p.prosrc,'definition',pg_get_functiondef(p.oid),'acl',p.proacl)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'),
 'columns',(SELECT jsonb_agg(to_jsonb(c)) FROM information_schema.columns c WHERE table_schema='public'),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',c.conname,'definition',pg_get_constraintdef(c.oid))) FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public'),
 'policies',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname='public'),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid))) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal)
) snapshot;`;
const raw=execFileSync(cli,['db','query','--linked',sql,'-o','json'],{encoding:'utf8',timeout:60000,maxBuffer:40*1024*1024,stdio:['ignore','pipe','pipe']});
const snapshot=JSON.parse(raw.slice(raw.indexOf('{'))).rows[0].snapshot;
writeFileSync(path.join(folder,'schema-before.json'),JSON.stringify(snapshot,null,2));
const files=readdirSync('supabase/migrations').filter((f)=>f>='20260827190000' && /^202608\d{8}_/.test(f)).sort();
const latest=new Map();
const definitions=new Map();
const normalize=(s)=>s.replace(/\r\n?/g,'\n').trim();
for(const file of files) {
  const source=readFileSync(path.join('supabase/migrations',file),'utf8');
  const list=[];
  const pattern=/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.(\w+)[\s\S]*?\bAS\s+(\$\w*\$)([\s\S]*?)\2\s*;/gi;
  for(const m of source.matchAll(pattern)) { const def={name:m[1],body:normalize(m[3]),file}; list.push(def); latest.set(def.name,def); }
  definitions.set(file,list);
}
const baseline=JSON.parse(readFileSync(path.join(folder,'baseline.json'),'utf8'));
const results=baseline.missing.filter((f)=>f>='20260827190000').map((file)=>({file,functions:(definitions.get(file)??[]).map((d)=>{
  const live=snapshot.functions.filter((f)=>f.name===d.name);
  const expected=latest.get(d.name);
  return {name:d.name,present:live.length>0,matchesThis:live.some((f)=>normalize(f.body)===d.body),matchesLatest:live.some((f)=>normalize(f.body)===expected.body),latestFile:expected.file};
})}));
writeFileSync(path.join(folder,'schema-comparison.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
