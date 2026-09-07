// Lecture seule : aucun reset, aucune migration, aucun appel authentifié distant.
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = resolve(root, 'docs/amelioration/environnement/preflight-result.json');
const run = (executable, args, timeout = 10000) => {
  const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', timeout, windowsHide: true });
  return { exitCode: result.status, timeout: result.error?.code === 'ETIMEDOUT', available: result.error?.code !== 'ENOENT', stdout: (result.stdout || '').trim() };
};
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const environments = [];
for (const name of ['.env', '.env.local', '.env.test', '.env.test.local', '.env.staging', '.env.staging.local']) {
  const file = resolve(root, name);
  if (!existsSync(file)) continue;
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = /^\s*(VITE_SUPABASE_URL|SUPABASE_URL|DATABASE_URL)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[2].trim().replace(/^['"]|['"]$/g, '');
    const classification = value.includes('yyverzuhkdonjjuficor') ? 'production'
      : /^(?:https?|postgres(?:ql)?):\/\/(?:[^@/]+@)?(?:localhost|127\.0\.0\.1|\[::1\])(?=[:/]|$)/.test(value) ? 'loopback'
      : value ? 'remote-or-unclassified' : 'empty';
    environments.push({ file: name, variable: match[1], classification });
  }
}
const docker = run('docker', ['version', '--format', 'client={{.Client.Version}} server={{.Server.Version}}']);
const containers = docker.exitCode === 0 ? run('docker', ['ps', '-a', '--format', '{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}']) : null;
const catalogue = run(process.execPath, ['scripts/check-migration-integrity.mjs', 'verify']);
const strictAudit = run(process.execPath, ['scripts/check-migration-integrity.mjs', 'audit']);
const statsMatch = strictAudit.stdout.match(/\{[\s\S]*?"versionWidths"[\s\S]*?\n\}/);
let stats = null;
try { stats = JSON.parse(statsMatch?.[0] || 'null'); } catch { /* Le code de sortie reste la preuve. */ }
const report = {
  checkedAt: new Date().toISOString(),
  revision: git(['rev-parse', 'HEAD']),
  branch: git(['branch', '--show-current']),
  readOnly: true,
  environmentTargets: environments,
  remoteLinkedMarkerPresent: existsSync(resolve(root, 'supabase/.temp/project-ref')),
  docker: { available: docker.available, exitCode: docker.exitCode, timeout: docker.timeout, version: docker.stdout || null },
  containers: containers?.exitCode === 0 ? containers.stdout.split(/\r?\n/).filter(Boolean) : null,
  migrations: { catalogueExitCode: catalogue.exitCode, strictAuditExitCode: strictAudit.exitCode, stats },
  fullStackReadiness: 'NOT_PROVEN',
  limits: ['Aucune connexion métier ni MFA effectuée.', 'Aucune écriture de test, restauration ou migration exécutée.', 'Un PostgreSQL seul ou un banc PGlite ne valide pas Auth, PostgREST, Storage et Edge Functions.'],
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
