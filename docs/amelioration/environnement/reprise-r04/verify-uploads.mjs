// Contrôle local des preuves : aucun accès à l'API ni à la base.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const folder='docs/amelioration/environnement/reprise-r04';
const [snapshotFile,expectedFile,outputFile]=process.argv.slice(2);
assert.ok(snapshotFile && expectedFile && outputFile);
const load=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const actual=load(snapshotFile).rows[0].uploads;
const expected=load(expectedFile);
const baseline=load(`${folder}/baseline-before.json`).rows[0].baseline;
assert.match(expected.siteId??'',/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.ok(Number.isInteger(expected.photoCount) && expected.photoCount>=0 && expected.photoCount<=3);
assert.equal(typeof expected.aeaPresent,'boolean');
assert.equal(actual.run_prefix,'QA20260907-R04');
assert.equal(actual.site_id,expected.siteId);
assert.equal(actual.objects.length,expected.photoCount+Number(expected.aeaPresent));
assert.equal(actual.objects.filter(o=>o.bucket==='artisanal-sites').length,expected.photoCount);
assert.equal(actual.objects.filter(o=>o.bucket==='artisanal-site-aea').length,Number(expected.aeaPresent));
const seen=new Set();
for(const object of actual.objects){
  assert.equal(object.found,true,'Objet manquant');
  assert.ok(object.object_id && !seen.has(object.object_id),'Objet absent ou dupliqué');
  seen.add(object.object_id);
  assert.ok(!baseline.storage.objects.some(old=>old.id===object.object_id),'Objet préexistant hors QA');
  assert.ok(Date.parse(object.created_at)>=Date.parse(baseline.checked_at),'Objet antérieur au baseline');
  assert.equal(object.site_reference_count,1,'Objet partagé avec un autre site');
  assert.match(object.metadata_md5??'',/^[a-f0-9]{32}$/);
  assert.ok(Number(object.size)>0,'Objet vide');
  if(object.bucket==='artisanal-sites'){
    assert.match(object.path,/^sites\/[a-zA-Z0-9-]+\.jpg$/);
    assert.equal(object.mimetype,'image/jpeg');
  }else{
    assert.equal(object.bucket,'artisanal-site-aea');
    assert.equal(object.path.split('/')[0],expected.siteId);
    assert.ok(['application/pdf','image/jpeg','image/png'].includes(object.mimetype));
    assert.ok(Number(object.size)<=10485760);
  }
}
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={verifiedAt:new Date().toISOString(),passed:true,runPrefix:'QA20260907-R04',siteId:expected.siteId,
 expectedPhotoCount:expected.photoCount,expectedAeaPresent:expected.aeaPresent,objects:actual.objects,
 expectedSha256:sha(expectedFile),snapshotSha256:sha(snapshotFile),baselineSha256:sha(`${folder}/baseline-before.json`),
 cleanupAuthorized:false,binaryContentVerified:false,scope:'Existence et métadonnées des seuls objets associés au site UI exact'};
fs.writeFileSync(outputFile,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:true,objects:actual.objects.length,binaryContentVerified:false}));
