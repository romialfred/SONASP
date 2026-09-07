// Lecture de preuves locales uniquement ; aucun test applicatif, réseau ou SQL exécuté.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const artifacts = new Set();
const bytes = file => { artifacts.add(file); return fs.readFileSync(path.join(root, file)); };
const sha = file => crypto.createHash('sha256').update(bytes(file)).digest('hex');
const read = file => JSON.parse(bytes(file).toString('utf8').replace(/^\uFEFF/, ''));
const audit = 'docs/amelioration/audit/';
const folder = 'docs/amelioration/environnement/reprise-r02/';
const prefix = audit + 'integration-locale-r03';
const integration = read(prefix + '-evidence.json');
const tests = read(prefix + '-tests.json');
const end = read(prefix + '-test-end.json');
assert.deepEqual(integration.before, integration.after);
const inputChecks = Object.entries(integration.after).map(([file, expected]) => ({ file, matches: sha(file) === expected }));
assert.ok(inputChecks.every(row => row.matches));
assert.equal(tests.numTotalTests, 2938); assert.equal(tests.numPassedTests, 2938);
assert.equal(tests.numFailedTests, 0); assert.equal(tests.numPendingTests, 0); assert.equal(tests.numTodoTests, 0);
assert.equal(tests.testResults.length, 366);
const assertions = tests.testResults.flatMap(file => file.assertionResults);
assert.equal(assertions.length, 2938); assert.ok(assertions.every(test => test.status === 'passed'));
assert.ok(tests.testResults.every(file => file.status === 'passed'));
assert.equal(end.reason, 'passed'); assert.deepEqual(end.unhandledErrors, []);
assert.equal(end.modules.length, 366); assert.ok(end.modules.every(module => module.state === 'passed'));
assert.equal(integration.results.length, 7);
const gates = integration.results.map(gate => {
  assert.equal(gate.code, 0); assert.equal(gate.signal, null);
  const stdoutMatches = sha(`${prefix}-${gate.name}.stdout.txt`) === gate.stdoutSha256;
  const stderrMatches = sha(`${prefix}-${gate.name}.stderr.txt`) === gate.stderrSha256;
  assert.ok(stdoutMatches && stderrMatches);
  return { name: gate.name, code: gate.code, stdoutMatches, stderrMatches };
});

const manifest = read('docs/amelioration/preuves/recette-r02/manifest-donnees.json');
const plan = read(folder + 'cleanup-plan-v2.json');
const receipt = read(folder + 'cleanup-execution-v2.json');
const output = read(folder + 'cleanup-result-v2.json').rows[0].cleanup;
const before = read(folder + 'cleanup-preflight.json').rows[0].cleanup_preflight;
const afterFailure = read(folder + 'cleanup-apres-echec.json').rows[0].cleanup_preflight;
const validated = read(folder + 'cleanup-postflight-v2-avant-delete.json').rows[0].cleanup_postflight;
const after = read(folder + 'cleanup-postflight-v2-apres-delete.json').rows[0].cleanup_postflight;
const postReceipt = read(folder + 'cleanup-postflight-v2-apres-delete.execution.json');
const claimed = read(folder + 'cleanup-verification-v2.json');
const validation = read(folder + 'cleanup-validation-v2.evidence.json');
for (const [file, expected] of Object.entries(validation.hashes)) assert.equal(sha(folder + file), expected);
// L'horodatage de l'observation change ; toutes les données et métadonnées restent comparées.
const baselineData = ({ checked_at: _checkedAt, ...rest }) => rest;
assert.deepEqual(baselineData(before.baseline), baselineData(afterFailure.baseline));
assert.deepEqual(before.schema, afterFailure.schema);
assert.deepEqual(baselineData(before.baseline), baselineData(validated.baseline));
assert.deepEqual(before.schema, validated.schema);
assert.equal(receipt.exitCode, 0); assert.equal(postReceipt.exitCode, 0); assert.equal(postReceipt.readOnly, true);
const candidateHash = sha(folder + 'cleanup-candidate-v2.sql');
assert.equal(candidateHash, receipt.candidateSha256); assert.equal(candidateHash, plan.candidateSha256); assert.equal(candidateHash, claimed.candidateSha256);
assert.equal(sha(folder + 'run-cleanup-v2.mjs'), receipt.wrapperSha256);
assert.equal(sha(folder + 'cleanup-postflight-v2.sql'), postReceipt.sqlSha256);
assert.equal(sha(folder + 'cleanup-preflight.json'), claimed.preflightSha256);
assert.equal(sha(folder + 'cleanup-postflight-v2-apres-delete.json'), claimed.postflightSha256);
const v1 = bytes(folder + 'cleanup-candidate.sql').toString('utf8');
const v2 = bytes(folder + 'cleanup-candidate-v2.sql').toString('utf8');
assert.equal(v2, v1.replaceAll('ORDER BY t.id', 'ORDER BY to_jsonb(t)::text COLLATE "C"'));
assert.equal((v2.match(/DELETE FROM /g) || []).length, 2);
assert.deepEqual(manifest.entities.artisanal_sites, [plan.siteId]);
assert.deepEqual(manifest.entities.artisanal_site_assignments, plan.contactIds);
assert.equal(output.deleted_assignments, 2); assert.equal(output.deleted_site, 1);
assert.equal(output.site_id, plan.siteId); assert.equal(output.preservation_checked_in_transaction, true);
assert.equal(after.remaining_site, 0); assert.equal(after.remaining_assignments, 0);
assert.equal(after.run_prefix, 'QA20260907-R02');
const removed = [], added = [], changed = [];
for (const original of before.baseline.tables) {
  const current = after.baseline.tables.find(table => table.table_name === original.table_name);
  assert.ok(current);
  const priorRows = new Map(original.rows.map(row => [row.id, row.md5]));
  const currentRows = new Map(current.rows.map(row => [row.id, row.md5]));
  for (const [id, hash] of priorRows) {
    if (!currentRows.has(id)) removed.push({ table: original.table_name, id });
    else if (currentRows.get(id) !== hash) changed.push({ table: original.table_name, id });
  }
  for (const id of currentRows.keys()) if (!priorRows.has(id)) added.push({ table: original.table_name, id });
  assert.equal(current.row_count, current.rows.length); assert.equal(original.row_count, original.rows.length);
}
assert.equal(before.baseline.tables.length, after.baseline.tables.length);
const expectedRemoved = Object.entries(manifest.entities).flatMap(([table, ids]) => ids.map(id => ({ table, id })));
const sortRows = rows => rows.sort((a, b) => a.id.localeCompare(b.id));
assert.deepEqual(sortRows(removed), sortRows(expectedRemoved));
assert.deepEqual(added, []); assert.deepEqual(changed, []);
assert.equal(validated.outside_preservation.tables.length, 14);
assert.deepEqual(validated.outside_preservation, after.outside_preservation);
assert.deepEqual(before.baseline.storage, after.baseline.storage);
assert.deepEqual(before.schema, after.schema);
const thirdPartyChecks = plan.thirdPartyChangesExcluded.map(id => {
  const former = before.baseline.tables.flatMap(table => table.rows).find(row => row.id === id);
  const current = after.baseline.tables.flatMap(table => table.rows).find(row => row.id === id);
  assert.ok(former && current); assert.deepEqual(former, current);
  return { id, preserved: true };
});

const ui = 'docs/amelioration/preuves/lecture-sites-ui/';
const currentUiManifest = read(ui + 'manifest.json');
const captureFiles = ['15-production-erreur-sans-panneau.jpg', '15-production-erreur-sans-panneau.txt'];
const captureChecks = captureFiles.map(file => {
  const entry = currentUiManifest.files.find(row => row.name === file);
  assert.ok(entry); assert.equal(sha(ui + file), entry.sha256); assert.equal(bytes(ui + file).length, entry.bytes);
  return { file: ui + file, sha256: entry.sha256, matches: true };
});
assert.ok(bytes(ui + captureFiles[1]).toString('utf8').split('- main:')[1]?.includes('button "Réessayer"'));
const oldGlobal = read(audit + 'reprise-locale-suite-finale.json');
assert.equal(oldGlobal.numTotalTests, 2870);
bytes(audit + 'REVUE_SORTIE_GLOBALE_2870.md'); bytes(audit + 'reprise-locale-suite-finale.log');
const proofFiles = [...artifacts].filter(file => !Object.hasOwn(integration.after, file));
const evidence = {
  id: 'AUD-FINAL-R03-R02-V2-20260907', checkedAt: new Date().toISOString(), localEvidenceReadsOnly: true,
  integration: { head: integration.head, startedAt: integration.startedAt, endedAt: integration.endedAt, assertions: assertions.length, files: tests.testResults.length, passedModules: end.modules.length, reason: end.reason, unhandledErrors: end.unhandledErrors, gates, inputCount: inputChecks.length, stableBeforeAfter: true, currentInputsMatch: true, oldGlobal2870Retained: true },
  cleanup: { candidateSha256: candidateHash, exactV1ToV2ReplacementOnly: true, v1FailureDidNotChangeBaselineOrSchema: true, preflightAndValidationBaselinesEqual: true, deletedCount: removed.length, removed, otherRowsAdded: added, otherRowsChanged: changed, comparedRowFingerprintTables: before.baseline.tables.length, outsidePreservationTables: after.outside_preservation.tables.length, outsidePreservationMatches: true, storageMetadataMatches: true, schemaMatches: true, thirdPartyChecks, capturedSqlReceiptExit: receipt.exitCode, capturedPostflightReceiptExit: postReceipt.exitCode },
  pixels15: { checks: captureChecks, directlyInspected: true, dimensions: { width: 1280, height: 720 }, retryButtonVisible: true, previous07VisibilityReservationResolvedOnly: true, fullPage: false, memoryFixtureOnly: true },
  limitations: ['Aucun test ou SQL relancé par cet audit.', 'Les comparaisons de données portent sur les empreintes capturées, pas une relecture du serveur.', 'Storage : métadonnées de trois buckets, pas empreintes binaires.', 'Schéma : périmètre présent dans les preuves, pas inventaire complet de la base.', 'Les trois changements tiers restent sans attribution.', 'Aucune validation des workflows complets, permissions réelles, photos/AEA distantes ou déploiement.'],
  artifacts: Object.fromEntries(proofFiles.map(file => [file, sha(file)])),
};
fs.writeFileSync(path.join(root, audit + 'final-r03-r02-v2-independent.evidence.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ integration: evidence.integration, cleanup: evidence.cleanup, pixels15: evidence.pixels15, proofFiles: proofFiles.length }));
