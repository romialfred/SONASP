// Comparaison locale du postflight ; ne contacte jamais le serveur.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const folder='docs/amelioration/environnement/reprise-r02';
const [postflightFile, outputFile] = process.argv.slice(2);
assert.ok(postflightFile && outputFile, 'Usage: verify-cleanup.mjs postflight.json preuve.json');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const before=read(`${folder}/cleanup-preflight.json`).rows[0].cleanup_preflight;
const after=read(postflightFile).rows[0].cleanup_postflight;
const plan=read(`${folder}/cleanup-plan-v2.json`);
assert.equal(after.run_prefix,'QA20260907-R02');
assert.equal(after.remaining_site,0);
assert.equal(after.remaining_assignments,0);
const validatedBefore=read(folder+'/cleanup-postflight-v2-avant-delete.json').rows[0].cleanup_postflight;
assert.deepEqual(after.outside_preservation,validatedBefore.outside_preservation,'Données hors manifeste divergentes sur les quatorze tables');
assert.deepEqual(after.schema,before.schema,'Schéma modifié');
const removed=[];
for(const table of before.baseline.tables){
  const deleted=table.table_name==='artisanal_sites'?[plan.siteId]:table.table_name==='artisanal_site_assignments'?plan.contactIds:[];
  const current=after.baseline.tables.find(t=>t.table_name===table.table_name);
  assert.ok(current,`Table absente: ${table.table_name}`);
  const expectedRows=table.rows.filter(r=>!deleted.includes(r.id));
  assert.deepEqual(current.rows,expectedRows,`Données hors manifeste divergentes: ${table.table_name}`);
  assert.equal(current.row_count,table.row_count-deleted.length);
  for(const id of deleted){ assert.ok(table.rows.some(r=>r.id===id)); removed.push({table:table.table_name,id}); }
}
assert.equal(after.baseline.tables.length,before.baseline.tables.length);
assert.deepEqual(after.baseline.storage,before.baseline.storage,'Métadonnées Storage modifiées');
const expectedRemoved=[{table:'artisanal_sites',id:plan.siteId},...plan.contactIds.map(id=>({table:'artisanal_site_assignments',id}))].sort((a,b)=>a.id.localeCompare(b.id));
assert.deepEqual(removed.sort((a,b)=>a.id.localeCompare(b.id)),expectedRemoved);
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const evidence={verifiedAt:new Date().toISOString(),passed:true,removed,otherBaselineRowsUnchanged:true,allFourteenTablesOutsideQaUnchanged:true,
 storageMetadataUnchanged:true,schemaUnchanged:true,thirdPartyRowsPreserved:plan.thirdPartyChangesExcluded,
 preflightSha256:sha(`${folder}/cleanup-preflight.json`),postflightSha256:sha(postflightFile),candidateSha256:sha(`${folder}/cleanup-candidate-v2.sql`),
 limits:['Hashes Storage de métadonnées uniquement, pas empreinte des fichiers binaires','Aucune validation Auth/RLS/interface déduite de cette lecture privilégiée']};
fs.writeFileSync(outputFile,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:true,removed:removed.length,otherBaselineRowsUnchanged:true}));
