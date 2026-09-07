// Local fixtures only: no SQL, Auth, API or Storage call.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const directory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(directory, 'comparison-contract-fixtures');
assert.ok(!fs.existsSync(fixtureDirectory), 'Conserver les preuves existantes ; ne pas écraser');
fs.mkdirSync(fixtureDirectory);
const id = '11111111-1111-4111-8111-111111111111';
const actual = { rows:[{ dossier:{ run_prefix:'QA20260907-R02', kind:'site', id, parent:{ name:'QA20260907-R02-FIXTURE' }, assignments:[{ id:'contact-a',role:'responsable' }] } }] };
const expected = { kind:'site', id, parent:{ name:'QA20260907-R02-FIXTURE' }, assignments:[{ id:'contact-a',role:'responsable' }] };
const actualFile = path.join(fixtureDirectory,'actual.json');
fs.writeFileSync(actualFile,JSON.stringify(actual,null,2));
const cases = [
  ['exact', expected, true],
  ['missing-id', { ...expected, id:undefined }, false],
  ['missing-kind', { ...expected, kind:undefined }, false],
  ['different-id', { ...expected, id:'22222222-2222-4222-8222-222222222222' }, false],
  ['different-kind', { ...expected, kind:'artisan' }, false],
  ['different-parent', { ...expected, parent:{ name:'AUTRE' } }, false],
  ['missing-child', { ...expected, assignments:[] }, false],
];
const results = cases.map(([name, value, shouldPass]) => {
  const input = path.join(fixtureDirectory,`${name}.expected.json`);
  fs.writeFileSync(input,JSON.stringify(value,null,2));
  const run = spawnSync(process.execPath,[path.join(directory,'compare-dossier.mjs'),actualFile,input,path.join(fixtureDirectory,`${name}.comparison.json`)],{ encoding:'utf8' });
  assert.equal(run.status===0,shouldPass,`${name}: résultat de comparaison incorrect`);
  return { name, expectedAccepted:shouldPass, actualAccepted:run.status===0, passed:true };
});
const evidence = { checkedAt:new Date().toISOString(), localFixturesOnly:true, remoteCalls:0, testCount:results.length, passed:results.every(x=>x.passed), results };
fs.writeFileSync(path.join(directory,'comparison-contract.evidence.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence));
