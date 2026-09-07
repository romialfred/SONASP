// Correction bornée de l'ordre des agrégats ; aucune exécution SQL.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const folder='docs/amelioration/environnement/reprise-r02';
const read=file=>fs.readFileSync(`${folder}/${file}`,'utf8');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const v1=read('cleanup-candidate.sql');
assert.equal(hash(v1),'3da1169b8d0497d277c12aed2715bbca099c096692d0ac520a55fd2161238650');
const fix=sql=>sql.replaceAll('ORDER BY t.id','ORDER BY to_jsonb(t)::text COLLATE "C"');
assert.equal(v1.split('ORDER BY t.id').length-1,28);
const candidate=fix(v1);
const postflight=fix(read('cleanup-postflight.sql'));
assert.equal((candidate.match(/DELETE FROM /g)||[]).length,2);
assert.equal((postflight.match(/ORDER BY to_jsonb\(t\)::text COLLATE "C"/g)||[]).length,14);
// Même bloc de garde et mêmes expressions avant/après, mais aucune instruction de suppression.
// Les deux agrégats sont réellement évalués ; aucun remplacement par une valeur constante.
const doStart=candidate.indexOf('DO $cleanup$');
const beforeEnd=candidate.indexOf('  DELETE FROM public.artisanal_site_assignments');
const afterStart=candidate.indexOf('  after_preservation :=');
const doEnd=candidate.indexOf('END; $cleanup$;')+'END; $cleanup$;'.length;
assert.ok(doStart>0 && beforeEnd>doStart && afterStart>beforeEnd && doEnd>afterStart);
const guardBlock=candidate.slice(doStart,beforeEnd)+candidate.slice(afterStart,doEnd);
const readonly=`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
${guardBlock}
SELECT jsonb_build_object('checked_at',clock_timestamp(),'read_only',current_setting('transaction_read_only'),
 'run_prefix','QA20260907-R02','guards_passed',true,'before_and_after_expressions_evaluated',true,
 'remaining_site',(SELECT count(*) FROM public.artisanal_sites WHERE id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid),
 'remaining_assignments',(SELECT count(*) FROM public.artisanal_site_assignments WHERE site_id='d9f7160a-aadd-41d9-ad4d-c9f886d41e0c'::uuid)) AS cleanup_readonly_validation;
ROLLBACK;
`;
assert.doesNotMatch(readonly,/DELETE FROM |LOCK TABLE |CREATE TABLE |ALTER TABLE /);
assert.match(postflight,/^BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;/);
const entries={'cleanup-candidate-v2.sql':candidate,'cleanup-postflight-v2.sql':postflight,'cleanup-validate-v2.sql':readonly};
for(const [file,sql] of Object.entries(entries)) fs.writeFileSync(`${folder}/${file}`,sql,{flag:'wx'});
const previousPlan=JSON.parse(read('cleanup-plan.json'));
const plan={...previousPlan,preparedAt:new Date().toISOString(),version:2,executed:false,
 changes:['28 agrégats candidat et 14 agrégats postflight : ORDER BY t.id remplacé par ORDER BY to_jsonb(t)::text COLLATE "C"'],
 originalCandidateSha256:hash(v1),candidateSha256:hash(candidate),postflightSha256:hash(postflight),readonlySha256:hash(readonly),
 sourceGuardsUnchanged:true,deleteStatementsUnchanged:true,preExecutionReadOnlyValidation:'En attente'};
fs.writeFileSync(`${folder}/cleanup-plan-v2.json`,JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({preparedOnly:true,candidateSha256:plan.candidateSha256,postflightSha256:plan.postflightSha256,readonlySha256:plan.readonlySha256}));
