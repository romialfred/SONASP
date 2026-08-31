import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const [mode,cli,confirmation]=process.argv.slice(2);
if(!['rehearse','apply'].includes(mode)||!cli) throw new Error('Usage: rehearse|apply CLI confirmation');
if(mode==='apply'&&confirmation!=='DELETE-PERMANENTLY:otingueri@gmail.com') throw new Error('Confirmation exacte requise');
if(readFileSync('supabase/.temp/project-ref','utf8').trim()!=='yyverzuhkdonjjuficor') throw new Error('Projet inattendu');
const dir=mkdtempSync(path.join(tmpdir(),'sonasp-account-deletion-'));
const file=path.join(dir,`${mode}.sql`);
writeFileSync(file,`BEGIN ISOLATION LEVEL SERIALIZABLE;\n${readFileSync('scripts/account-deletion/delete-authorized-account.sql','utf8')}\n${mode==='apply'?'COMMIT':'ROLLBACK'};`,{mode:0o600});
try {
 const output=execFileSync(cli,['db','query','--linked','--file',file,'-o','json'],{
  encoding:'utf8',timeout:90000,maxBuffer:2*1024*1024,stdio:['ignore','pipe','pipe']});
 const result=JSON.parse(output.slice(output.indexOf('{')));
 const receipt={mode,checkedAt:new Date().toISOString(),evidenceDirectory:dir,rows:result.rows};
 writeFileSync(`output/account-deletion-${mode}.json`,JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify(receipt,null,2));
} catch(error) {
 console.error(String(error.stderr||error.message));
 console.error('Ne pas relancer sans vérifier le compte et le journal d’audit. Dossier : '+dir);
 process.exitCode=1;
}
