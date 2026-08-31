// Read-only inventory. Saves snapshots outside the published application.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root = process.cwd();
const cli = process.argv[2];
if (!cli) throw new Error('Supabase CLI path required');
const project = readFileSync('supabase/.temp/project-ref','utf8').trim();
if (project !== 'yyverzuhkdonjjuficor') throw new Error('Unexpected project');
const folder = mkdtempSync(path.join(tmpdir(),'sonasp-full-release-'));
const hash = (s) => createHash('sha256').update(s.replace(/\r\n?/g,'\n').trim()).digest('hex');
const run = (args) => {
  try { return execFileSync(cli,args,{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:20*1024*1024,stdio:['ignore','pipe','pipe']}); }
  catch { throw new Error(`Read-only command failed: ${args.slice(0,2).join(' ')}`); }
};
const parse = (s) => JSON.parse(s.slice(s.search(/[\[{]/)));
const migrations = parse(run(['db','query','--linked','SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version','-o','json'])).rows;
const functions = parse(run(['functions','list','--project-ref',project,'-o','json']));
const localFiles = readdirSync('supabase/migrations').filter((f)=>/^202608\d{8}_.*\.sql$/.test(f));
const missing = localFiles.filter((f)=>!migrations.some((m)=>m.version===f.slice(0,14)));
writeFileSync(path.join(folder,'baseline.json'),JSON.stringify({project,migrations,functions,missing},null,2));
console.log(JSON.stringify({folder,missing,functions:functions.map(({slug,version})=>({slug,version}))}));
const comparisons=[];
for (const item of readdirSync('supabase/functions',{withFileTypes:true})) {
  if (!item.isDirectory() || item.name.startsWith('_')) continue;
  const entry=`${item.name}/index.ts`;
  if (!existsSync(path.join('supabase/functions',entry))) continue;
  const deployed=functions.find((f)=>f.slug===item.name);
  if (deployed) run(['functions','download',item.name,'--project-ref',project,'--use-api','--workdir',folder]);
  const files=new Set();
  function visit(file) {
    if (files.has(file)) return;
    files.add(file);
    const source=readFileSync(path.join(root,'supabase/functions',file),'utf8');
    for(const match of source.matchAll(/from\s+['"](\.[^'"]+\.ts)['"]/g)) visit(path.normalize(path.join(path.dirname(file),match[1])));
  }
  visit(entry);
  const changes=[...files].filter((f)=>!existsSync(path.join(folder,'supabase/functions',f)) || hash(readFileSync(path.join(root,'supabase/functions',f),'utf8'))!==hash(readFileSync(path.join(folder,'supabase/functions',f),'utf8')));
  const comparison={slug:item.name,version:deployed?.version??null,changedFiles:changes.map((f)=>f.replaceAll('\\','/'))};
  comparisons.push(comparison);
  console.log(JSON.stringify(comparison));
  writeFileSync(path.join(folder,'comparisons.json'),JSON.stringify(comparisons,null,2));
}
console.log(JSON.stringify({complete:true,folder}));
