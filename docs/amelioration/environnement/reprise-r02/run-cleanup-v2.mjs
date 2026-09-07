// Exécution unique explicitement autorisée par le principal après revue du SHA.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
assert.equal(process.argv[2], '--execute-approved-candidate');
const folder=path.resolve('docs/amelioration/environnement/reprise-r02');
const sqlFile=path.join(folder,'cleanup-candidate-v2.sql');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const expected='7420606a3828626d652dfd79887f89da1cfc90b3865478e1af520901743a5a73';
assert.equal(sha(sqlFile),expected,'Candidate différente du SQL explicitement autorisé');
assert.equal(fs.readFileSync('supabase/.temp/project-ref','utf8').trim(),'yyverzuhkdonjjuficor');
const receiptFile=path.join(folder,'cleanup-execution-v2.json');
const resultFile=path.join(folder,'cleanup-result-v2.json');
assert.ok(!fs.existsSync(receiptFile) && !fs.existsSync(resultFile),'Exécution déjà tentée : aucun retry automatique');
const lock=path.join(folder,'.sql-read.lock');
const fd=fs.openSync(lock,'wx');
const receipt={startedAt:new Date().toISOString(),projectRef:'yyverzuhkdonjjuficor',candidateSha256:expected,
 wrapperSha256:sha(new URL(import.meta.url)),
 command:'supabase 2.115.0 db query --linked --file cleanup-candidate-v2.sql -o json',
 scope:'Suppression unique du site d9f7160a-aadd-41d9-ad4d-c9f886d41e0c et ses deux responsables exacts',
 authorizedBy:'Instruction séparée du principal après revue du fichier et du SHA',exitCode:null};
fs.writeFileSync(receiptFile,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
let failed=false;
try {
  assert.equal(sha(sqlFile),expected);
  const cli='C:/Users/romia/AppData/Local/npm-cache/_npx/66b4952730d9cac8/node_modules/@supabase/cli-windows-x64/bin/supabase.exe';
  const raw=execFileSync(cli,['db','query','--linked','--file',sqlFile,'-o','json'],{encoding:'utf8',timeout:90000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
  const result=JSON.parse(raw.slice(raw.indexOf('{')));
  fs.writeFileSync(resultFile,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  receipt.exitCode=0;
} catch(error) {
  failed=true;
  receipt.exitCode=typeof error.status==='number'?error.status:null;
  receipt.error=String(error.stderr||error.message).replace(/postgres(?:ql)?:\/\/\S+/gi,'[connexion expurgée]')
    .replace(/Bearer\s+\S+|sbp_[A-Za-z0-9]+|eyJ[A-Za-z0-9_.-]+/g,'[secret expurgé]').slice(0,1800);
} finally {
  receipt.finishedAt=new Date().toISOString();
  fs.writeFileSync(receiptFile,JSON.stringify(receipt,null,2)+'\n');
  fs.closeSync(fd);fs.unlinkSync(lock);
}
console.log(JSON.stringify({exitCode:receipt.exitCode,resultFile,postflightStillRequired:true}));
if(failed) process.exitCode=1;
