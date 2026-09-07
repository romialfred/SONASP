// Audit de composants et de calculs ; aucun navigateur, Auth ou stockage réels.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const tests = ['src/pages/artisan-minier/ArtisanMinierDashboard.test.tsx', 'src/services/artisanTerritoryInsights.test.ts', 'docs/amelioration/audit/artisan-dashboard-independent.test.tsx'];
const inputs = [...tests, 'src/pages/artisan-minier/ArtisanMinierDashboard.tsx', 'src/services/artisanTerritoryInsights.ts', 'src/pages/artisan-minier/artisan-minier-dashboard.css', 'src/types/artisanalSite.ts', 'src/services/artisanMinierService.ts', 'src/services/carteProfessionnelleService.ts', 'src/services/artisanalSiteService.ts', 'src/data/burkinaProvinces.ts', 'src/test/fixtures/artisanalSites.ts', 'supabase/migrations/20260906111030_refonte_dossier_artisan.sql', 'supabase/migrations/20260906235254_affiliation_payment_evidence_and_paid_generation.sql', 'src/test/setup.ts', 'vitest.config.ts', 'package-lock.json'];
const hash = value => createHash('sha256').update(value).digest('hex');
const hashes = async () => Object.fromEntries(await Promise.all(inputs.map(async path => [path, hash(await readFile(new URL('../../../' + path, import.meta.url)))])));
const before = await hashes(); const started = new Date().toISOString();
const args = ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1', '--reporter=verbose', ...tests];
const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 300000, windowsHide: true, env: { ...process.env, NO_COLOR: '1' } });
const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
const after = await hashes(); const stable = JSON.stringify(before) === JSON.stringify(after);
const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true });
const count = Number(output.match(/\bTests\s+(\d+) passed\s+\((\d+)\)/)?.[1] ?? NaN);
const evidence = {
  evidence_id: 'AUD-ART-DASH-01', date_utc: started, finished_at_utc: new Date().toISOString(),
  evidence_kind: 'COMPOSANTS_JSDOM_ET_CALCULS_SERVICES_AUTH_SIMULES',
  environment: { name: 'Vitest jsdom local', network_backend: false, auth_simulated: true, actual_browser: false, map_charts_layout_simulated: true },
  application: { base_commit: git.status === 0 ? git.stdout.trim() : null, integrated_release_commit: null, source_file_hashes: before, source_file_hashes_after: after, stable_inputs_during_execution: stable },
  command: ['node', ...args].join(' '), exit_code: result.status,
  test_result: result.status === 0 && stable && Number.isFinite(count) ? 'RÉUSSI' : 'ÉCHOUÉ',
  summary: { passed: Number.isFinite(count) ? count : null, test_files: tests.length, independent_cases: 13 },
  artifacts: [{ path: 'docs/amelioration/audit/artisan-dashboard-independent.txt', sha256: hash(output), kind: 'vitest-verbose-output' }],
  executor: 'audit_independant',
  limitations: ['Auth, services, shell, carte et graphiques remplacés par des doubles dans les cas indépendants.', 'Les migrations sont lues pour le contrat de rattachement, pas exécutées par ce runner.', 'Aucun parcours navigateur, permission serveur, MFA ou persistance réelle éprouvés.', 'Les données de la cible en ligne et les autres indicateurs/workflows Artisan restent à vérifier.'],
  ui_form_validated: false, deployment_authorised_by_this_evidence: false,
};
await writeFile(new URL('./artisan-dashboard-independent.txt', import.meta.url), output);
await writeFile(new URL('./artisan-dashboard-independent.evidence.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
process.stdout.write(JSON.stringify({ result: evidence.test_result, exitCode: result.status, stableInputs: stable, summary: evidence.summary }) + '\n');
if (evidence.test_result !== 'RÉUSSI') process.exitCode = 1;
