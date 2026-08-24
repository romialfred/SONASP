import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { niveauAssurance } from '../_shared/assurance.ts';
import {
  autoriserDocumentSociete,
  parseMetadonneesDocumentSociete,
  type MetadonneesDocumentSociete,
} from '../_shared/company-document-upload-policy.ts';
import { POLITIQUE_DOCUMENT_SOCIETE_MINIERE } from '../_shared/secure-upload.ts';
import {
  createSensitiveUploadHandler,
  type ContextePersistanceUpload,
  type DependancesGatewayUpload,
  type ProfilGatewayUpload,
  type ResultatAutorisationUpload,
} from './handler.ts';

const BUCKET = 'mining-company-documents';
const PROFILE_DOCUMENT_SOCIETE = 'mining-company-document';

const profiles: Record<string, ProfilGatewayUpload> = {
  [PROFILE_DOCUMENT_SOCIETE]: {
    policy: POLITIQUE_DOCUMENT_SOCIETE_MINIERE,
    parseMetadata: parseMetadonneesDocumentSociete,
  },
};

const urlSupabase = Deno.env.get('SUPABASE_URL');
const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const cleAnonyme = Deno.env.get('SUPABASE_ANON_KEY');

if (!urlSupabase || !cleService || !cleAnonyme) {
  console.error('[sensitive-upload] Configuration Supabase incomplète.');
  const indisponible = async (): Promise<never> => {
    throw new Error('upload_gateway_unavailable');
  };
  Deno.serve(createSensitiveUploadHandler({
    profiles,
    authorize: indisponible,
    persist: indisponible,
  }));
} else {
  const admin = createClient(urlSupabase, cleService, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const dependances: DependancesGatewayUpload = {
    profiles,

    async authorize({ profileId, token, metadata }): Promise<ResultatAutorisationUpload> {
      if (profileId !== PROFILE_DOCUMENT_SOCIETE) return { allowed: false, status: 403 };
      const document = metadata as MetadonneesDocumentSociete;

      const { data: authentification, error: erreurAuth } = await admin.auth.getUser(token);
      const utilisateur = authentification.user;
      if (erreurAuth || !utilisateur) return { allowed: false, status: 401 };

      const clientActeur = createClient(urlSupabase, cleAnonyme, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const [profil, cible, capaciteReferentiels, capacitePreparation] = await Promise.all([
        admin
          .from('user_profiles')
          .select('id, is_active, mining_company_id')
          .eq('id', utilisateur.id)
          .maybeSingle(),
        admin
          .from('mining_companies')
          .select('id, is_active')
          .eq('id', document.companyId)
          .maybeSingle(),
        clientActeur.rpc('snp_actor_has_capability', {
          p_capability_code: 'referentials.manage',
        }),
        clientActeur.rpc('snp_actor_has_capability', {
          p_capability_code: 'sonasp.prepare',
        }),
      ]);
      if (
        profil.error || cible.error || capaciteReferentiels.error || capacitePreparation.error
      ) return { allowed: false, status: 503 };
      if (!profil.data || profil.data.id !== utilisateur.id || !cible.data) {
        return { allowed: false, status: 403 };
      }

      const capabilities = new Set<string>();
      if (capaciteReferentiels.data === true) capabilities.add('referentials.manage');
      if (capacitePreparation.data === true) capabilities.add('sonasp.prepare');
      const autorisation = autoriserDocumentSociete({
        actorId: utilisateur.id,
        assurance: niveauAssurance(token),
        actorActive: profil.data.is_active === true,
        actorMiningCompanyId: profil.data.mining_company_id,
        capabilities,
        targetCompanyId: cible.data.id,
        targetCompanyActive: cible.data.is_active === true,
      });
      return autorisation
        ? { allowed: true, ...autorisation }
        : { allowed: false, status: 403 };
    },

    async persist(input: ContextePersistanceUpload) {
      if (input.profileId !== PROFILE_DOCUMENT_SOCIETE) throw new Error('unknown_upload_profile');
      const metadata = input.metadata as MetadonneesDocumentSociete;
      if (metadata.companyId !== input.tenantId) throw new Error('tenant_mismatch');

      const maintenant = new Date();
      const annee = maintenant.getUTCFullYear();
      const mois = String(maintenant.getUTCMonth() + 1).padStart(2, '0');
      const chemin = `${input.tenantId}/format-validated/${annee}/${mois}/${crypto.randomUUID()}.${input.file.extension}`;
      const depot = await admin.storage.from(BUCKET).upload(chemin, input.bytes, {
        contentType: input.file.mimeType,
        cacheControl: '0',
        upsert: false,
      });
      if (depot.error || depot.data.path !== chemin) {
        throw new Error('storage_write_failed');
      }

      const { data: document, error: erreurDocument } = await admin
        .from('mining_company_documents')
        .insert({
          mining_company_id: input.tenantId,
          doc_type: metadata.documentType,
          file_name: input.file.safeFileName,
          file_path: chemin,
          file_size: input.bytes.byteLength,
          mime_type: input.file.mimeType,
          uploaded_by: input.actorId,
        })
        .select('id, mining_company_id, doc_type, file_name, file_path, file_size, mime_type, uploaded_by, created_at')
        .single();

      if (erreurDocument || !document) {
        const nettoyage = await admin.storage.from(BUCKET).remove([chemin]);
        if (nettoyage.error) console.error('[sensitive-upload] Nettoyage Storage incomplet.');
        throw new Error('document_registration_failed');
      }

      // L'audit ne contient ni nom original, ni octets, ni jeton de session.
      const { error: erreurAudit } = await admin.from('security_events').insert({
        user_id: input.actorId,
        event_type: 'sensitive_upload_format_validated',
        details: {
          profile: input.profileId,
          tenant_id: input.tenantId,
          resource_id: document.id,
          mime_type: input.file.mimeType,
          size_bytes: input.bytes.byteLength,
        },
      });
      if (erreurAudit) console.error('[sensitive-upload] Audit secondaire indisponible.');

      return document;
    },
  };

  Deno.serve(createSensitiveUploadHandler(dependances));
}
