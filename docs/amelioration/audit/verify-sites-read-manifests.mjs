import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const productionBase = 'docs/amelioration/lot-artisanat/lecture-production-details';
const overviewBase = 'docs/amelioration/lot-artisanat/overview-conformite';
const production = read(`${productionBase}/evidence.json`);
const overview = read(`${overviewBase}/evidence.json`);
const run = read('docs/amelioration/audit/sites-read-independent-20260907.evidence.json');
const comparisons = [];
for (const [group, values, base] of [
  ['production_sources', production.sourceHashesAfterVerification, ''],
  ['production_preserved', production.preservedAtHead, ''],
  ['production_artifacts', production.artifactHashes, productionBase + '/'],
  ['overview_sources', overview.sourceHashesAfter, ''],
  ['independent_frozen_inputs', run.after, ''],
]) for (const [file, expected] of Object.entries(values)) {
  const actual = sha(base + file);
  comparisons.push({ group, file: base + file, expected, actual, matches: expected === actual });
}
const output = 'docs/amelioration/audit/sites-read-manifests-independent.evidence.json';
const evidence = {
  checkedAt: new Date().toISOString(), comparisons,
  allHashesMatch: comparisons.every(item => item.matches),
  independentExitCode: run.exitCode, independentReason: run.reason,
  independentUnhandledErrors: run.unhandledErrors, independentPassed: run.passed,
  gatesFromImplementer: {
    production: production.gates,
    overview: 'Lint et typecheck compiler annoncés 0 ; journaux locaux conservés. Ces commandes ne sont pas rejouées par cet audit.',
  },
  browserVerified: false, persistenceVerified: false,
};
fs.writeFileSync(path.join(root, output), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ comparisons: comparisons.length, allHashesMatch: evidence.allHashesMatch, independentPassed: run.passed }));
if (!evidence.allHashesMatch) process.exitCode = 1;
