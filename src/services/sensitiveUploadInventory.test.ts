import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Surface {
  file: string;
  directClientUpload: boolean;
  directClientDelete?: boolean;
  getPublicUrl: boolean;
  gatewayCall?: string;
  deleteGatewayCall?: string;
  status?: string;
}

const root = process.cwd();
const inventory = JSON.parse(readFileSync(
  resolve(root, 'docs/audits/sensitive-upload-surfaces-2i.json'),
  'utf8',
)) as { remediated: Surface[]; residual: Surface[] };

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.(?:ts|tsx)$/u.test(entry.name) || /\.test\.(?:ts|tsx)$/u.test(entry.name)) return [];
    return [path];
  });
}

function normalized(path: string): string {
  return path.split('\\').join('/');
}

describe('inventaire machine-vérifiable des uploads sensibles', () => {
  const files = sourceFiles(resolve(root, 'src'));
  const directUploads = files.filter((file) => {
    const source = readFileSync(file, 'utf8');
    return /supabase\.storage[\s\S]{0,180}?\.upload\(/u.test(source);
  }).map((file) => normalized(relative(root, file))).sort();
  const publicUrls = files.filter((file) => readFileSync(file, 'utf8').includes('.getPublicUrl('))
    .map((file) => normalized(relative(root, file))).sort();
  const directDeletes = files.filter((file) => {
    const source = readFileSync(file, 'utf8');
    return /supabase\.storage[\s\S]{0,220}?\.remove\(/u.test(source);
  }).map((file) => normalized(relative(root, file))).sort();

  it('recense chaque upload Storage direct restant', () => {
    expect(inventory.residual.filter((entry) => entry.directClientUpload).map((entry) => entry.file).sort())
      .toEqual(directUploads);
  });

  it('recense chaque génération d’URL publique restante', () => {
    expect(inventory.residual.filter((entry) => entry.getPublicUrl).map((entry) => entry.file).sort())
      .toEqual(publicUrls);
  });

  it('recense chaque suppression Storage directe restante', () => {
    expect(inventory.residual.filter((entry) => entry.directClientDelete).map((entry) => entry.file).sort())
      .toEqual(directDeletes);
  });

  it.each(inventory.remediated)('$file ne régresse pas vers un accès Storage direct', (entry) => {
    const source = readFileSync(resolve(root, entry.file), 'utf8');
    expect(source).not.toMatch(/supabase\.storage[\s\S]{0,180}?\.upload\(/u);
    expect(source).not.toContain('.getPublicUrl(');
    expect(source).toContain(entry.gatewayCall ?? 'uploadSensitiveFile(');
    if (entry.deleteGatewayCall) expect(source).toContain(entry.deleteGatewayCall);
  });

  it.each(inventory.residual.filter((entry) => entry.status?.startsWith('fail-closed')))(
    '$file reste fermé sans accès binaire navigateur',
    (entry) => {
      const source = readFileSync(resolve(root, entry.file), 'utf8');
      expect(source).not.toMatch(/supabase\.storage[\s\S]{0,220}?\.(?:upload|remove)\(/u);
      expect(source).not.toContain('.getPublicUrl(');
    },
  );
});
