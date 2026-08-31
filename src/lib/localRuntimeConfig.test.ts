import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const launch = JSON.parse(readFileSync(resolve('.claude/launch.json'), 'utf8'));
const vite = readFileSync(resolve('vite.config.ts'), 'utf8');

describe('stabilité de la plateforme locale', () => {
  it('reconstruit la version locale avant de la servir sans client HMR', () => {
    expect(manifest.scripts.start).toBe('npm run build && npm run serve:local');
    expect(manifest.scripts['serve:local']).toBe('vite preview --host 127.0.0.1 --port 5180 --strictPort');
  });

  it('réserve le port habituel à la plateforme stable et isole le développement', () => {
    expect(vite).toMatch(/server:\s*\{[\s\S]*?port:\s*5181,/);
    const local = launch.configurations.find((entry: { name: string }) => entry.name === 'SONASP Local');
    const dev = launch.configurations.find((entry: { name: string }) => entry.name === 'SONASP Dev');
    expect(local).toMatchObject({ runtimeArgs: ['run', 'start'], port: 5180 });
    expect(local.autoPort).not.toBe(true);
    expect(dev).toMatchObject({ runtimeArgs: ['run', 'dev'], port: 5181 });
    expect(dev.autoPort).not.toBe(true);
  });
});
