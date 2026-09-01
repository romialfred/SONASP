// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { createClient } from '@supabase/supabase-js';

const actorId = '40000000-0000-4000-8000-000000000001';
const sdkImport = 'npm:@supabase/supabase-js@2.57.4';
let bundle: string;

beforeAll(async () => {
  const result = await build({
    entryPoints: ['supabase/functions/reset-user-password/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    external: [sdkImport],
  });
  bundle = result.outputFiles[0].text;
});

function harness() {
  const jwt = `header.${Buffer.from(JSON.stringify({ sub: actorId, aal: 'aal2' })).toString('base64url')}.signature`;
  const calls: Array<{ path: string; method: string }> = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
  const fetchHttp: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    calls.push({ path, method: request.method });
    if (path === '/auth/v1/user') return json({ id: actorId, email: 'owner@example.invalid' });
    if (path === '/rest/v1/user_profiles' && request.method === 'GET') {
      return json([{ role: 'owner', is_active: true, mining_company_id: null, mfa_enrolled_at: '2026-08-30T12:00:00Z' }]);
    }
    if (path === '/rest/v1/rpc/snp_actor_has_capability') return json(true);
    throw new Error(`Unexpected HTTP boundary: ${request.method} ${path}`);
  };
  let handler!: (req: Request) => Promise<Response>;
  runInNewContext(bundle, {
    require: (name: string) => {
      if (name !== sdkImport) throw new Error(`Unexpected import: ${name}`);
      return {
        createClient: (url: string, key: string, settings: Parameters<typeof createClient>[2]) =>
          createClient(url, key, { ...settings, global: { ...settings?.global, fetch: fetchHttp } }),
      };
    },
    Deno: {
      serve: (fn: typeof handler) => { handler = fn; },
      env: { get: (name: string) => ({
        SUPABASE_URL: 'https://sonasp-test.invalid',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        SUPABASE_ANON_KEY: 'test-anon-key',
        SONASP_APP_URL: 'https://sonasp-test.invalid',
      }[name]) },
    },
    Request,
    Response,
    URL,
    TextDecoder,
    TextEncoder,
    crypto: globalThis.crypto,
    atob,
    fetch: fetchHttp,
    console: { error: vi.fn(), warn: vi.fn() },
  });

  return {
    calls,
    async request(body: string, contentType = 'application/json') {
      const response = await handler(new Request('https://sonasp-test.invalid/functions/v1/reset-user-password', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': contentType },
        body,
      }));
      return { status: response.status, body: await response.json() };
    },
  };
}

describe('reset-user-password : validation HTTP avant mutation', () => {
  it.each([
    ['JSON malformé', '{"user_id":'],
    ['objet trop volumineux', JSON.stringify({ user_id: actorId, remplissage: 'x'.repeat(3_000) })],
    ['propriété inattendue', JSON.stringify({ user_id: actorId, force: true })],
    ['racine non objet', '[]'],
    ['identifiant mal typé', JSON.stringify({ user_id: 42 })],
  ])('refuse un payload %s avec la même erreur générique', async (_, body) => {
    const h = harness();
    const result = await h.request(body);
    expect(result).toEqual({
      status: 400,
      body: { success: false, error: 'La demande de récupération est invalide.' },
    });
    expect(h.calls.some((call) => call.path === '/rest/v1/rpc/snp_peut_administrer_compte')).toBe(false);
    expect(h.calls.some((call) => call.path === '/auth/v1/admin/generate_link')).toBe(false);
  });

  it('refuse un type de contenu non JSON avec la même erreur générique', async () => {
    const h = harness();
    const result = await h.request('{}', 'text/plain');
    expect(result.status).toBe(400);
    expect(result.body.error).toBe('La demande de récupération est invalide.');
  });
});
