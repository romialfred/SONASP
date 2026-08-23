import { rm } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const targets = ['dist', path.join('node_modules', '.vite')];

for (const relativeTarget of targets) {
  const absoluteTarget = path.resolve(projectRoot, relativeTarget);
  const relativeResolvedTarget = path.relative(projectRoot, absoluteTarget);

  if (
    relativeResolvedTarget === '' ||
    relativeResolvedTarget.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeResolvedTarget)
  ) {
    throw new Error(`Nettoyage refusé hors du projet : ${absoluteTarget}`);
  }

  await rm(absoluteTarget, { recursive: true, force: true });
}
