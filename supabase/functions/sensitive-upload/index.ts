import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { niveauAssurance } from '../_shared/assurance.ts';
import { supprimerObjetAvecCompensation } from '../_shared/compensated-storage-delete.ts';
import {
  autoriserCertificatAnalyse,
  parseMetadonneesCertificatAnalyse,
  type MetadonneesCertificatAnalyse,
} from '../_shared/assay-certificate-upload-policy.ts';
import {
  autoriserDocumentSociete,
  parseMetadonneesDocumentSociete,
  type MetadonneesDocumentSociete,
} from '../_shared/company-document-upload-policy.ts';
import {
  autoriserDocumentFret,
  parseMetadonneesDocumentFret,
  type MetadonneesDocumentFret,
} from '../_shared/freight-customs-upload-policy.ts';
import {
  POLITIQUE_CERTIFICAT_ANALYSE,
  POLITIQUE_DOCUMENT_EXPEDITION,
  POLITIQUE_DOCUMENT_FRET,
  POLITIQUE_DOCUMENT_PRODUCTION,
  POLITIQUE_DOCUMENT_SOCIETE_MINIERE,
  validerUploadServeur,
} from '../_shared/secure-upload.ts';
import {
  autoriserDocumentWorkflow,
  parseMetadonneesDocumentExpedition,
  parseMetadonneesDocumentProduction,
  type MetadonneesDocumentExpedition,
  type MetadonneesDocumentProduction,
} from '../_shared/workflow-document-upload-policy.ts';
import {
  createSensitiveUploadHandler,
  type ContextePersistanceUpload,
  type DependancesGatewayUpload,
  type ProfilGatewayUpload,
  type ResultatAutorisationUpload,
} from './handler.ts';

const BUCKET_DOCUMENT_SOCIETE = 'mining-company-documents';
const BUCKET_CERTIFICAT_ANALYSE = 'ASSAY-CERTIFICATES';
const BUCKET_DOCUMENT_EXPEDITION = 'shipping-documents';
const BUCKET_DOCUMENT_PRODUCTION = 'production-documents';
const BUCKET_DOCUMENT_FRET = 'freight-customs-documents';
const PROFILE_DOCUMENT_SOCIETE = 'mining-company-document';
const PROFILE_CERTIFICAT_ANALYSE = 'assay-certificate';
const PROFILE_DOCUMENT_EXPEDITION = 'shipping-document';
const PROFILE_DOCUMENT_PRODUCTION = 'production-document';
const PROFILE_DOCUMENT_FRET = 'freight-customs-document';

const profiles: Record<string, ProfilGatewayUpload> = {
  [PROFILE_DOCUMENT_SOCIETE]: {
    policy: POLITIQUE_DOCUMENT_SOCIETE_MINIERE,
    parseMetadata: parseMetadonneesDocumentSociete,
  },
  [PROFILE_CERTIFICAT_ANALYSE]: {
    policy: POLITIQUE_CERTIFICAT_ANALYSE,
    parseMetadata: parseMetadonneesCertificatAnalyse,
  },
  [PROFILE_DOCUMENT_EXPEDITION]: {
    policy: POLITIQUE_DOCUMENT_EXPEDITION,
    parseMetadata: parseMetadonneesDocumentExpedition,
  },
  [PROFILE_DOCUMENT_PRODUCTION]: {
    policy: POLITIQUE_DOCUMENT_PRODUCTION,
    parseMetadata: parseMetadonneesDocumentProduction,
  },
  [PROFILE_DOCUMENT_FRET]: {
    policy: POLITIQUE_DOCUMENT_FRET,
    parseMetadata: parseMetadonneesDocumentFret,
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
      const { data: authentification, error: erreurAuth } = await admin.auth.getUser(token);
      const utilisateur = authentification.user;
      if (erreurAuth || !utilisateur) return { allowed: false, status: 401 };

      const clientActeur = createClient(urlSupabase, cleAnonyme, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      if (profileId === PROFILE_DOCUMENT_SOCIETE) {
        const document = metadata as MetadonneesDocumentSociete;
        const [session, profil, cible, capaciteReferentiels, capacitePreparation] = await Promise.all([
          clientActeur.rpc('snp_session_signaler_activite'),
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
          session.error || profil.error || cible.error
          || capaciteReferentiels.error || capacitePreparation.error
        ) return { allowed: false, status: 503 };
        if (
          (session.data as { is_active?: unknown } | null)?.is_active !== true
          || !profil.data || profil.data.id !== utilisateur.id || !cible.data
        ) return { allowed: false, status: 403 };

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
      }

      if (profileId === PROFILE_CERTIFICAT_ANALYSE) {
        const certificat = metadata as MetadonneesCertificatAnalyse;
        const [session, permission, cible] = await Promise.all([
          clientActeur.rpc('snp_session_signaler_activite'),
          clientActeur.rpc('snp_sec_can_prepare_shipping', {
            p_shipping_id: certificat.shippingPreparationId,
          }),
          admin
            .from('shipping_preparations')
            .select('id')
            .eq('id', certificat.shippingPreparationId)
            .maybeSingle(),
        ]);
        if (session.error || permission.error || cible.error) {
          return { allowed: false, status: 503 };
        }
        const autorisation = autoriserCertificatAnalyse({
          actorId: utilisateur.id,
          activeSession: (session.data as { is_active?: unknown } | null)?.is_active === true,
          canPrepareShipping: permission.data === true,
          shippingPreparationId: certificat.shippingPreparationId,
          targetExists: cible.data?.id === certificat.shippingPreparationId,
        });
        return autorisation
          ? { allowed: true, ...autorisation }
          : { allowed: false, status: 403 };
      }

      if (profileId === PROFILE_DOCUMENT_EXPEDITION) {
        const document = metadata as MetadonneesDocumentExpedition;
        const [session, permission, cible] = await Promise.all([
          clientActeur.rpc('snp_session_signaler_activite'),
          clientActeur.rpc('snp_sec_can_prepare_shipping', {
            p_shipping_id: document.shippingPreparationId,
          }),
          admin.from('shipping_preparations')
            .select('id, mining_company_id')
            .eq('id', document.shippingPreparationId)
            .maybeSingle(),
        ]);
        if (session.error || permission.error || cible.error) {
          return { allowed: false, status: 503 };
        }
        const autorisation = autoriserDocumentWorkflow({
          actorId: utilisateur.id,
          parentId: document.shippingPreparationId,
          tenantId: cible.data?.mining_company_id ?? '',
          activeSession: (session.data as { is_active?: unknown } | null)?.is_active === true,
          aal2: niveauAssurance(token) === 'aal2',
          parentExists: cible.data?.id === document.shippingPreparationId,
          // La RPC inclut AAL2, capability et périmètre société.
          parentPermission: permission.data === true,
          hasWriteCapability: permission.data === true,
        });
        return autorisation
          ? { allowed: true, ...autorisation }
          : { allowed: false, status: 403 };
      }

      if (profileId === PROFILE_DOCUMENT_PRODUCTION) {
        const document = metadata as MetadonneesDocumentProduction;
        const [session, permission, cible, capaciteMine, capaciteSonasp] = await Promise.all([
          clientActeur.rpc('snp_session_signaler_activite'),
          clientActeur.rpc('snp_peut_consulter_production', {
            p_production_id: document.productionId,
          }),
          admin.from('daily_production')
            .select('id, mining_company_id')
            .eq('id', document.productionId)
            .maybeSingle(),
          clientActeur.rpc('snp_actor_has_capability', { p_capability_code: 'mine.operate' }),
          clientActeur.rpc('snp_actor_has_capability', { p_capability_code: 'sonasp.prepare' }),
        ]);
        if (
          session.error || permission.error || cible.error
          || capaciteMine.error || capaciteSonasp.error
        ) return { allowed: false, status: 503 };
        const autorisation = autoriserDocumentWorkflow({
          actorId: utilisateur.id,
          parentId: document.productionId,
          tenantId: cible.data?.mining_company_id ?? '',
          activeSession: (session.data as { is_active?: unknown } | null)?.is_active === true,
          aal2: niveauAssurance(token) === 'aal2',
          parentExists: cible.data?.id === document.productionId,
          parentPermission: permission.data === true,
          hasWriteCapability: capaciteMine.data === true || capaciteSonasp.data === true,
        });
        return autorisation
          ? { allowed: true, ...autorisation }
          : { allowed: false, status: 403 };
      }

      if (profileId === PROFILE_DOCUMENT_FRET) {
        const document = metadata as MetadonneesDocumentFret;
        const [session, capacite, cible] = await Promise.all([
          clientActeur.rpc('snp_session_signaler_activite'),
          clientActeur.rpc('snp_actor_has_capability', { p_capability_code: 'freight.prepare' }),
          admin.from('freight_customs_operations')
            .select('id, mining_company_id, status')
            .eq('id', document.operationId)
            .maybeSingle(),
        ]);
        if (session.error || capacite.error || cible.error || !cible.data) {
          return { allowed: false, status: 503 };
        }
        const portee = await clientActeur.rpc('snp_fret_peut_consulter_tenant', {
          p_mining_company_id: cible.data.mining_company_id,
        });
        if (portee.error) return { allowed: false, status: 503 };
        const autorisation = autoriserDocumentFret({
          actorId: utilisateur.id,
          operationId: document.operationId,
          tenantId: cible.data.mining_company_id ?? '',
          activeSession: (session.data as { is_active?: unknown } | null)?.is_active === true,
          aal2: niveauAssurance(token) === 'aal2',
          operationExists: cible.data.id === document.operationId,
          tenantReadable: portee.data === true,
          canPrepareFreight: capacite.data === true,
          mutableStatus: cible.data.status !== 'shipped_to_refinery',
        });
        return autorisation
          ? { allowed: true, ...autorisation }
          : { allowed: false, status: 403 };
      }

      return { allowed: false, status: 403 };
    },

    async persist(input: ContextePersistanceUpload) {
      const maintenant = new Date();
      const annee = maintenant.getUTCFullYear();
      const mois = String(maintenant.getUTCMonth() + 1).padStart(2, '0');
      const parentId = input.profileId === PROFILE_DOCUMENT_EXPEDITION
        ? (input.metadata as MetadonneesDocumentExpedition).shippingPreparationId
        : input.profileId === PROFILE_DOCUMENT_PRODUCTION
          ? (input.metadata as MetadonneesDocumentProduction).productionId
          : null;
      const operationFretId = input.profileId === PROFILE_DOCUMENT_FRET
        ? (input.metadata as MetadonneesDocumentFret).operationId
        : null;
      // Le premier segment reste l'objet parent : les policies Storage privées
      // existantes en dérivent l'autorisation. Le tenant a été vérifié séparément
      // lors de authorize puis juste avant la persistance.
      const chemin = operationFretId
        ? `freight-customs/${operationFretId}/${crypto.randomUUID()}.${input.file.extension}`
        : parentId
          ? `${parentId}/format-validated/${annee}/${mois}/${crypto.randomUUID()}.${input.file.extension}`
          : `${input.tenantId}/format-validated/${annee}/${mois}/${crypto.randomUUID()}.${input.file.extension}`;

      const profilPersistance = input.profileId === PROFILE_DOCUMENT_SOCIETE
        ? {
          bucket: BUCKET_DOCUMENT_SOCIETE,
          table: 'mining_company_documents',
        }
        : input.profileId === PROFILE_CERTIFICAT_ANALYSE
          ? {
            bucket: BUCKET_CERTIFICAT_ANALYSE,
            table: 'assay_certificates',
          }
          : input.profileId === PROFILE_DOCUMENT_EXPEDITION
            ? {
              bucket: BUCKET_DOCUMENT_EXPEDITION,
              table: 'shipping_documents',
            }
            : input.profileId === PROFILE_DOCUMENT_PRODUCTION
              ? {
                bucket: BUCKET_DOCUMENT_PRODUCTION,
                table: 'production_documents',
              }
              : input.profileId === PROFILE_DOCUMENT_FRET
                ? {
                  bucket: BUCKET_DOCUMENT_FRET,
                  table: 'rpc:snp_fret_ajouter_document',
                }
          : null;
      if (!profilPersistance) throw new Error('unknown_upload_profile');
      if (
        input.profileId === PROFILE_DOCUMENT_SOCIETE
        && (input.metadata as MetadonneesDocumentSociete).companyId !== input.tenantId
      ) throw new Error('tenant_mismatch');
      if (
        input.profileId === PROFILE_CERTIFICAT_ANALYSE
        && (input.metadata as MetadonneesCertificatAnalyse).shippingPreparationId !== input.tenantId
      ) throw new Error('tenant_mismatch');

      if (input.profileId === PROFILE_DOCUMENT_EXPEDITION) {
        const metadata = input.metadata as MetadonneesDocumentExpedition;
        const cible = await admin.from('shipping_preparations')
          .select('id, mining_company_id')
          .eq('id', metadata.shippingPreparationId)
          .maybeSingle();
        if (cible.error || cible.data?.mining_company_id !== input.tenantId) {
          throw new Error('tenant_mismatch');
        }
      }
      if (input.profileId === PROFILE_DOCUMENT_PRODUCTION) {
        const metadata = input.metadata as MetadonneesDocumentProduction;
        const cible = await admin.from('daily_production')
          .select('id, mining_company_id')
          .eq('id', metadata.productionId)
          .maybeSingle();
        if (cible.error || cible.data?.mining_company_id !== input.tenantId) {
          throw new Error('tenant_mismatch');
        }
      }
      if (input.profileId === PROFILE_DOCUMENT_FRET) {
        const metadata = input.metadata as MetadonneesDocumentFret;
        const cible = await admin.from('freight_customs_operations')
          .select('id, mining_company_id, status')
          .eq('id', metadata.operationId)
          .maybeSingle();
        if (
          cible.error || cible.data?.mining_company_id !== input.tenantId
          || cible.data.status === 'shipped_to_refinery'
        ) throw new Error('tenant_mismatch');
      }

      const depot = await admin.storage.from(profilPersistance.bucket).upload(chemin, input.bytes, {
        contentType: input.file.mimeType,
        cacheControl: '0',
        upsert: false,
      });
      if (depot.error || depot.data.path !== chemin) {
        throw new Error('storage_write_failed');
      }

      let ressource: Record<string, unknown> | null = null;
      let erreurRessource: unknown = null;
      try {
        if (input.profileId === PROFILE_DOCUMENT_SOCIETE) {
          const metadata = input.metadata as MetadonneesDocumentSociete;
          const resultat = await admin.from(profilPersistance.table).insert({
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
          ressource = resultat.data;
          erreurRessource = resultat.error;
        } else if (input.profileId === PROFILE_CERTIFICAT_ANALYSE) {
          const resultat = await admin.from(profilPersistance.table).insert({
            shipping_preparation_id: input.tenantId,
            file_name: input.file.safeFileName,
            file_path: chemin,
            file_size: input.bytes.byteLength,
            mime_type: input.file.mimeType,
            uploaded_by: input.actorId,
            parsing_status: 'pending',
            approval_status: 'pending',
            approved_by: null,
            approved_at: null,
          })
            .select('*')
            .single();
          ressource = resultat.data;
          erreurRessource = resultat.error;
        } else if (input.profileId === PROFILE_DOCUMENT_EXPEDITION) {
          const metadata = input.metadata as MetadonneesDocumentExpedition;
          const resultat = await admin.from(profilPersistance.table).insert({
            shipping_preparation_id: metadata.shippingPreparationId,
            title: metadata.title,
            document_url: chemin,
            file_name: input.file.safeFileName,
            file_size: input.bytes.byteLength,
            mime_type: input.file.mimeType,
            uploaded_by: input.actorId,
          }).select('*').single();
          ressource = resultat.data;
          erreurRessource = resultat.error;
        } else if (input.profileId === PROFILE_DOCUMENT_PRODUCTION) {
          const metadata = input.metadata as MetadonneesDocumentProduction;
          const resultat = await admin.from(profilPersistance.table).insert({
            production_id: metadata.productionId,
            document_name: metadata.documentName,
            file_name: input.file.safeFileName,
            file_path: chemin,
            file_size: input.bytes.byteLength,
            file_type: input.file.mimeType,
            uploaded_by: input.actorId,
          }).select('*').single();
          ressource = resultat.data;
          erreurRessource = resultat.error;
        } else if (input.profileId === PROFILE_DOCUMENT_FRET) {
          const metadata = input.metadata as MetadonneesDocumentFret;
          const clientActeur = createClient(urlSupabase, cleAnonyme, {
            auth: { autoRefreshToken: false, persistSession: false },
            global: { headers: { Authorization: `Bearer ${input.token}` } },
          });
          const resultat = await clientActeur.rpc('snp_fret_ajouter_document', {
            p_operation_id: metadata.operationId,
            p_document_type: metadata.documentType,
            p_title: metadata.title,
            p_description: metadata.description,
            p_file_path: chemin,
            p_file_name: input.file.safeFileName,
            p_file_size: input.bytes.byteLength,
            p_mime_type: input.file.mimeType,
          });
          ressource = resultat.data as Record<string, unknown> | null;
          erreurRessource = resultat.error;
        }
      } catch {
        erreurRessource = new Error('document_registration_failed');
      }

      if (erreurRessource || !ressource) {
        try {
          const nettoyage = await admin.storage.from(profilPersistance.bucket).remove([chemin]);
          if (nettoyage.error) console.error('[sensitive-upload] Nettoyage Storage incomplet.');
        } catch {
          console.error('[sensitive-upload] Nettoyage Storage indisponible.');
        }
        throw new Error('document_registration_failed');
      }

      // L'audit ne contient ni nom original, ni octets, ni jeton de session.
      try {
        const { error: erreurAudit } = await admin.from('security_events').insert({
          user_id: input.actorId,
          event_type: 'sensitive_upload_format_validated',
          details: {
            profile: input.profileId,
            tenant_id: input.tenantId,
            resource_id: ressource.id,
            mime_type: input.file.mimeType,
            size_bytes: input.bytes.byteLength,
          },
        });
        if (erreurAudit) console.error('[sensitive-upload] Audit secondaire indisponible.');
      } catch {
        console.error('[sensitive-upload] Audit secondaire indisponible.');
      }

      return ressource;
    },

    async remove({ profileId, resourceId, token }) {
      if (profileId !== PROFILE_DOCUMENT_FRET || niveauAssurance(token) !== 'aal2') {
        throw new Error('delete_not_allowed');
      }
      const { data: authentification, error: erreurAuth } = await admin.auth.getUser(token);
      const utilisateur = authentification.user;
      if (erreurAuth || !utilisateur) throw new Error('delete_not_allowed');
      const clientActeur = createClient(urlSupabase, cleAnonyme, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const document = await admin.from('freight_customs_documents')
        .select('id, freight_customs_operation_id, file_path, file_name, file_size, mime_type')
        .eq('id', resourceId)
        .maybeSingle();
      if (document.error || !document.data) throw new Error('delete_not_allowed');
      const operation = await admin.from('freight_customs_operations')
        .select('id, mining_company_id, status')
        .eq('id', document.data.freight_customs_operation_id)
        .maybeSingle();
      if (operation.error || !operation.data) throw new Error('delete_not_allowed');
      const [session, capacite, portee] = await Promise.all([
        clientActeur.rpc('snp_session_signaler_activite'),
        clientActeur.rpc('snp_actor_has_capability', { p_capability_code: 'freight.prepare' }),
        clientActeur.rpc('snp_fret_peut_consulter_tenant', {
          p_mining_company_id: operation.data.mining_company_id,
        }),
      ]);
      if (
        session.error || capacite.error || portee.error
        || (session.data as { is_active?: unknown } | null)?.is_active !== true
        || capacite.data !== true || portee.data !== true
        || !['customs_pending', 'ready_for_expedition'].includes(operation.data.status)
      ) throw new Error('delete_not_allowed');

      const chemin = document.data.file_path;
      const segments = typeof chemin === 'string' ? chemin.split('/') : [];
      if (
        typeof chemin !== 'string'
        || typeof document.data.file_name !== 'string'
        || typeof document.data.mime_type !== 'string'
        || !Number.isSafeInteger(document.data.file_size)
        || document.data.file_size <= 0
        || document.data.file_size > POLITIQUE_DOCUMENT_FRET.maxBytes
        || segments.length !== 3 || segments[0] !== 'freight-customs'
        || segments[1] !== operation.data.id || segments[2].includes('\\')
      ) throw new Error('delete_not_allowed');
      const sauvegarde = await admin.storage.from(BUCKET_DOCUMENT_FRET).download(chemin);
      if (sauvegarde.error || !sauvegarde.data) throw new Error('storage_backup_failed');
      const octets = new Uint8Array(await sauvegarde.data.arrayBuffer());
      if (octets.byteLength !== document.data.file_size) throw new Error('storage_backup_failed');
      validerUploadServeur({
        fileName: document.data.file_name,
        declaredMimeType: document.data.mime_type,
        bytes: octets,
      }, POLITIQUE_DOCUMENT_FRET);

      await supprimerObjetAvecCompensation({
        expectedPath: chemin,
        async removeObject() {
          const resultat = await admin.storage.from(BUCKET_DOCUMENT_FRET).remove([chemin]);
          if (resultat.error) throw new Error('storage_delete_failed');
        },
        async deleteMetadata() {
          const resultat = await clientActeur.rpc('snp_fret_supprimer_document', {
            p_document_id: resourceId,
          });
          if (resultat.error || typeof resultat.data !== 'string') {
            throw new Error('metadata_delete_failed');
          }
          return resultat.data;
        },
        async restoreObject() {
          const resultat = await admin.storage.from(BUCKET_DOCUMENT_FRET).upload(chemin, octets, {
            contentType: document.data.mime_type,
            cacheControl: '0',
            upsert: false,
          });
          if (resultat.error) throw new Error('storage_restore_failed');
        },
        onRestoreFailure() {
          console.error('[sensitive-upload] Restauration compensatoire fret échouée.');
        },
      });
      try {
        await admin.from('security_events').insert({
          user_id: utilisateur.id,
          event_type: 'sensitive_upload_deleted',
          details: {
            profile: profileId,
            tenant_id: operation.data.mining_company_id,
            resource_id: resourceId,
          },
        });
      } catch {
        console.error('[sensitive-upload] Audit secondaire de suppression indisponible.');
      }
    },
  };

  Deno.serve(createSensitiveUploadHandler(dependances));
}
