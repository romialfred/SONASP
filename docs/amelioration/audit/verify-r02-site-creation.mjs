import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const base = 'docs/amelioration/environnement/reprise-r02/';
const ui = 'docs/amelioration/preuves/recette-r02/';
const id = 'd9f7160a-aadd-41d9-ad4d-c9f886d41e0c';
const stem = `${base}site-creation-${id}`;
const files = [stem+'.json',stem+'.sql',stem+'.execution.json',base+'site-creation-comparison.json',ui+'site-creation-attendu.json',
  ui+'site-01-formulaire-avant.txt',ui+'site-01-responsables-avant.png',ui+'site-02-detail-apres-creation.txt',ui+'site-02-detail-apres-creation.png',
  ui+'site-03-liste-sans-rechargement.txt',ui+'site-03-liste-sans-rechargement.png'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashes = () => Object.fromEntries(files.map(file => [file,sha(fs.readFileSync(file))]));
const json = file => JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const before = hashes();
const actual = json(stem+'.json').rows[0].dossier;
const expected = json(ui+'site-creation-attendu.json');
const receipt = json(stem+'.execution.json');
assert.equal(receipt.readOnly,true); assert.equal(receipt.exitCode,0);
assert.equal(receipt.sqlSha256,before[stem+'.sql']);
assert.equal(actual.id,id); assert.equal(expected.id,id); assert.equal(actual.parent.id,id);
assert.equal(actual.kind,'site'); assert.equal(expected.kind,'site');
assert.equal(actual.run_prefix,'QA20260907-R02');
assert.ok(actual.parent.name.startsWith('QA20260907-R02'));
for (const [field,value] of Object.entries(expected.parent)) assert.deepEqual(actual.parent[field],value,field);
assert.equal(actual.assignments.length,2); assert.equal(expected.assignments.length,2);
assert.equal(new Set(actual.assignments.map(row=>row.id)).size,2);
for (const contact of expected.assignments) {
  const candidates = actual.assignments.filter(row=>row.role===contact.role);
  assert.equal(candidates.length,1);
  for (const [field,value] of Object.entries(contact)) assert.deepEqual(candidates[0][field],value,`${contact.role}.${field}`);
  assert.equal(candidates[0].site_id,id);
  assert.equal(candidates[0].created_at,actual.parent.created_at);
}
assert.deepEqual(actual.parent.photos,[]); assert.deepEqual(actual.storage,[]);
for (const field of ['aea_number','aea_issued_on','aea_duration_months','aea_document_path','aea_document_name']) assert.equal(actual.parent[field],null,field);
assert.equal(actual.references.length,6);
for (const reference of actual.references) assert.equal(reference.row_count,reference.table_name==='artisanal_site_assignments'?2:0,reference.table_name);
const detail = fs.readFileSync(ui+'site-02-detail-apres-creation.txt','utf8');
assert.ok(detail.includes('Le site et ses responsables ont été enregistrés.'));
assert.ok(detail.includes(actual.parent.name));
for (const contact of expected.assignments) for (const field of ['full_name','phone','email']) assert.ok(detail.includes(contact[field]),`AX ${field}`);
const list = fs.readFileSync(ui+'site-03-liste-sans-rechargement.txt','utf8');
assert.ok(list.includes(`/artisan-sites/${id}`)); assert.ok(list.includes(actual.parent.name));
const after = hashes(); assert.deepEqual(after,before);
const result = {id:'AUD-R02-SITE-CREATION',checkedAt:new Date().toISOString(),siteId:id,run:'QA20260907-R02',
  parentFieldsCompared:Object.keys(expected.parent),contactsCompared:2,externalReferencesCompared:6,
  passed:true,stableEvidence:true,before,after,
  scope:'Comparaison indépendante des artefacts UI/SQL de création existants ; aucune requête distante ni écriture par cet audit.',
  screenshotsReviewed:['site-01-responsables-avant.png','site-02-detail-apres-creation.png','site-03-liste-sans-rechargement.png'],
  caveats:['PNG liste onglet Tous ; AX liste onglet Non formalisés : instants différents.',
    'Version UI/URL/chronologie à rattacher au manifeste de recette ; aucune certification du build déduite.',
    'Photos, AEA, modification, rechargement forcé et nettoyage non validés par ces preuves.',
    'La lecture SQL privilégiée ne prouve pas les tests négatifs RLS/MFA.']};
const output = 'docs/amelioration/audit/r02-site-creation-independent.evidence.json';
assert.ok(!fs.existsSync(output),'Ne pas écraser un audit antérieur');
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:result.passed,siteId:id,parentFields:result.parentFieldsCompared.length,contacts:2,stableEvidence:true}));
