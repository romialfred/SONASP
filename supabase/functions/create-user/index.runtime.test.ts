// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { createClient } from '@supabase/supabase-js';
import { defaultResponsibilitiesForRole } from '../../../src/lib/accessControl';

// Execute the actual Edge entry point and shared guards with the real SDK.
// Only HTTP boundaries are simulated; PostgreSQL/RLS have separate pgTAP tests.
const actorId = '40000000-0000-4000-8000-000000000001';
const targetId = '40000000-0000-4000-8000-000000000002';
const moduleId = '40000000-0000-4000-8000-000000000101';
const sdkImport = 'npm:@supabase/supabase-js@2.57.4';
let bundle: string;
beforeAll(async () => {
  const result = await build({
    entryPoints: ['supabase/functions/create-user/index.ts'], bundle: true,
    platform: 'node', format: 'cjs', write: false, external: [sdkImport],
  });
  bundle = result.outputFiles[0].text;
});

function harness(options: {
  actorRole?: string; active?: boolean; mfa?: boolean; aal?: string;
  sessionActive?: boolean; capability?: boolean; authValid?: boolean;
  duplicate?: boolean; rpcFailure?: string; mailFailure?: boolean;
  profileFailure?: boolean; cleanupFailure?: boolean;
} = {}) {
  const jwt = `header.${Buffer.from(JSON.stringify({ sub: actorId, aal: options.aal ?? 'aal2' })).toString('base64url')}.signature`;
  const calls: Array<{ path: string; method: string; body: Record<string, unknown>; authorization: string | null }> = [];
  const persisted = { auth: false, profile: false, role: '', mail: false };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const failure = () => json({ code: '42501', message: 'Test: refus serveur' }, 403);
  const fetchHttp: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const body = request.method === 'GET' ? {} : await request.json().catch(() => ({}));
    calls.push({ path: url.pathname, method: request.method, body, authorization: request.headers.get('Authorization') });
    const path = url.pathname;
    if (path === '/auth/v1/user') return options.authValid === false ? failure() : json({ id: actorId, email: 'actor@example.invalid' });
    if (path === '/auth/v1/admin/users' && request.method === 'POST') {
      persisted.auth = true;
      return json({ id: targetId, email: body.email });
    }
    if (path === `/auth/v1/admin/users/${targetId}` && request.method === 'DELETE') {
      if (options.cleanupFailure) return failure();
      persisted.auth = false;
      return json({});
    }
    if (path === '/auth/v1/admin/generate_link') return json({ id: targetId, email: 'target@example.invalid', hashed_token: 'test-activation-hash', action_link: 'https://example.invalid', verification_type: 'recovery' });
    if (path.startsWith('/rest/v1/rpc/')) {
      const rpc = path.split('/').at(-1);
      if (rpc === options.rpcFailure) return failure();
      if (rpc === 'snp_session_signaler_activite') return json({ is_active: options.sessionActive !== false, is_current: true });
      if (rpc === 'snp_actor_has_capability') return json(options.capability !== false);
      if (rpc === 'snp_configurer_acces_compte') persisted.role = String(body.p_role);
      return json(null);
    }
    if (path === '/rest/v1/user_profiles' && request.method === 'GET') {
      return json(url.searchParams.has('email')
        ? (options.duplicate ? [{ id: targetId }] : [])
        : [{ role: options.actorRole ?? 'owner', is_active: options.active !== false, mining_company_id: null, mfa_enrolled_at: options.mfa === false ? null : '2026-08-30T12:00:00Z' }]);
    }
    if (path === '/rest/v1/user_profiles' && request.method === 'POST') {
      if (options.profileFailure) return failure();
      persisted.profile = true;
      persisted.role = String(body.role);
      return new Response(null, { status: 201 });
    }
    if (path === '/rest/v1/modules' && request.method === 'GET') return json([{ id: moduleId }]);
    if (path.startsWith('/rest/v1/') && request.method === 'DELETE') {
      if (options.cleanupFailure) return failure();
      if (path.endsWith('/user_profiles')) persisted.profile = false;
      return new Response(null, { status: 204 });
    }
    if (path === '/functions/v1/envoyer-courriel') {
      if (options.mailFailure) return json({ envoye: false }, 503);
      persisted.mail = true;
      return json({ envoye: true });
    }
    throw new Error(`Unexpected HTTP boundary: ${request.method} ${path}`);
  };
  let handler!: (req: Request) => Promise<Response>;
  runInNewContext(bundle, {
    require: (name: string) => {
      if (name !== sdkImport) throw new Error(`Unexpected import: ${name}`);
      return { createClient: (url: string, key: string, settings: Parameters<typeof createClient>[2]) => createClient(url, key, {
        ...settings, global: { ...settings?.global, fetch: fetchHttp },
      }) };
    },
    Deno: { serve: (fn: typeof handler) => { handler = fn; }, env: { get: (name: string) => ({
      SUPABASE_URL: 'https://sonasp-test.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      SUPABASE_ANON_KEY: 'test-anon-key', SONASP_APP_URL: 'https://sonasp-test.invalid',
    }[name]) } },
    Request, Response, URL, crypto: globalThis.crypto, atob, fetch: fetchHttp,
    console: { error: vi.fn() },
  });
  return {
    calls, persisted, jwt,
    async create(role = 'admin', overrides: Record<string, unknown> = {}) {
      const response = await handler(new Request('https://sonasp-test.invalid/functions/v1/create-user', {
        method: 'POST', headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'target@example.invalid', full_name: 'Compte test', role,
          responsibilities: defaultResponsibilitiesForRole(role as 'admin'), ...overrides }),
      }));
      return { status: response.status, body: await response.json() };
    },
  };
}

describe('create-user : exécution du workflow HTTP', () => {
  it.each(['admin', 'owner'])('Owner crée %s avec les choix réels du formulaire et un courriel confirmé', async (role) => {
    const h = harness();
    const result = await h.create(role, { permissions: { [moduleId]: { module_id: moduleId, can_view: true, can_create: true, can_edit: true, can_delete: true, can_approve: true } } });
    expect(result).toMatchObject({ status: 201, body: { success: true, user: { role }, email_sent: true, requires_mfa_enrollment: true } });
    expect(h.persisted).toEqual({ auth: true, profile: true, role, mail: true });
    expect(JSON.stringify(result.body)).not.toMatch(/test-service-key|password"|activation-hash/);
    const rpc = h.calls.find((c) => c.path.endsWith(role === 'owner' ? '/snp_configurer_acces_compte' : '/snp_remplacer_habilitations_compte'));
    expect(rpc?.authorization).toBe(`Bearer ${h.jwt}`);
    if (role === 'owner') {
      expect(h.calls.find((c) => c.path === '/rest/v1/user_profiles' && c.method === 'POST')?.body).toMatchObject({ role: 'customer', is_active: false });
    }
  });

  it.each(['admin', 'owner'])('Admin ne crée pas un compte %s, même par requête forgée', async (role) => {
    const h = harness({ actorRole: 'admin' });
    expect((await h.create(role)).status).toBe(403);
    expect(h.persisted.auth).toBe(false);
    expect(h.calls.some((c) => c.path === '/auth/v1/admin/users')).toBe(false);
  });

  it.each([
    { actorRole: 'customer' }, { active: false }, { mfa: false }, { aal: 'aal1' },
    { sessionActive: false }, { capability: false },
  ])('refuse avant mutation sans toutes les preuves de sécurité : %j', async (options) => {
    const h = harness(options);
    expect((await h.create()).status).toBe(403);
    expect(h.persisted.auth).toBe(false);
  });

  it('refuse un JWT non vérifié par Auth', async () => {
    const h = harness({ authValid: false });
    expect((await h.create()).status).toBe(401);
    expect(h.calls).toHaveLength(1);
  });

  it.each([
    ['inconnue', { 'unknown.enabled': true }, 400],
    ['mal typée', { 'sonasp.prepare': 'true' }, 400],
    ['hors plafond', { 'comptoir.invoices.issue': true }, 403],
    ['incompatible', { 'sonasp.prepare': true, 'sonasp.approve': true }, 403],
  ] as const)('refuse une responsabilité %s avant toute création Auth', async (_, responsibilities, status) => {
    const h = harness();
    const result = await h.create('management', { responsibilities });
    expect(result.status).toBe(status);
    expect(h.persisted.auth).toBe(false);
  });

  it('détecte une adresse déjà utilisée sans mutation', async () => {
    const h = harness({ duplicate: true });
    expect((await h.create()).status).toBe(409);
    expect(h.persisted.auth).toBe(false);
  });

  it.each([
    ['admin', { profileFailure: true }],
    ['owner', { rpcFailure: 'snp_configurer_acces_compte' }],
    ['admin', { rpcFailure: 'snp_remplacer_habilitations_compte' }],
    ['admin', { mailFailure: true }],
    ['owner', { mailFailure: true }],
  ] as const)('compense toute création %s incomplète : %j', async (role, options) => {
    const h = harness(options);
    const result = await h.create(role, { permissions: { [moduleId]: { module_id: moduleId, can_view: true } } });
    expect(result.body.success).toBe(false);
    expect(h.persisted.auth).toBe(false);
    expect(h.persisted.profile).toBe(false);
    expect(h.calls.some((c) => c.path === `/auth/v1/admin/users/${targetId}` && c.method === 'DELETE')).toBe(true);
  });

  it('signale un retour arrière incomplet au lieu de promettre la suppression du compte', async () => {
    const h = harness({ mailFailure: true, cleanupFailure: true });
    const result = await h.create('owner');
    expect(result.status).toBe(500);
    expect(result.body.error).toMatch(/vérifier le compte/);
    expect(result.body.error).not.toMatch(/Aucun compte incomplet/);
    expect(h.persisted.auth).toBe(true);
  });
});
