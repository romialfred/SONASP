import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logAuditAction, logAuditEvent } from './auditLog';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: { rpc: mocks.rpc },
}));

describe('auditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: undefined, error: null });
  });

  it('journalise une observation via la RPC sans écrire les tables d’audit', async () => {
    await logAuditEvent({
      user_id: '9b3fcaaa-9367-4c91-a82d-788f043f33f1',
      user_email: 'declared@example.test',
      ip_address: '198.51.100.10',
      action: 'APPROVE',
      module: 'Shipping',
      details: 'Préparation observée dans le navigateur',
      status: 'success',
    });

    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith('log_security_event', expect.objectContaining({
      p_event_type: 'client_observation:shipping:approve',
      p_user_id: '9b3fcaaa-9367-4c91-a82d-788f043f33f1',
      p_ip_address: null,
      p_user_agent: null,
      p_details: expect.objectContaining({ source: 'browser_observation' }),
    }));
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain('declared@example.test');
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain('198.51.100.10');
  });

  it('borne les détails et laisse la fonction SQL dériver l’acteur courant', async () => {
    await logAuditAction({
      action: 'update',
      table_name: 'daily_production',
      record_id: 'record-1',
      user_email: 'untrusted@example.test',
      details: { payload: 'x'.repeat(9_000) },
    });

    const [, args] = mocks.rpc.mock.calls[0];
    expect(args.p_user_id).toBeNull();
    expect(args.p_details.details).toEqual({
      truncated: true,
      serialized_length: expect.any(Number),
    });
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain('untrusted@example.test');
  });
});
