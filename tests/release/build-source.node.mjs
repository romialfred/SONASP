import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { verifyBuildSource } from '../../scripts/release/verify-build-source.mjs';

function repository(t) {
  const cwd = mkdtempSync(path.join(tmpdir(), 'sonasp-release-test-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(cwd)), path.resolve(tmpdir()));
    assert.ok(path.basename(cwd).startsWith('sonasp-release-test-'));
    rmSync(cwd, { recursive: true, force: true });
  });
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init', '-b', 'SONASP_2026']);
  mkdirSync(path.join(cwd, 'src'));
  writeFileSync(path.join(cwd, 'src/form.ts'), 'export const form = 1;\n');
  git(['add', 'src/form.ts']);
  git(['-c', 'user.name=Release Test', '-c', 'user.email=release@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture']);
  const revision = git(['rev-parse', 'HEAD']);
  return { cwd, git, revision };
}
test('un build local de développement reste autorisé', () => assert.equal(verifyBuildSource({ env: {} }).mode, 'local'));
test('une copie locale Vercel sans commit GitHub est refusée', () => assert.throws(() => verifyBuildSource({ env: { VERCEL: '1' } }), /Publication refusée/));
test('un commit propre est accepté et les documents hors application sont conservés', t => {
  const { cwd, revision } = repository(t);
  writeFileSync(path.join(cwd, 'document-local.txt'), 'local');
  assert.equal(verifyBuildSource({ cwd, env: {}, required: true }).revision, revision);
});
test('les modifications enregistrées seulement dans l’index sont bloquées', t => {
  const { cwd, git } = repository(t);
  writeFileSync(path.join(cwd, 'src/form.ts'), 'export const form = 2;\n');
  git(['add', 'src/form.ts']);
  assert.throws(() => verifyBuildSource({ cwd, env: {}, required: true }), /pas enregistrés dans le commit/);
});
test('un nouveau composant non suivi empêche la publication', t => {
  const { cwd } = repository(t);
  writeFileSync(path.join(cwd, 'src/new-form.ts'), 'export {};');
  assert.throws(() => verifyBuildSource({ cwd, env: {}, required: true }), /new-form/);
});
test('un faux identifiant de commit et une autre branche de production sont refusés', t => {
  const { cwd, revision } = repository(t);
  const env = { VERCEL: '1', VERCEL_GIT_PROVIDER: 'github', VERCEL_GIT_COMMIT_SHA: revision, VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'SONASP_2026' };
  assert.equal(verifyBuildSource({ cwd, env }).revision, revision);
  assert.throws(() => verifyBuildSource({ cwd, env: { ...env, VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40) } }), /diffère/);
  assert.throws(() => verifyBuildSource({ cwd, env: { ...env, VERCEL_GIT_COMMIT_REF: 'main' } }), /branche/);
});
