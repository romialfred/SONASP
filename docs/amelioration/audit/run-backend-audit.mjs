// Exécute uniquement les tests PGlite locaux et conserve une preuve de version.
// Ce runner ne se connecte à aucun projet Supabase et ne valide pas une recette UI.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const inputs = [
  'supabase/migrations/20260907044811_enregistrer_dossier_client_atomique.sql',
  'supabase/migrations/20260905000000_durcir_rls_clients.sql',
  'supabase/migrations/20260823180000_capacites_et_separation_fonctions.sql',
  'supabase/tests/fixtures/customer-dossier-baseline.sql',
  'tests/clients/customer-dossier.node.mjs',
  'docs/amelioration/audit/customer-dossier-independent.node.mjs',
];
const hash = value => createHash('sha256').update(value).digest('hex');
const hashes = async () => Object.fromEntries(await Promise.all(inputs.map(async path => [path, hash(await readFile(new URL('../../../' + path, import.meta.url)))])));
const before = await hashes();
const startedAt = new Date().toISOString();
const command = ['--test', 'tests/clients/customer-dossier.node.mjs', 'docs/amelioration/audit/customer-dossier-independent.node.mjs'];
const result = spawnSync(process.execPath, command, { cwd: root, encoding: 'utf8', timeout: 60000, windowsHide: true });
const after = await hashes();
const stableInputs = JSON.stringify(before) === JSON.stringify(after);
const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
const numberFromSummary = key => Number(output.match(new RegExp(`(?:ℹ|#) ${key} (\\d+)`))?.[1] ?? NaN);
const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true });
const evidence = {
  evidence_id: 'AUD-CLI-SQL-01',
  scenario_id: 'CLI-TECH-BACKEND-INDEPENDANT',
  date_utc: startedAt,
  finished_at_utc: new Date().toISOString(),
  evidence_kind: 'SQL_POSTGRES_EMBARQUE_AUTH_SIMULEE',
  environment: { name: 'PGlite en mémoire jetable', production: false, network_backend: false, auth_simulated: true },
  application: { baseline_commit: git.status === 0 ? git.stdout.trim() : null, integrated_release_commit: null, source_file_hashes: before, stable_inputs_during_execution: stableInputs },
  command: ['node', ...command].join(' '),
  exit_code: result.status,
  test_result: result.status === 0 && stableInputs ? 'RÉUSSI' : 'ÉCHOUÉ',
  summary: { tests_including_parent_tests: numberFromSummary('tests'), passed: numberFromSummary('pass'), failed: numberFromSummary('fail') },
  artifacts: [{ path: 'docs/amelioration/audit/backend-independent.tap.txt', sha256: hash(output), kind: 'node-test-output' }],
  expected: 'Transaction client et banques atomique, droits RLS du demandeur conservés, IDs et FK historiques préservés, types invalides refusés.',
  observed: 'Voir les assertions nommées du rapport brut ; aucune affirmation UI, MFA ou API réelle.',
  executor: 'audit_independant',
  limitations: ['Schéma PGlite fixture, pas une introspection du schéma live.', 'Auth, AAL2, capacité et session simulés.', 'Pas de concurrence multi-connexion ni de reprise après réponse réseau perdue.', 'Aucun enregistrement créé depuis l’interface.', 'Version de travail non committée ; réexaminer à l’intégration.'],
  ui_form_validated: false,
  deployment_authorised_by_this_evidence: false,
};
await writeFile(new URL('./backend-independent.tap.txt', import.meta.url), output);
await writeFile(new URL('./backend-independent.evidence.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
process.stdout.write(JSON.stringify({ result: evidence.test_result, exitCode: result.status, summary: evidence.summary, stableInputs }, null, 2) + '\n');
if (result.status !== 0 || !stableInputs) process.exitCode = 1;
