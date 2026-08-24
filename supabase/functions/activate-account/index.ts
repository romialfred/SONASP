import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { urlModificationMotDePasse } from '../_shared/application-url.ts';
import {
  createActivationHandler,
  type DependancesActivation,
  type IssueTentative,
  type ResultatConsommation,
} from './handler.ts';

const FENETRE_IP_MS = 15 * 60 * 1_000;
const MAX_TENTATIVES_IP = 8;
const FENETRE_GLOBALE_MS = 60 * 1_000;
const MAX_TENTATIVES_GLOBALES = 120;
const TYPE_EVENEMENT = 'activation_token_exchange';

const urlSupabase = Deno.env.get('SUPABASE_URL');
const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

function adresseClient(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf.slice(0, 128);
  const reelle = req.headers.get('x-real-ip')?.trim();
  if (reelle) return reelle.slice(0, 128);
  return (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'indisponible').slice(0, 128);
}

async function empreinteReseau(req: Request, secret: string): Promise<string> {
  const encodeur = new TextEncoder();
  const cle = await crypto.subtle.importKey(
    'raw',
    encodeur.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    cle,
    encodeur.encode(`sonasp:activation-rate-limit:v1:${adresseClient(req)}`),
  );
  return `hmac-sha256:${Array.from(new Uint8Array(signature))
    .map((octet) => octet.toString(16).padStart(2, '0'))
    .join('')}`;
}

if (!urlSupabase || !cleService) {
  console.error('[activate-account] Configuration Supabase incomplète.');
  const indisponible = async (): Promise<never> => {
    throw new Error('activation_service_unavailable');
  };
  // Même en configuration dégradée, le handler commun conserve l'allowlist
  // CORS, les réponses génériques et les en-têtes no-store.
  Deno.serve(createActivationHandler({
    registerAttempt: indisponible,
    consumeToken: indisponible,
    createRecoveryToken: indisponible,
    recordOutcome: indisponible,
  }));
} else {
  const admin = createClient(urlSupabase, cleService, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  // Un secret dédié est préférable. La clé de service, déjà obligatoire et
  // confinée à l'Edge, constitue un repli déterministe qui ne stocke jamais l'IP.
  const secretLimitation = Deno.env.get('ACTIVATION_RATE_LIMIT_SALT') || cleService;

  const dependances: DependancesActivation = {
    async registerAttempt(req) {
      const maintenant = new Date();
      const empreinte = await empreinteReseau(req, secretLimitation);
      const agent = req.headers.get('User-Agent')?.slice(0, 300) || null;

      const { data: tentative, error: erreurInsertion } = await admin
        .from('security_events')
        .insert({
          event_type: TYPE_EVENEMENT,
          ip_address: empreinte,
          user_agent: agent,
          details: { outcome: 'received' },
        })
        .select('id')
        .single();
      if (erreurInsertion || !tentative?.id) throw new Error('security_event_insert_failed');

      const debutIp = new Date(maintenant.getTime() - FENETRE_IP_MS).toISOString();
      const debutGlobal = new Date(maintenant.getTime() - FENETRE_GLOBALE_MS).toISOString();
      const [parIp, global] = await Promise.all([
        admin
          .from('security_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', TYPE_EVENEMENT)
          .eq('ip_address', empreinte)
          .gte('created_at', debutIp),
        admin
          .from('security_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', TYPE_EVENEMENT)
          .gte('created_at', debutGlobal),
      ]);
      if (parIp.error || global.error || parIp.count === null || global.count === null) {
        throw new Error('security_event_count_failed');
      }

      return {
        allowed: parIp.count <= MAX_TENTATIVES_IP && global.count <= MAX_TENTATIVES_GLOBALES,
        attemptId: tentative.id,
      };
    },

    async consumeToken(token, nowIso): Promise<ResultatConsommation | null> {
      // UPDATE conditionnel : un seul appel concurrent peut passer used_at IS NULL.
      // Le rôle de service est présent uniquement dans cette fonction Edge.
      const { data, error } = await admin
        .from('user_activation_tokens')
        .update({ used_at: nowIso })
        .eq('token', token)
        .is('used_at', null)
        .gt('expires_at', nowIso)
        .in('token_type', ['activation', 'password_reset'])
        .select('user_id, token_type')
        .maybeSingle();
      if (error) throw new Error('activation_token_consume_failed');
      if (!data) return null;
      if (data.token_type !== 'activation' && data.token_type !== 'password_reset') return null;
      return { userId: data.user_id, tokenType: data.token_type };
    },

    async createRecoveryToken(userId) {
      const { data: utilisateur, error: erreurUtilisateur } = await admin.auth.admin.getUserById(userId);
      const email = utilisateur.user?.email;
      if (erreurUtilisateur || !email) return null;

      const { data: lien, error: erreurLien } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: urlModificationMotDePasse(Deno.env.get('SONASP_APP_URL')) },
      });
      if (erreurLien) return null;
      return lien.properties?.hashed_token ?? null;
    },

    async recordOutcome(attemptId, outcome: IssueTentative, userId) {
      const { error } = await admin
        .from('security_events')
        .update({
          details: { outcome },
          ...(userId ? { user_id: userId } : {}),
        })
        .eq('id', attemptId)
        .eq('event_type', TYPE_EVENEMENT);
      if (error) throw new Error('security_event_update_failed');
    },
  };

  Deno.serve(createActivationHandler(dependances));
}
