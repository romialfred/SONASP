import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const [mode,cli,folder]=process.argv.slice(2),project='yyverzuhkdonjjuficor',slug='sensitive-upload';
assert.ok(['backup','deploy'].includes(mode)&&cli&&folder);
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),project);
const target=path.resolve(folder);assert.ok(target.startsWith(path.resolve('backups')+path.sep));mkdirSync(target,{recursive:true});
const run=args=>execFileSync(cli,args,{encoding:'utf8',timeout:120000,maxBuffer:12*1024*1024,stdio:['ignore','pipe','pipe']});
const hash=s=>createHash('sha256').update(s.replace(/\r\n?/g,'\n').trim()).digest('hex');
const parse=s=>JSON.parse(s.slice(s.search(/[\[{]/)));
const files=new Set();
function visit(file){if(files.has(file))return;files.add(file);const src=readFileSync(path.join('supabase/functions',file),'utf8');for(const match of src.matchAll(/from\s+["'](\.[^"']+\.ts)["']/g))visit(path.normalize(path.join(path.dirname(file),match[1])));}
visit('sensitive-upload/index.ts');
const current=[...files].map(file=>({file:file.replaceAll('\\','/'),sha256:hash(readFileSync(path.join('supabase/functions',file),'utf8'))}));
const versions=()=>parse(run(['functions','list','--project-ref',project,'-o','json']));
if(mode==='backup'){
 assert.ok(!existsSync(path.join(target,'upload-source.json')),'Backup already exists');
 const baseline=versions();writeFileSync(path.join(target,'edge-before.json'),JSON.stringify(baseline,null,2));
 const before=path.join(target,'edge-before');mkdirSync(before,{recursive:true});run(['functions','download',slug,'--project-ref',project,'--use-api','--workdir',before]);
 for(const item of current){if(['sensitive-upload/index.ts','_shared/comptoir-document-upload.ts'].includes(item.file))continue;const old=path.join(before,'supabase/functions',item.file);assert.ok(existsSync(old),'Missing deployed dependency '+item.file);assert.equal(hash(readFileSync(old,'utf8')),item.sha256,'Unrelated gateway change '+item.file);}
 writeFileSync(path.join(target,'upload-source.json'),JSON.stringify(current,null,2));console.log(JSON.stringify({mode,slug,previousVersion:baseline.find(f=>f.slug===slug)?.version,unchangedDependencies:current.length-2}));
}else{
 assert.deepEqual(JSON.parse(readFileSync(path.join(target,'upload-source.json'),'utf8')),current,'Source changed after review');
 const sqlReceipt=JSON.parse(readFileSync(path.join(target,'apply-receipt.json'),'utf8'));assert.equal(sqlReceipt.source.version,'20260906174800');
 try{writeFileSync(path.join(target,'upload-deploy.log'),run(['functions','deploy',slug,'--project-ref',project,'--use-api']));}catch(error){writeFileSync(path.join(target,'upload-deploy-error.log'),String(error.stderr||error.message));throw new Error('Upload deployment failed; verify version before retrying.');}
 const after=path.join(target,'edge-after');mkdirSync(after,{recursive:true});run(['functions','download',slug,'--project-ref',project,'--use-api','--workdir',after]);
 for(const item of current)assert.equal(hash(readFileSync(path.join(after,'supabase/functions',item.file),'utf8')),item.sha256,'Published source mismatch '+item.file);
 const deployed=versions().find(f=>f.slug===slug);const receipt={slug,version:deployed.version,status:deployed.status,verifiedFiles:current.length,at:new Date().toISOString()};writeFileSync(path.join(target,'upload-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}
