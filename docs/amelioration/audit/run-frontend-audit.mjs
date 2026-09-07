// Audit ciblé en jsdom. Services/Auth/layout doublés : aucune preuve de persistance UI.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const tests = [
  'src/pages/customers/CustomerForm.test.tsx',
  'src/pages/customers/CustomerViews.test.tsx',
  'src/components/customers/BankAccountForm.test.tsx',
  'src/services/customerDossierService.test.ts',
  'src/lib/customerCountryLabels.test.ts',
  'docs/amelioration/audit/customer-frontend-independent.test.tsx',
];
const inputs = [...tests, 'src/pages/customers/CustomerForm.tsx', 'src/pages/customers/CustomerProfile.tsx', 'src/pages/customers/CustomerListing.tsx', 'src/components/customers/BankAccountForm.tsx', 'src/services/customerDossierService.ts', 'src/lib/customerCountryLabels.ts', 'src/constants/countries.ts', 'src/pages/customers/customers.css', 'src/types/database.ts', 'src/components/ui/sn/index.tsx', 'src/lib/routeAccessRegistry.ts', 'src/hooks/useArtisanUnsavedChanges.ts', 'src/hooks/useAutoRefresh.ts', 'src/test/setup.ts', 'vitest.config.ts', 'package-lock.json'];
const hash = data => createHash('sha256').update(data).digest('hex');
const hashes = async () => Object.fromEntries(await Promise.all(inputs.map(async path => [path, hash(await readFile(new URL('../../../' + path, import.meta.url)))])));
const before = await hashes();
const started = new Date().toISOString();
const args = ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1', '--reporter=verbose', ...tests];
const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 300000, windowsHide: true, env: { ...process.env, NO_COLOR: '1' } });
const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
const after = await hashes(); const stable = JSON.stringify(before) === JSON.stringify(after);
const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true });
const count = Number(output.match(/\bTests\s+(\d+) passed\s+\((\d+)\)/)?.[1] ?? NaN);
const evidence = {
  evidence_id: 'AUD-CLI-FE-01',
  date_utc: started, finished_at_utc: new Date().toISOString(),
  evidence_kind: 'COMPOSANTS_JSDOM_SERVICES_AUTH_LAYOUT_SIMULES',
  environment: { name: 'Vitest jsdom local', production: false, network_backend: false, auth_simulated: true, actual_browser: false, layout_simulated: true },
  application: { baseline_commit: git.status === 0 ? git.stdout.trim() : null, integrated_release_commit: null, source_file_hashes: before, stable_inputs_during_execution: stable },
  command: ['node', ...args].join(' '), exit_code: result.status,
  test_result: result.status === 0 && stable && Number.isFinite(count) ? 'RÉUSSI' : 'ÉCHOUÉ',
  summary: { passed: Number.isFinite(count) ? count : null, test_files: tests.length, expected_original_cases: 32, expected_independent_cases: 14 },
  artifacts: [{ path: 'docs/amelioration/audit/frontend-independent.txt', sha256: hash(output), kind: 'vitest-verbose-output' }],
  executor: 'audit_independant',
  limitations: ['Auth et chargements/sauvegardes remplacés par des doubles.', 'Les liens sont inspectés sans envoi de courriel ni ouverture des workflows externes.', 'Aucun rendu navigateur, responsive, zoom natif ou persistance en base réelle.', 'Empreintes du lot contrôlé ; ce n’est pas un commit de livraison ni un audit de toute l’application.'],
  ui_form_validated: false, deployment_authorised_by_this_evidence: false,
};
await writeFile(new URL('./frontend-independent.txt', import.meta.url), output);
await writeFile(new URL('./frontend-independent.evidence.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
process.stdout.write(JSON.stringify({ result: evidence.test_result, exitCode: result.status, stableInputs: stable, summary: evidence.summary }) + '\n');
if (evidence.test_result !== 'RÉUSSI') process.exitCode = 1;
