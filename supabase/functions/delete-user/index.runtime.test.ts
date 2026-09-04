// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { createClient } from '@supabase/supabase-js';

const actorId = '40000000-0000-4000-8000-000000000001';
const targetId = '40000000-0000-4000-8000-000000000002';
const actionId = '40000000-0000-4000-8000-000000000003';
const sdkImport = 'npm:@supabase/supabase-js@2.57.4';
let bundle: string;

beforeAll(async () => {
  const result = await build({
    entryPoints: ['supabase/functions/delete-user/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    external: [sdkImport],
  });
  bundle = result.outputFiles[0].text;
});

function harness(options: { deletionBlocked?: boolean; reusableConfirmed?: boolean } = {}) {
  const jwt = `header.${Buffer.from(JSON.stringify({ sub: actorId, aal: 'aal2' })).toString('base64url')}.signature`;
  const calls: Array<{ path: string; method: string; body: Record<string, unknown> }> = [];
  let targetPresent = true;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
  const fetchHttp: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const body = request.method === 'GET' ? {} : await request.json().catch(() => ({}));
    calls.push({ path: url.pathname, method: request.method, body });

    if (url.pathname === '/auth/v1/user') return json({ id: actorId, email: 'owner@example.invalid' });
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const rpc = url.pathname.split('/').at(-1);
      if (rpc === 'snp_session_signaler_activite') return json({ is_active: true, is_current: true });
      if (rpc === 'snp_actor_has_capability') return json(true);
      if (rpc === 'snp_actor_can_module_action') return json(true);
      if (rpc === 'snp_admin_compte_preparer_suppression') {
        return json({ action_id: actionId, target_id: targetId, status: 'db_completed' });
      }
      if (rpc === 'snp_admin_compte_finaliser_suppression') {
        return json({
          action_id: actionId,
          target_id: targetId,
          status: 'completed',
          email_reusable: options.reusableConfirmed !== false,
        });
      }
      if (rpc === 'snp_admin_compte_finaliser_action') {
        return json({ action_id: actionId, target_id: targetId, status: 'failed' });
      }
    }
    if (url.pathname === '/rest/v1/user_profiles' && request.method === 'GET') {
      if (url.searchParams.get('id')?.includes(actorId)) {
        return json([{ role: 'owner', is_active: true, mining_company_id: null, mfa_enrolled_at: '2026-09-01T08:00:00Z' }]);
      }
      return targetPresent
        ? json([{ id: targetId, email: 'cible@example.invalid', role: 'customer', is_active: true, version: 0 }])
        : json([]);
    }
    if (url.pathname === `/auth/v1/admin/users/${targetId}` && request.method === 'DELETE') {
      if (options.deletionBlocked) return json({ code: 'database_error', message: 'constraint' }, 500);
      targetPresent = false;
      return json({});
    }
    if (url.pathname === `/auth/v1/admin/users/${targetId}` && request.method === 'GET') {
      return targetPresent
        ? json({ id: targetId, email: 'cible@example.invalid' })
        : json({ code: 'user_not_found', message: 'User not found' }, 404);
    }
    throw new Error(`Unexpected HTTP boundary: ${request.method} ${url.pathname}`);
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
    console: { error: vi.fn() },
  });

  return {
    calls,
    async remove() {
      const response = await handler(new Request('https://sonasp-test.invalid/functions/v1/delete-user', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: targetId, motif: 'Suppression définitive demandée pour ce test' }),
      }));
      return { status: response.status, body: await response.json() };
    },
  };
}

describe('delete-user : suppression dure et certification de recréation', () => {
  it('ne confirme le succès qu’après absence Auth, absence profil et libération de l’adresse', async () => {
    const h = harness();
    const result = await h.remove();
    expect(result).toMatchObject({
      status: 200,
      body: { success: true, deleted_user_id: targetId, email_reusable: true },
    });
    expect(h.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: `/auth/v1/admin/users/${targetId}`, method: 'DELETE' }),
      expect.objectContaining({ path: `/auth/v1/admin/users/${targetId}`, method: 'GET' }),
      expect.objectContaining({ path: '/rest/v1/rpc/snp_admin_compte_finaliser_suppression' }),
    ]));
  });

  it('conserve le compte et finalise un échec lorsqu’Auth refuse la suppression', async () => {
    const h = harness({ deletionBlocked: true });
    const result = await h.remove();
    expect(result.status).toBe(409);
    expect(result.body.success).toBe(false);
    expect(result.body.error).toMatch(/dépendance/);
    expect(h.calls.some((call) => call.path.endsWith('/snp_admin_compte_finaliser_action'))).toBe(true);
    expect(h.calls.some((call) => call.path.endsWith('/snp_admin_compte_finaliser_suppression'))).toBe(false);
  });

  it('refuse un succès si la base ne certifie pas la réutilisation de l’adresse', async () => {
    const h = harness({ reusableConfirmed: false });
    const result = await h.remove();
    expect(result.status).toBe(503);
    expect(result.body.operation_state).toBe('deleted_audit_pending');
    expect(result.body.success).toBe(false);
  });
});
