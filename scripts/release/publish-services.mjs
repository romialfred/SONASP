// Publish explicit SONASP services; keep an individual source backup per version.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
const [cli, folder] = process.argv.slice(2);
const project = readFileSync('supabase/.temp/project-ref','utf8').trim();
if (!cli || !folder || project!=='yyverzuhkdonjjuficor') throw new Error('Unexpected deployment target');
const cliCommand = process.platform === 'win32' && /\.cmd$/i.test(cli)
  ? process.execPath
  : cli;
const cliPrefix = process.platform === 'win32' && /\.cmd$/i.test(cli)
  ? [path.resolve(path.dirname(cli),'..','supabase','dist','supabase.js')]
  : [];
const run = args => execFileSync(cliCommand,[...cliPrefix,...args],{encoding:'utf8',timeout:180000,maxBuffer:12*1024*1024,stdio:['ignore','pipe','pipe']});
const parse = raw => JSON.parse(raw.slice(raw.search(/[\[{]/)));
const baseline = parse(run(['functions','list','--project-ref',project,'-o','json']));
const secrets = parse(run(['secrets','list','--project-ref',project,'-o','json']));
const settings = {};
if (!secrets.some(s=>s.name==='PUBLIC_SITE_ORIGINS')) settings.PUBLIC_SITE_ORIGINS='https://sonasp.data-univers.com,https://sonasp.vercel.app';
if (!secrets.some(s=>s.name==='ASSISTANCE_HASH_SALT')) settings.ASSISTANCE_HASH_SALT=randomBytes(32).toString('hex');
if (Object.keys(settings).length) {
  const secretFile = path.join(folder,'generated-assistance-config.env');
  writeFileSync(secretFile,Object.entries(settings).map(([k,v])=>k+'='+v).join('\n'),{mode:0o600,flag:'wx'});
  try { run(['secrets','set','--project-ref',project,'--env-file',secretFile]); }
  catch { throw new Error('Secret configuration failed; values suppressed'); }
  finally { unlinkSync(secretFile); }
  console.log(JSON.stringify({configured:Object.keys(settings)}));
}
const targets = ['delete-user','revoke-user-sessions','envoyer-courriel','get-user-details','get-users','manage-user-status','reset-user-password','activate-account','public-assistance','fetch-daily-fx-rates','fetch-daily-lbma-prices','scheduled-tasks'];
const receipts=[];
const hash = s => createHash('sha256').update(s.replace(/\r\n?/g,'\n').trim()).digest('hex');
for (const slug of targets) {
  const old = baseline.find(f=>f.slug===slug);
  const backup = path.join(folder,'edge-before',slug);
  const verify = path.join(folder,'edge-after',slug);
  mkdirSync(backup,{recursive:true}); mkdirSync(verify,{recursive:true});
  if (old) run(['functions','download',slug,'--project-ref',project,'--use-api','--workdir',backup]);
  try { const log=run(['functions','deploy',slug,'--project-ref',project,'--use-api']); writeFileSync(path.join(folder,slug+'.deploy.log'),log); }
  catch(e) { writeFileSync(path.join(folder,slug+'.deploy.error.log'),String(e.stderr||e.message)); throw new Error('Deployment failed for '+slug+'; inspect version before retry'); }
  run(['functions','download',slug,'--project-ref',project,'--use-api','--workdir',verify]);
  const files=new Set();
  function visit(file) {
    if(files.has(file)) return; files.add(file);
    const src=readFileSync(path.join('supabase/functions',file),'utf8');
    for(const match of src.matchAll(/from\s+['"](\.[^'"]+\.ts)['"]/g)) visit(path.normalize(path.join(path.dirname(file),match[1])));
  }
  visit(slug+'/index.ts');
  const comparisons=[...files].map(file=>({file,sha256:hash(readFileSync(path.join('supabase/functions',file),'utf8')),remote:existsSync(path.join(verify,'supabase/functions',file))?hash(readFileSync(path.join(verify,'supabase/functions',file),'utf8')):null}));
  if(comparisons.some(c=>c.sha256!==c.remote)) throw new Error('Source mismatch after publish: '+slug);
  receipts.push({slug,previousVersion:old?.version??null,files:comparisons});
  writeFileSync(path.join(folder,'services-receipt.json'),JSON.stringify(receipts,null,2));
  console.log(JSON.stringify({published:slug,verifiedFiles:comparisons.length}));
}
const final=parse(run(['functions','list','--project-ref',project,'-o','json']));
writeFileSync(path.join(folder,'services-after.json'),JSON.stringify(final,null,2));
console.log(JSON.stringify({complete:true,functions:final.map(({slug,version,status})=>({slug,version,status}))}));
