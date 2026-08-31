// Copy only build inputs; never publish credentials, audit snapshots or test data.
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
const audit = process.argv[2];
if (!audit) throw new Error('Audit folder required');
const folder = mkdtempSync(path.join(tmpdir(), 'sonasp-frontend-release-'));
for (const item of ['src', 'public', 'package.json', 'package-lock.json', 'index.html', 'vite.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'tailwind.config.js', 'postcss.config.js', 'vercel.json']) {
  cpSync(item, path.join(folder, item), { recursive: true, filter: (name) => !/\.(test|spec)\.[jt]sx?$/.test(name) && !/[\\/]__tests__([\\/]|$)/.test(name) });
}
mkdirSync(path.join(folder, '.vercel'));
cpSync('.vercel/project.json', path.join(folder, '.vercel/project.json'));
const hashes = [];
function walk(dir) {
  for (const entry of readdirSync(path.join(folder, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(relative);
    else hashes.push({ file: relative.replaceAll('\\', '/'), sha256: createHash('sha256').update(readFileSync(path.join(folder, relative))).digest('hex') });
  }
}
walk('');
const sourceHash = createHash('sha256').update(JSON.stringify(hashes)).digest('hex');
writeFileSync(path.join(audit, 'frontend-source.json'), JSON.stringify({ folder, sourceHash, files: hashes }, null, 2));
console.log(JSON.stringify({ folder, sourceHash, files: hashes.length }));
