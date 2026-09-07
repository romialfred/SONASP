import fs from 'node:fs';
import assert from 'node:assert/strict';
const [actualFile, expectedFile, outputFile] = process.argv.slice(2);
assert.ok(actualFile && expectedFile && outputFile, 'Fichiers réel, attendu et preuve requis');
const actual = JSON.parse(fs.readFileSync(actualFile,'utf8').replace(/^\uFEFF/, '')).rows[0].dossier;
const expected = JSON.parse(fs.readFileSync(expectedFile,'utf8').replace(/^\uFEFF/, ''));
assert.equal(actual.run_prefix,'QA20260907-R04');
assert.ok(['site','artisan'].includes(expected.kind), 'Le type du dossier créé dans l’interface doit être fourni');
assert.match(expected.id ?? '', /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  'L’UUID exact du dossier créé dans l’interface doit être fourni');
assert.equal(expected.id.toLowerCase(), actual.id.toLowerCase(), 'UUID différent du dossier créé dans l’interface');
assert.equal(expected.kind, actual.kind, 'Type différent du dossier créé dans l’interface');
assert.ok(expected.parent && Object.keys(expected.parent).length, 'Les valeurs réellement saisies doivent être fournies');
function matches(actual, expected) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return false;
    const used = new Set();
    return expected.every(entry => {
      const candidates = actual.flatMap((candidate,i) => !used.has(i) && matches(candidate,entry) ? [i] : []);
      if (candidates.length !== 1) return false;
      used.add(candidates[0]); return true;
    });
  }
  if (expected && typeof expected === 'object') return !!actual && Object.entries(expected).every(([key,value]) => matches(actual[key],value));
  return Object.is(actual,expected);
}
const mismatches = Object.entries(expected).filter(([key,value]) => !matches(actual[key],value)).map(([key]) => key);
const report = { checkedAt:new Date().toISOString(), id:actual.id, kind:actual.kind, runPrefix:actual.run_prefix, actualFile, expectedFile,
  expectedParentFields:Object.keys(expected.parent), checkedSections:Object.keys(expected), mismatches, passed:mismatches.length===0 };
assert.ok(!fs.existsSync(outputFile), 'Ne pas écraser une comparaison existante');
fs.writeFileSync(outputFile,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ id:actual.id, passed:report.passed, mismatches }));
if (!report.passed) process.exitCode=1;
