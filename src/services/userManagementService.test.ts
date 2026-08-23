import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUser, resetUserPassword } from './userManagementService';

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));

describe('createUser', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'jwt-utilisateur' } },
    });
  });

  it('transmet les habilitations sans exposer de mot de passe', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      success: true,
      user: { id: 'u1', email: 'awa@sonasp.bf', full_name: 'Awa', role: 'admin' },
      email_sent: true,
      requires_password_change: true,
      requires_mfa_enrollment: true,
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }));

    const resultat = await createUser({
      email: 'awa@sonasp.bf',
      full_name: 'Awa',
      role: 'admin',
      permissions: {
        module1: {
          module_id: '9b3fcaaa-9367-4c91-a82d-788f043f33f1',
          can_view: true,
          can_create: false,
          can_edit: false,
          can_delete: false,
          can_approve: false,
          field_permissions: {},
        },
      },
    });

    expect(resultat).toMatchObject({ success: true, email_sent: true });
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    const corps = JSON.parse(String(options.body));
    expect(corps.permissions.module1.can_view).toBe(true);
    expect(corps).not.toHaveProperty('password');
    expect(options.headers).toMatchObject({
      Authorization: 'Bearer jwt-utilisateur',
      apikey: expect.any(String),
      'Content-Type': 'application/json',
    });
  });

  it('traduit une fonction absente en erreur exploitable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }));
    const resultat = await createUser({ email: 'awa@sonasp.bf', full_name: 'Awa', role: 'admin' });
    expect(resultat.success).toBe(false);
    expect(resultat.error).toMatch(/n’est pas déployé/);
  });

  it('ne restitue pas le message technique Failed to fetch', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const resultat = await createUser({ email: 'awa@sonasp.bf', full_name: 'Awa', role: 'admin' });
    expect(resultat).toEqual({
      success: false,
      error: 'Le service de création de compte est momentanément inaccessible.',
    });
  });
});

describe('resetUserPassword', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'jwt-aal2-administrateur' } },
    });
  });

  it('ne transmet que l’identifiant du compte et la preuve de session', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      success: true,
      email_sent: true,
      requires_password_change: true,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const resultat = await resetUserPassword('9b3fcaaa-9367-4c91-a82d-788f043f33f1');

    expect(resultat).toMatchObject({ success: true, email_sent: true });
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.headers).toMatchObject({
      Authorization: 'Bearer jwt-aal2-administrateur',
      apikey: expect.any(String),
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(options.body))).toEqual({
      user_id: '9b3fcaaa-9367-4c91-a82d-788f043f33f1',
    });
    expect(String(options.body)).not.toMatch(/password|token/i);
  });

  it('ne restitue pas une erreur réseau brute', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const resultat = await resetUserPassword('9b3fcaaa-9367-4c91-a82d-788f043f33f1');
    expect(resultat).toEqual({
      success: false,
      error: 'Le service de récupération est momentanément inaccessible.',
    });
  });
});
