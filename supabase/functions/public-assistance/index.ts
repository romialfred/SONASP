import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type AssistancePayload = {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  category?: unknown;
  subject?: unknown;
  message?: unknown;
  website?: unknown;
  startedAt?: unknown;
};

const allowedCategories = new Set(['access', 'operation', 'incident', 'document', 'other']);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

function allowedOrigin(origin: string | null) {
  if (!origin) return null;
  const configured = (Deno.env.get('PUBLIC_SITE_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured.includes(origin)) return origin;
  try {
    const url = new URL(origin);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return origin;
  } catch {
    return null;
  }
  return null;
}

function response(origin: string, body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
      'Cache-Control': 'no-store',
    },
  });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request: Request) => {
  const origin = allowedOrigin(request.headers.get('origin'));
  if (!origin) return new Response('Origin not allowed', { status: 403 });
  if (request.method === 'OPTIONS') return response(origin, null, 204);
  if (request.method !== 'POST') return response(origin, { message: 'Méthode non autorisée.' }, 405);

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > 12_000) return response(origin, { message: 'Demande trop volumineuse.' }, 413);

  let payload: AssistancePayload;
  try {
    payload = await request.json();
  } catch {
    return response(origin, { message: 'Demande invalide.' }, 400);
  }

  const name = text(payload.name);
  const email = text(payload.email).toLowerCase();
  const company = text(payload.company);
  const category = text(payload.category);
  const subject = text(payload.subject);
  const message = text(payload.message);
  const honeypot = text(payload.website);
  const startedAt = typeof payload.startedAt === 'number' ? payload.startedAt : 0;
  const elapsed = Date.now() - startedAt;

  if (
    honeypot || elapsed < 1_800 || elapsed > 86_400_000 ||
    name.length < 2 || name.length > 160 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
    company.length > 180 || !allowedCategories.has(category) ||
    subject.length < 5 || subject.length > 200 ||
    message.length < 20 || message.length > 5_000
  ) {
    return response(origin, { message: 'Vérifiez les informations transmises.' }, 422);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const hashSalt = Deno.env.get('ASSISTANCE_HASH_SALT');
  if (!supabaseUrl || !serviceRoleKey || !hashSalt) {
    return response(origin, { message: 'Service momentanément indisponible.' }, 503);
  }

  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = request.headers.get('cf-connecting-ip') ?? forwardedFor ?? 'unknown';
  const [ipHash, emailHash] = await Promise.all([
    sha256(`${hashSalt}:ip:${ip}`),
    sha256(`${hashSalt}:email:${email}`),
  ]);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from('public_support_requests')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)
    .or(`ip_hash.eq.${ipHash},email_hash.eq.${emailHash}`);

  if (countError) return response(origin, { message: 'Service momentanément indisponible.' }, 503);
  if ((count ?? 0) >= 5) return response(origin, { message: 'Trop de demandes ont été transmises. Réessayez plus tard.' }, 429);

  const userAgent = (request.headers.get('user-agent') ?? '').slice(0, 255) || null;
  const { data, error } = await supabase
    .from('public_support_requests')
    .insert({
      requester_name: name,
      requester_email: email,
      company_name: company || null,
      category,
      subject,
      message,
      email_hash: emailHash,
      ip_hash: ipHash,
      user_agent: userAgent,
    })
    .select('id')
    .single();

  if (error) return response(origin, { message: 'Service momentanément indisponible.' }, 503);
  return response(origin, { requestId: data.id }, 201);
});
