import { supabase } from '@/lib/supabase';
import {
  SESSION_ACTIVITY_HEARTBEAT_MS,
  SESSION_INACTIVITY_TIMEOUT_MS,
} from '@/lib/sessionPolicy';

export const SESSION_SERVER_INACTIVITY_TIMEOUT_MS = SESSION_INACTIVITY_TIMEOUT_MS;
export { SESSION_ACTIVITY_HEARTBEAT_MS };

export interface UserSessionSummary {
  id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  browser: string | null;
  location_country: string | null;
  last_activity_at: string;
  expires_at: string;
  is_active: boolean;
  is_current: boolean;
  created_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revocation_reason: string | null;
}

type SessionRpcName =
  | 'snp_session_enregistrer'
  | 'snp_session_signaler_activite'
  | 'snp_sessions_lister'
  | 'snp_session_revoquer'
  | 'snp_sessions_revoquer_toutes';

interface RpcFailure {
  code?: string;
}

interface RpcResult {
  data: unknown;
  error: RpcFailure | null;
}

type SessionRpc = (name: SessionRpcName, args?: Record<string, unknown>) => PromiseLike<RpcResult>;

const rpc = (supabase.rpc as unknown as SessionRpc).bind(supabase);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const FORBIDDEN_RESPONSE_FIELDS = ['session_token', 'token_hash', 'session_hash', 'session_fingerprint'] as const;

export type UserSessionOperation = 'register' | 'heartbeat' | 'list' | 'revoke' | 'revoke-all';

export class UserSessionServiceError extends Error {
  constructor(
    public readonly operation: UserSessionOperation,
    public readonly code: string,
  ) {
    super('La gestion sécurisée des sessions est momentanément indisponible.');
    this.name = 'UserSessionServiceError';
  }
}

function invalidResponse(operation: UserSessionOperation): never {
  throw new UserSessionServiceError(operation, 'INVALID_RESPONSE');
}

function requiredUuid(value: string, operation: UserSessionOperation): string {
  if (!UUID.test(value)) invalidResponse(operation);
  return value;
}

function optionalString(value: unknown, operation: UserSessionOperation): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') invalidResponse(operation);
  return value;
}

function requiredDate(value: unknown, operation: UserSessionOperation): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) invalidResponse(operation);
  return value;
}

function optionalDate(value: unknown, operation: UserSessionOperation): string | null {
  if (value === null) return null;
  return requiredDate(value, operation);
}

function parseSession(value: unknown, operation: UserSessionOperation): UserSessionSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidResponse(operation);
  const row = value as Record<string, unknown>;
  if (FORBIDDEN_RESPONSE_FIELDS.some((field) => field in row)) invalidResponse(operation);
  if (typeof row.id !== 'string' || typeof row.user_id !== 'string') invalidResponse(operation);
  if (typeof row.is_active !== 'boolean' || typeof row.is_current !== 'boolean') invalidResponse(operation);

  return {
    id: requiredUuid(row.id, operation),
    user_id: requiredUuid(row.user_id, operation),
    ip_address: optionalString(row.ip_address, operation),
    user_agent: optionalString(row.user_agent, operation),
    device_type: optionalString(row.device_type, operation),
    browser: optionalString(row.browser, operation),
    location_country: optionalString(row.location_country, operation),
    last_activity_at: requiredDate(row.last_activity_at, operation),
    expires_at: requiredDate(row.expires_at, operation),
    is_active: row.is_active,
    is_current: row.is_current,
    created_at: requiredDate(row.created_at, operation),
    revoked_at: optionalDate(row.revoked_at, operation),
    revoked_by: row.revoked_by === null
      ? null
      : requiredUuid(String(row.revoked_by), operation),
    revocation_reason: optionalString(row.revocation_reason, operation),
  };
}

async function callRpc(
  name: SessionRpcName,
  operation: UserSessionOperation,
  args?: Record<string, unknown>,
): Promise<unknown> {
  let result: RpcResult;
  try {
    result = await rpc(name, args);
  } catch {
    throw new UserSessionServiceError(operation, 'NETWORK');
  }
  if (result.error) {
    throw new UserSessionServiceError(operation, result.error.code || 'RPC_ERROR');
  }
  return result.data;
}

function singleSession(data: unknown, operation: UserSessionOperation): UserSessionSummary {
  if (Array.isArray(data)) {
    if (data.length !== 1) invalidResponse(operation);
    return parseSession(data[0], operation);
  }
  return parseSession(data, operation);
}

function deviceType(userAgent: string): string {
  if (/tablet|ipad/iu.test(userAgent)) return 'tablet';
  if (/mobile|android|iphone/iu.test(userAgent)) return 'mobile';
  return 'desktop';
}

function browserName(userAgent: string): string {
  if (/edg\//iu.test(userAgent)) return 'Edge';
  if (/firefox\//iu.test(userAgent)) return 'Firefox';
  if (/chrome\//iu.test(userAgent)) return 'Chrome';
  if (/safari\//iu.test(userAgent)) return 'Safari';
  return 'Autre';
}

export function isTerminalCurrentSessionError(error: unknown): boolean {
  return error instanceof UserSessionServiceError
    && ['42501', '22023', 'P0002'].includes(error.code);
}

export const userSessionService = {
  async registerCurrentSession(): Promise<UserSessionSummary> {
    const userAgent = navigator.userAgent.slice(0, 1_024);
    const data = await callRpc('snp_session_enregistrer', 'register', {
      p_user_agent: userAgent,
      p_device_type: deviceType(userAgent),
      p_browser: browserName(userAgent),
      p_location_country: null,
    });
    const session = singleSession(data, 'register');
    if (!session.is_active || !session.is_current) invalidResponse('register');
    return session;
  },

  async reportActivity(): Promise<UserSessionSummary> {
    const data = await callRpc('snp_session_signaler_activite', 'heartbeat');
    const session = singleSession(data, 'heartbeat');
    if (!session.is_active || !session.is_current) {
      throw new UserSessionServiceError('heartbeat', 'P0002');
    }
    return session;
  },

  async list(userId?: string, activeOnly = true): Promise<UserSessionSummary[]> {
    if (userId !== undefined) requiredUuid(userId, 'list');
    const data = await callRpc('snp_sessions_lister', 'list', {
      p_user_id: userId ?? null,
      p_actives_seulement: activeOnly,
    });
    if (!Array.isArray(data)) invalidResponse('list');
    const sessions = data.map((row) => parseSession(row, 'list'));
    if (activeOnly && sessions.some((session) => !session.is_active || Date.parse(session.expires_at) <= Date.now())) {
      invalidResponse('list');
    }
    return sessions;
  },

  async revoke(sessionId: string, reason = 'Révocation depuis la gestion des sessions'): Promise<UserSessionSummary> {
    requiredUuid(sessionId, 'revoke');
    const motif = reason.trim();
    if (motif.length < 10 || motif.length > 500) invalidResponse('revoke');
    const data = await callRpc('snp_session_revoquer', 'revoke', {
      p_session_id: sessionId,
      p_motif: motif,
    });
    const session = singleSession(data, 'revoke');
    if (session.is_active || !session.revoked_at) invalidResponse('revoke');
    return session;
  },

  async revokeAll(
    userId?: string,
    exceptCurrentSession = true,
    reason = 'Révocation globale depuis la gestion des sessions',
  ): Promise<number> {
    if (userId !== undefined) requiredUuid(userId, 'revoke-all');
    const motif = reason.trim();
    if (motif.length < 10 || motif.length > 500) invalidResponse('revoke-all');
    const data = await callRpc('snp_sessions_revoquer_toutes', 'revoke-all', {
      p_user_id: userId ?? null,
      p_excepter_session_courante: exceptCurrentSession,
      p_motif: motif,
    });
    if (typeof data !== 'number' || !Number.isSafeInteger(data) || data < 0) invalidResponse('revoke-all');
    return data;
  },
};
