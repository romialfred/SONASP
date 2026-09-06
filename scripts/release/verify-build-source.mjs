import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Only application inputs are checked: unrelated local documents may remain in a shared workspace.
export const releasePaths = ['src', 'public', 'supabase', 'scripts', 'tests', '.github', 'package.json', 'package-lock.json', 'index.html', 'vite.config.ts', 'vercel.json', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'tailwind.config.js', 'postcss.config.js'];
export function verifyBuildSource({ env = process.env, cwd = process.cwd(), required = false } = {}) {
  const hosted = env.VERCEL === '1';
  if (!hosted && !required) return { mode: 'local' };
  const revision = env.VERCEL_GIT_COMMIT_SHA;
  if (hosted && (!/^[a-f0-9]{40}$/i.test(revision || '') || env.VERCEL_GIT_PROVIDER !== 'github')) {
    throw new Error('Publication refusée : déployer le commit poussé sur GitHub, pas une copie locale non versionnée.');
  }
  if (hosted && (env.VERCEL_ENV === 'production' || env.VERCEL_TARGET_ENV === 'production') && env.VERCEL_GIT_COMMIT_REF !== 'SONASP_2026') {
    throw new Error('La production doit provenir de la branche SONASP_2026.');
  }
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  let head;
  try { head = git(['rev-parse', 'HEAD']); }
  catch {
    // Vercel Git builds may omit .git; their revision is supplied by the Git integration.
    if (hosted) return { mode: 'vercel-git', revision };
    throw new Error('Un dépôt Git est nécessaire pour préparer une publication.');
  }
  if (revision && head !== revision) throw new Error('Le commit compilé diffère du commit annoncé.');
  const changes = git(['status', '--porcelain', '--untracked-files=all', '--', ...releasePaths]);
  if (changes) throw new Error('Publication refusée : des fichiers applicatifs ne sont pas enregistrés dans le commit.\n' + changes);
  return { mode: hosted ? 'vercel-git' : 'git', revision: head };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(verifyBuildSource({ required: process.argv.includes('--require-git') }))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
