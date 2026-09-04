import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

const vercel = JSON.parse(
  readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'),
) as { headers: HeaderRule[] };

const globalHeaders = Object.fromEntries(
  (vercel.headers.find((rule) => rule.source === '/(.*)')?.headers ?? [])
    .map(({ key, value }) => [key, value]),
);

describe('en-têtes de sécurité Vercel', () => {
  it('active HSTS sur les sous-domaines et l’isolation de contexte', () => {
    expect(globalHeaders['Strict-Transport-Security']).toContain('includeSubDomains');
    expect(globalHeaders['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(globalHeaders['Cross-Origin-Resource-Policy']).toBe('same-origin');
  });

  it('interdit les objets, les ancêtres de frame et les scripts arbitraires', () => {
    const csp = globalHeaders['Content-Security-Policy'];
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it('autorise uniquement le script inline connu de la page de purge PWA', () => {
    const html = readFileSync(resolve(process.cwd(), 'public/clear-sw.html'), 'utf8');
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeTruthy();
    const canonicalScript = (script ?? '').replace(/\r\n?/g, '\n');
    const hash = `sha256-${createHash('sha256').update(canonicalScript).digest('base64')}`;
    expect(globalHeaders['Content-Security-Policy']).toContain(`'${hash}'`);
  });

  it('ne met pas en cache le shell et conserve les assets empreintés immuables', () => {
    const cacheFor = (source: string) => vercel.headers
      .find((rule) => rule.source === source)?.headers
      .find(({ key }) => key === 'Cache-Control')?.value;
    expect(cacheFor('/index.html')).toContain('no-store');
    expect(cacheFor('/assets/(.*)')).toContain('immutable');
    expect(cacheFor('/sw.js')).toContain('max-age=0');
  });
});
