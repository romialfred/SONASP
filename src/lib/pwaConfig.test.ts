import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');

describe('configuration de transition PWA', () => {
  it('produit un identifiant atomique inclus dans le manifeste Workbox', () => {
    expect(viteConfig).toContain("fileName: 'build-version.json'");
    expect(viteConfig).toContain("'build-version.json'");
    expect(viteConfig).toContain('VERCEL_GIT_COMMIT_SHA');
  });

  it('maintient le worker en attente d’un geste explicite', () => {
    expect(viteConfig).toMatch(/registerType:\s*'prompt'/u);
    expect(viteConfig).toMatch(/skipWaiting:\s*false/u);
    expect(viteConfig).toMatch(/clientsClaim:\s*true/u);
    expect(viteConfig).not.toMatch(/registerType:\s*'autoUpdate'/u);
  });
});
