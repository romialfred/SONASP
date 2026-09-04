// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { createClient } from '@supabase/supabase-js';

const actorId = '40000000-0000-4000-8000-000000000001';
const targetId = '40000000-0000-4000-8000-000000000002';
const sdkImport = 'npm:@supabase/supabase-js@2.57.4';
let bundle: string;

beforeAll(async () => {
  const result = await build({
    entryPoints: ['supabase/functions/resend-welcome-email/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    external: [sdkImport],
  });
  bundle = result.outputFiles[0].text;
});

function harness(options: { completed?: boolean; mailFailure?: boolean } = {}) {
  const jwt = `header.${Buffer.from(JSON.stringify({ sub: actorId, aal: 'aal2' })).toString('base64url')}.signature`;
  const calls: Array<{ path: string; method: string; body: Record<string, unknown> }> = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
  const fetchHttp: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const body = request.method === 'GET' ? {} : await request.json().catch(() => ({}));
    calls.push({ path: url.pathname, method: request.method, body });

    if (url.pathname === '/auth/v1/user') {
      return json({ id: actorId, email: 'owner@example.invalid' });
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const rpc = url.pathname.split('/').at(-1);
      if (rpc === 'snp_session_signaler_activite') return json({ is_active: true, is_current: true });
      if (rpc === 'snp_actor_has_capability') return json(true);
      if (rpc === 'snp_actor_can_module_action') return json(true);
      if (rpc === 'snp_peut_administrer_compte') return json(true);
      if (rpc === 'log_security_event') return json(null);
    }
    if (url.pathname === '/rest/v1/user_profiles' && request.method === 'GET') {
      const actorQuery = url.searchParams.get('id')?.includes(actorId);
      return actorQuery
        ? json([{ role: 'owner', is_active: true, mining_company_id: null, mfa_enrolled_at: '2026-09-01T08:00:00Z' }])
        : json([{
            id: targetId,
            email: 'nouveau@example.invalid',
            full_name: 'Nouveau compte',
            role: 'customer',
            is_active: true,
            last_login_at: options.completed ? '2026-09-01T09:00:00Z' : null,
            password_changed_at: options.completed ? '2026-09-01T08:30:00Z' : null,
            mfa_enrolled_at: options.completed ? '2026-09-01T08:45:00Z' : null,
            must_change_password: !options.completed,
          }]);
    }
    if (url.pathname === '/rest/v1/user_profiles' && request.method === 'PATCH') return json([]);
    if (url.pathname === '/auth/v1/admin/generate_link') {
      return json({
        id: targetId,
        email: 'nouveau@example.invalid',
        hashed_token: 'nouveau-jeton-hache',
        action_link: 'https://example.invalid',
        verification_type: 'recovery',
      });
    }
    if (url.pathname === '/functions/v1/envoyer-courriel') {
      return options.mailFailure ? json({ envoye: false }, 503) : json({ envoye: true });
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
    async send(body: unknown) {
      const response = await handler(new Request('https://sonasp-test.invalid/functions/v1/resend-welcome-email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }));
      return { status: response.status, body: await response.json() };
    },
  };
}

describe('resend-welcome-email : workflow réel aux frontières HTTP', () => {
  it('remplace le lien, envoie le gabarit de bienvenue et journalise', async () => {
    const h = harness();
    const result = await h.send({ user_id: targetId });

    expect(result).toMatchObject({
      status: 200,
      body: {
        success: true,
        email_sent: true,
        previous_link_replaced: true,
        requires_password_change: true,
        requires_mfa_enrollment: true,
      },
    });
    const envoi = h.calls.find((call) => call.path === '/functions/v1/envoyer-courriel');
    expect(envoi?.body).toMatchObject({
      action: 'bienvenue',
      to: 'nouveau@example.invalid',
      role: 'customer',
    });
    expect(String(envoi?.body.lien_activation)).toMatch(/\/modifier-mot-de-passe\?token_hash=/);
    expect(JSON.stringify(result.body)).not.toMatch(/nouveau-jeton-hache|token_hash/);
    expect(h.calls.some((call) => call.path.endsWith('/log_security_event'))).toBe(true);
  });

  it('refuse un compte déjà enrôlé avant toute génération ou mutation', async () => {
    const h = harness({ completed: true });
    const result = await h.send({ user_id: targetId });
    expect(result.status).toBe(409);
    expect(result.body.error).toMatch(/déjà finalisé/);
    expect(h.calls.some((call) => call.path === '/auth/v1/admin/generate_link')).toBe(false);
    expect(h.calls.some((call) => call.method === 'PATCH')).toBe(false);
  });

  it('ne prétend pas avoir envoyé le courriel lorsque SMTP échoue', async () => {
    const h = harness({ mailFailure: true });
    const result = await h.send({ user_id: targetId });
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ success: false });
    expect(result.body.error).toMatch(/Réessayez le renvoi/);
  });
});
