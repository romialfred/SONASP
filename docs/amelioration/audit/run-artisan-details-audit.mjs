// Lecture du détail Artisan en jsdom, sans compte, backend ni persistance réels.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const tests = ['src/pages/artisan-minier/ArtisanMinierDetails.test.tsx', 'docs/amelioration/audit/artisan-details-independent.test.tsx'];
const inputs = [...tests, 'src/pages/artisan-minier/ArtisanMinierDetails.tsx', 'src/pages/artisan-minier/artisanRow.ts', 'src/pages/artisan-minier/artisan-details.css', 'src/components/artisan/ArtisanDossierSummary.tsx', 'src/lib/collectorAccess.ts', 'src/lib/routeAccessRegistry.ts', 'src/utils/artisanIdentity.ts', 'src/components/ui/sn/index.tsx', 'src/test/setup.ts', 'vitest.config.ts', 'package-lock.json'];
const hash = value => createHash('sha256').update(value).digest('hex');
const hashes = async () => Object.fromEntries(await Promise.all(inputs.map(async path => [path, hash(await readFile(new URL('../../../' + path, import.meta.url)))])));
const before = await hashes(); const started = new Date().toISOString();
const args = ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1', '--reporter=verbose', ...tests];
const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 300000, windowsHide: true, env: { ...process.env, NO_COLOR: '1' } });
const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
const stable = JSON.stringify(before) === JSON.stringify(await hashes());
const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true });
const count = Number(output.match(/\bTests\s+(\d+) passed\s+\((\d+)\)/)?.[1] ?? NaN);
const evidence = {
  evidence_id: 'AUD-ART-DETAIL-01', date_utc: started, finished_at_utc: new Date().toISOString(),
  evidence_kind: 'COMPOSANTS_JSDOM_SERVICES_AUTH_SIMULES',
  environment: { name: 'Vitest jsdom local', production: false, network_backend: false, auth_simulated: true, actual_browser: false },
  application: { baseline_commit: git.status === 0 ? git.stdout.trim() : null, integrated_release_commit: null, source_file_hashes: before, stable_inputs_during_execution: stable },
  command: ['node', ...args].join(' '), exit_code: result.status,
  test_result: result.status === 0 && stable && Number.isFinite(count) ? 'RÉUSSI' : 'ÉCHOUÉ',
  summary: { passed: Number.isFinite(count) ? count : null, test_files: tests.length, independent_cases: 6 },
  artifacts: [{ path: 'docs/amelioration/audit/artisan-details-independent.txt', sha256: hash(output), kind: 'vitest-verbose-output' }],
  executor: 'audit_independant',
  limitations: ['Services de lecture et Auth simulés ; erreurs/réponses tardives injectées par les tests.', 'Pas de parcours navigateur, formulaire, écriture ou rechargement depuis une base réelle.', 'Aucun test de permissions serveur, MFA, document ou paiement exécuté par cette preuve.', 'Lot limité au détail et ses sources annexes ; ne valide pas les autres modules Artisan.'],
  ui_form_validated: false, deployment_authorised_by_this_evidence: false,
};
await writeFile(new URL('./artisan-details-independent.txt', import.meta.url), output);
await writeFile(new URL('./artisan-details-independent.evidence.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
process.stdout.write(JSON.stringify({ result: evidence.test_result, exitCode: result.status, stableInputs: stable, summary: evidence.summary }) + '\n');
if (evidence.test_result !== 'RÉUSSI') process.exitCode = 1;
