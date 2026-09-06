import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { artisanDocumentAccess, parseArtisanDocument, persistArtisanDocument, removeArtisanDocument, type ArtisanDocumentMetadata } from '../_shared/artisan-document-upload.ts';
import { niveauAssurance } from '../_shared/assurance.ts';
import { supprimerObjetAvecCompensation } from '../_shared/compensated-storage-delete.ts';
import {
  autoriserSuppressionDocumentSensible,
  cheminObjetLieAuParent,
} from '../_shared/sensitive-document-delete-policy.ts';
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
  autoriserPreuvePaiement,
  confirmerPersistancePreuvePaiement,
  parseMetadonneesPreuvePaiement,
  type MetadonneesPreuvePaiement,
} from '../_shared/payment-proof-upload-policy.ts';
import {
  POLITIQUE_CERTIFICAT_ANALYSE,
  POLITIQUE_DOCUMENT_EXPEDITION,
  POLITIQUE_DOCUMENT_FRET,
  POLITIQUE_DOCUMENT_PRODUCTION,
  POLITIQUE_DOCUMENT_SOCIETE_MINIERE,
  POLITIQUE_PREUVE_PAIEMENT,
  POLITIQUE_DOCUMENT_RESERVE,
  POLITIQUE_DOCUMENT_ARTISAN,
  validerUploadServeur,
} from '../_shared/secure-upload.ts';
import {
  autoriserDocumentWorkflow,
  parseMetadonneesDocumentExpedition,
  parseMetadonneesDocumentProduction,
  parseMetadonneesDocumentReserve,
  type MetadonneesDocumentExpedition,
  type MetadonneesDocumentProduction,
  type MetadonneesDocumentReserve,
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
const BUCKET_PREUVE_PAIEMENT = 'payment-proofs';
const BUCKET_DOCUMENT_RESERVE = 'reserve-documents';
const PROFILE_DOCUMENT_SOCIETE = 'mining-company-document';
const PROFILE_CERTIFICAT_ANALYSE = 'assay-certificate';
const PROFILE_DOCUMENT_EXPEDITION = 'shipping-document';
const PROFILE_DOCUMENT_PRODUCTION = 'production-document';
const PROFILE_DOCUMENT_FRET = 'freight-customs-document';
const PROFILE_PREUVE_PAIEMENT = 'international-payment-proof';
const PROFILE_DOCUMENT_RESERVE = 'reserve-allocation-document';
const PROFILS_SUPPRESSION_DOCUMENTAIRE = new Set([
  'artisan-document',
  PROFILE_DOCUMENT_SOCIETE,
  PROFILE_CERTIFICAT_ANALYSE,
  PROFILE_DOCUMENT_EXPEDITION,
  PROFILE_DOCUMENT_PRODUCTION,
  PROFILE_DOCUMENT_FRET,
  PROFILE_DOCUMENT_RESERVE,
]);

const profiles: Record<string, ProfilGatewayUpload> = {
  'artisan-document': { policy: POLITIQUE_DOCUMENT_ARTISAN, parseMetadata: parseArtisanDocument },
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
  [PROFILE_PREUVE_PAIEMENT]: {
    policy: POLITIQUE_PREUVE_PAIEMENT,
    parseMetadata: parseMetadonneesPreuvePaiement,
  },
  [PROFILE_DOCUMENT_RESERVE]: {
    policy: POLITIQUE_DOCUMENT_RESERVE,
    parseMetadata: parseMetadonneesDocumentReserve,
  },
};

async function sha256Hex(octets: Uint8Array): Promise<string> {
  // Deno 2 distingue ArrayBuffer de SharedArrayBuffer dans WebCrypto.
  const copie = new Uint8Array(octets.byteLength);
  copie.set(octets);
  const empreinte = await crypto.subtle.digest('SHA-256', copie.buffer);
  return Array.from(new Uint8Array(empreinte), (octet) => octet.toString(16).padStart(2, '0')).join('');
}

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
        const [session, profil, cible, capaciteReferentiels, capacitePreparation, registreMinier] = await Promise.all([
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
          clientActeur.rpc('snp_peut_gerer_sites_artisanaux'),
        ]);
        if (
          session.error || profil.error || cible.error
          || capaciteReferentiels.error || capacitePreparation.error || registreMinier.error
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
          canManageMiningRegistry: registreMinier.data === true,
          targetCompanyId: cible.data.id,
          targetCompanyActive: cible.data.is_active === true,
        });
        return autorisation
          ? { allowed: true, ...autorisation }
          : { allowed: false, status: 403 };
      }

      if (profileId === 'artisan-document') {
        const m = metadata as ArtisanDocumentMetadata;
        return await artisanDocumentAccess(clientActeur, token, m.artisanId)
          ? { allowed: true, actorId: utilisateur.id, tenantId: m.artisanId }
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

      if (profileId === PROFILE_DOCUMENT_RESERVE) {
        const document = metadata as MetadonneesDocumentReserve;
        const [session, permission, brouillon] = await Promise.all([
          clientActeur.rpc('snp_session_signaler_activite'),
          clientActeur.rpc('snp_reserve_permission_allowed', {
            p_permission: 'reserve.allocations.edit',
          }),
          clientActeur.rpc('snp_reserve_draft_owned_or_owner', {
            p_allocation_id: document.allocationId,
          }),
        ]);
        if (session.error || permission.error || brouillon.error) {
          return { allowed: false, status: 503 };
        }
        const autorisation = autoriserDocumentWorkflow({
          actorId: utilisateur.id,
          parentId: document.allocationId,
          tenantId: document.allocationId,
          activeSession: (session.data as { is_active?: unknown } | null)?.is_active === true,
          aal2: niveauAssurance(token) === 'aal2',
          parentExists: brouillon.data === true,
          parentPermission: permission.data === true,
          hasWriteCapability: permission.data === true,
        });
        return autorisation
          ? { allowed: true, ...autorisation }
          : { allowed: false, status: 403 };
      }

      if (profileId === PROFILE_PREUVE_PAIEMENT) {
        const preuve = metadata as MetadonneesPreuvePaiement;
        const [session, capacite, paiement] = await Promise.all([
          clientActeur.rpc('snp_session_signaler_activite'),
          clientActeur.rpc('snp_actor_has_capability', {
            p_capability_code: 'sonasp.finance.execute',
          }),
          admin.from('payments')
            .select('id, sale_id, customer_id, status, executed_by')
            .eq('id', preuve.paymentId)
            .maybeSingle(),
        ]);
        if (session.error || capacite.error || paiement.error) {
          return { allowed: false, status: 503 };
        }
        if (!paiement.data) return { allowed: false, status: 403 };

        const vente = await admin.from('sales')
          .select('id, customer_id, seller_id, seller_type, status')
          .eq('id', paiement.data.sale_id)
          .maybeSingle();
        if (vente.error) return { allowed: false, status: 503 };
        if (!vente.data) return { allowed: false, status: 403 };
        const [lecture, vendeur] = await Promise.all([
          clientActeur.rpc('snp_peut_consulter_vente', { p_sale_id: vente.data.id }),
          admin.from('mining_companies')
            .select('id, code, is_active')
            .eq('id', vente.data.seller_id)
            .maybeSingle(),
        ]);
        if (lecture.error || vendeur.error) return { allowed: false, status: 503 };

        const autorisation = autoriserPreuvePaiement({
          actorId: utilisateur.id,
          paymentId: preuve.paymentId,
          saleId: vente.data.id,
          tenantId: vente.data.customer_id ?? '',
          activeSession: (session.data as { is_active?: unknown } | null)?.is_active === true,
          aal2: niveauAssurance(token) === 'aal2',
          canExecuteFinance: capacite.data === true,
          canReadSale: lecture.data === true,
          paymentExists: paiement.data.id === preuve.paymentId,
          paymentProcessing: paiement.data.status === 'processing',
          saleVirtualPayment: vente.data.status === 'virtual_payment',
          actorExecutedPayment: paiement.data.executed_by === utilisateur.id,
          paymentMatchesSaleAndTenant: paiement.data.sale_id === vente.data.id
            && paiement.data.customer_id === vente.data.customer_id,
          sellerIsActiveSonasp: vente.data.seller_type === 'sonasp'
            && vendeur.data?.id === vente.data.seller_id
            && vendeur.data?.is_active === true
            && vendeur.data?.code?.toUpperCase() === 'SONASP',
        });
        return autorisation
          ? { allowed: true, ...autorisation }
          : { allowed: false, status: 403 };
      }

      return { allowed: false, status: 403 };
    },

    async persist(input: ContextePersistanceUpload) {
      if (input.profileId === 'artisan-document') {
        const client = createClient(urlSupabase, cleAnonyme, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${input.token}` } } });
        return persistArtisanDocument(admin, client, input);
      }
      const maintenant = new Date();
      const annee = maintenant.getUTCFullYear();
      const mois = String(maintenant.getUTCMonth() + 1).padStart(2, '0');
      const parentId = input.profileId === PROFILE_DOCUMENT_EXPEDITION
        ? (input.metadata as MetadonneesDocumentExpedition).shippingPreparationId
        : input.profileId === PROFILE_DOCUMENT_PRODUCTION
          ? (input.metadata as MetadonneesDocumentProduction).productionId
          : input.profileId === PROFILE_DOCUMENT_RESERVE
            ? (input.metadata as MetadonneesDocumentReserve).allocationId
            : null;
      const operationFretId = input.profileId === PROFILE_DOCUMENT_FRET
        ? (input.metadata as MetadonneesDocumentFret).operationId
        : null;
      const preuvePaiement = input.profileId === PROFILE_PREUVE_PAIEMENT
        ? input.metadata as MetadonneesPreuvePaiement
        : null;
      // Le premier segment reste l'objet parent : les policies Storage privées
      // existantes en dérivent l'autorisation. Le tenant a été vérifié séparément
      // lors de authorize puis juste avant la persistance.
      const chemin = preuvePaiement
        ? `${preuvePaiement.paymentId}/${preuvePaiement.idempotencyKey}.${input.file.extension}`
        : operationFretId
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
                : input.profileId === PROFILE_PREUVE_PAIEMENT
                  ? {
                    bucket: BUCKET_PREUVE_PAIEMENT,
                    table: 'rpc:snp_paiement_preuve_rattacher',
                  }
                  : input.profileId === PROFILE_DOCUMENT_RESERVE
                    ? {
                      bucket: BUCKET_DOCUMENT_RESERVE,
                      table: 'rpc:snp_register_reserve_document',
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
      if (input.profileId === PROFILE_DOCUMENT_RESERVE) {
        const metadata = input.metadata as MetadonneesDocumentReserve;
        const clientActeur = createClient(urlSupabase, cleAnonyme, {
          auth: { autoRefreshToken: false, persistSession: false },
          global: { headers: { Authorization: `Bearer ${input.token}` } },
        });
        const [permission, brouillon] = await Promise.all([
          clientActeur.rpc('snp_reserve_permission_allowed', {
            p_permission: 'reserve.allocations.edit',
          }),
          clientActeur.rpc('snp_reserve_draft_owned_or_owner', {
            p_allocation_id: metadata.allocationId,
          }),
        ]);
        if (
          permission.error || brouillon.error
          || permission.data !== true || brouillon.data !== true
          || input.tenantId !== metadata.allocationId
        ) throw new Error('tenant_mismatch');
      }

      if (input.profileId === PROFILE_PREUVE_PAIEMENT) {
        const metadata = input.metadata as MetadonneesPreuvePaiement;
        const paiement = await admin.from('payments')
          .select('id, sale_id, customer_id, status, executed_by')
          .eq('id', metadata.paymentId)
          .maybeSingle();
        if (paiement.error || !paiement.data) throw new Error('tenant_mismatch');
        const vente = await admin.from('sales')
          .select('id, customer_id, status')
          .eq('id', paiement.data.sale_id)
          .maybeSingle();
        if (
          vente.error || !vente.data
          || paiement.data.customer_id !== input.tenantId
          || vente.data.customer_id !== input.tenantId
          || paiement.data.status !== 'processing'
          || vente.data.status !== 'virtual_payment'
          || paiement.data.executed_by !== input.actorId
        ) throw new Error('tenant_mismatch');
      }

      const empreinteSha256 = await sha256Hex(input.bytes);
      const referenceCanonique = input.profileId === PROFILE_PREUVE_PAIEMENT
        ? `${BUCKET_PREUVE_PAIEMENT}/${chemin}`
        : chemin;
      const metadonneesObjet = input.profileId === PROFILE_PREUVE_PAIEMENT
        ? {
          sha256: empreinteSha256,
          safe_file_name: input.file.safeFileName,
          payment_id: (input.metadata as MetadonneesPreuvePaiement).paymentId,
          idempotency_key: (input.metadata as MetadonneesPreuvePaiement).idempotencyKey,
          uploaded_by: input.actorId,
        }
        : undefined;
      let objetCree = false;
      const depot = await admin.storage.from(profilPersistance.bucket).upload(chemin, input.bytes, {
        contentType: input.file.mimeType,
        cacheControl: '0',
        upsert: false,
        ...(metadonneesObjet ? { metadata: metadonneesObjet } : {}),
      });
      if (!depot.error && depot.data.path === chemin) {
        objetCree = true;
      } else if (input.profileId === PROFILE_PREUVE_PAIEMENT) {
        // Rejeu après une réponse perdue ou après un échec de metadata : le
        // chemin est déterministe. On ne réutilise l'objet que si son contenu
        // est strictement identique au binaire à nouveau validé.
        const existant = await admin.storage.from(profilPersistance.bucket).download(chemin);
        if (existant.error || !existant.data) throw new Error('storage_write_failed');
        const octetsExistants = new Uint8Array(await existant.data.arrayBuffer());
        if (
          octetsExistants.byteLength !== input.bytes.byteLength
          || await sha256Hex(octetsExistants) !== empreinteSha256
        ) throw new Error('idempotency_content_mismatch');
        // Repose aussi les metadonnees calculees par le serveur. Elles sont la
        // source de comparaison de la RPC et ne sont jamais fournies librement
        // par le navigateur.
        const miseAJour = await admin.storage.from(profilPersistance.bucket).update(
          chemin,
          input.bytes,
          {
            contentType: input.file.mimeType,
            cacheControl: '0',
            metadata: metadonneesObjet,
          },
        );
        if (miseAJour.error || miseAJour.data.path !== chemin) {
          throw new Error('storage_metadata_write_failed');
        }
      } else {
        throw new Error('storage_write_failed');
      }

      let ressource: Record<string, unknown> | null = null;
      let erreurRessource: unknown = null;
      let resultatPersistanceCertain = true;
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
        } else if (input.profileId === PROFILE_DOCUMENT_RESERVE) {
          const metadata = input.metadata as MetadonneesDocumentReserve;
          const resultat = await admin.rpc('snp_register_reserve_document_gateway', {
            p_allocation_id: metadata.allocationId,
            p_document_type: metadata.documentType,
            p_file_name: input.file.safeFileName,
            p_storage_path: chemin,
            p_mime_type: input.file.mimeType,
            p_size_bytes: input.bytes.byteLength,
            p_actor_id: input.actorId,
          });
          if (!resultat.error && typeof resultat.data === 'string') {
            const confirmation = await admin.from('reserve_allocation_documents')
              .select('id,allocation_id,document_type,file_name,storage_path,mime_type,size_bytes,uploaded_by,uploaded_at')
              .eq('id', resultat.data)
              .eq('allocation_id', metadata.allocationId)
              .eq('storage_path', chemin)
              .maybeSingle();
            ressource = confirmation.data as Record<string, unknown> | null;
            erreurRessource = confirmation.error;
          } else {
            ressource = null;
            erreurRessource = resultat.error ?? new Error('reserve_document_confirmation_failed');
          }
        } else if (input.profileId === PROFILE_PREUVE_PAIEMENT) {
          const metadata = input.metadata as MetadonneesPreuvePaiement;
          const clientActeur = createClient(urlSupabase, cleAnonyme, {
            auth: { autoRefreshToken: false, persistSession: false },
            global: { headers: { Authorization: `Bearer ${input.token}` } },
          });
          try {
            const resultat = await clientActeur.rpc('snp_paiement_preuve_rattacher', {
              p_payment_id: metadata.paymentId,
              p_file_path: referenceCanonique,
              p_file_name: input.file.safeFileName,
              p_file_size: input.bytes.byteLength,
              p_mime_type: input.file.mimeType,
              p_sha256: empreinteSha256,
              p_idempotency_key: metadata.idempotencyKey,
            });
            ressource = resultat.data as Record<string, unknown> | null;
            erreurRessource = resultat.error;
          } catch {
            ressource = null;
            erreurRessource = new Error('payment_proof_rpc_transport_unknown');
          }
          if (
            ressource
            && (ressource.payment_id !== metadata.paymentId
              || ressource.file_path !== referenceCanonique
              || ressource.idempotency_key !== metadata.idempotencyKey
              || ressource.sha256 !== empreinteSha256)
          ) {
            ressource = null;
            erreurRessource = new Error('payment_proof_confirmation_mismatch');
          }

          if (erreurRessource || !ressource) {
            // Une erreur de transport peut survenir apres COMMIT. La relecture
            // service-role (SELECT seul, octroye au gateway) distingue un
            // resultat commite d'un refus certain. En cas d'indisponibilite de
            // la relecture, l'objet prive est conserve pour reprise/TTL : le
            // supprimer pourrait casser une metadata deja commitee.
            resultatPersistanceCertain = false;
            try {
              const confirmation = await admin.from('snp_payment_proofs')
                .select('id,payment_id,sale_id,customer_id,file_path,file_name,file_size,mime_type,sha256,idempotency_key,uploaded_by,created_at')
                .eq('payment_id', metadata.paymentId)
                .eq('idempotency_key', metadata.idempotencyKey)
                .maybeSingle();
              const resolution = confirmerPersistancePreuvePaiement(
                confirmation.error
                  ? undefined
                  : confirmation.data as Record<string, unknown> | null,
                {
                  paymentId: metadata.paymentId,
                  filePath: referenceCanonique,
                  idempotencyKey: metadata.idempotencyKey,
                  sha256: empreinteSha256,
                  fileName: input.file.safeFileName,
                  fileSize: input.bytes.byteLength,
                  mimeType: input.file.mimeType,
                },
              );
              resultatPersistanceCertain = resolution.certain;
              if (resolution.resource) {
                ressource = resolution.resource;
                erreurRessource = null;
              }
            } catch {
              // Resultat inconnu : conservation privee pour reprise/TTL.
            }
          }
        }
      } catch {
        erreurRessource = new Error('document_registration_failed');
      }

      if (erreurRessource || !ressource) {
        if (objetCree && resultatPersistanceCertain) {
          try {
            const nettoyage = await admin.storage.from(profilPersistance.bucket).remove([chemin]);
            if (nettoyage.error) console.error('[sensitive-upload] Nettoyage Storage incomplet.');
          } catch {
            console.error('[sensitive-upload] Nettoyage Storage indisponible.');
          }
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
      if (!PROFILS_SUPPRESSION_DOCUMENTAIRE.has(profileId) || niveauAssurance(token) !== 'aal2') {
        throw new Error('delete_not_allowed');
      }
      const { data: authentification, error: erreurAuth } = await admin.auth.getUser(token);
      const utilisateur = authentification.user;
      if (erreurAuth || !utilisateur) throw new Error('delete_not_allowed');
      const clientActeur = createClient(urlSupabase, cleAnonyme, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      if (profileId === 'artisan-document') {
        await removeArtisanDocument(admin, clientActeur, token, utilisateur.id, resourceId);
        return;
      }
      if (profileId === PROFILE_DOCUMENT_RESERVE) {
        const document = await admin.from('reserve_allocation_documents')
          .select('id,allocation_id,storage_path,file_name,size_bytes,mime_type,deleted_at')
          .eq('id', resourceId)
          .maybeSingle();
        if (document.error || !document.data || document.data.deleted_at) {
          throw new Error('delete_not_allowed');
        }
        const [session, permission, brouillon] = await Promise.all([
          clientActeur.rpc('snp_session_signaler_activite'),
          clientActeur.rpc('snp_reserve_permission_allowed', {
            p_permission: 'reserve.allocations.edit',
          }),
          clientActeur.rpc('snp_reserve_draft_owned_or_owner', {
            p_allocation_id: document.data.allocation_id,
          }),
        ]);
        if (
          session.error || permission.error || brouillon.error
          || (session.data as { is_active?: unknown } | null)?.is_active !== true
          || permission.data !== true || brouillon.data !== true
        ) throw new Error('delete_not_allowed');
        const chemin = document.data.storage_path;
        const segments = typeof chemin === 'string' ? chemin.split('/') : [];
        if (
          typeof chemin !== 'string'
          || segments.length !== 5 || segments[0] !== document.data.allocation_id
          || segments[1] !== 'format-validated' || segments.some((segment) => segment.includes('\\'))
          || typeof document.data.file_name !== 'string'
          || typeof document.data.mime_type !== 'string'
          || !Number.isSafeInteger(document.data.size_bytes)
          || document.data.size_bytes <= 0
          || document.data.size_bytes > POLITIQUE_DOCUMENT_RESERVE.maxBytes
        ) throw new Error('delete_not_allowed');
        const reserveMimeType = document.data.mime_type;
        const sauvegarde = await admin.storage.from(BUCKET_DOCUMENT_RESERVE).download(chemin);
        if (sauvegarde.error || !sauvegarde.data) throw new Error('storage_backup_failed');
        const octets = new Uint8Array(await sauvegarde.data.arrayBuffer());
        if (octets.byteLength !== document.data.size_bytes) throw new Error('storage_backup_failed');
        validerUploadServeur({
          fileName: document.data.file_name,
          declaredMimeType: document.data.mime_type,
          bytes: octets,
        }, POLITIQUE_DOCUMENT_RESERVE);
        const auditAutorisation = await admin.from('security_events').insert({
          user_id: utilisateur.id,
          event_type: 'sensitive_upload_delete_authorized',
          details: {
            profile: profileId,
            tenant_id: document.data.allocation_id,
            parent_id: document.data.allocation_id,
            resource_id: resourceId,
          },
        });
        if (auditAutorisation.error) throw new Error('delete_audit_unavailable');
        await supprimerObjetAvecCompensation({
          expectedPath: chemin,
          async removeObject() {
            const resultat = await admin.storage.from(BUCKET_DOCUMENT_RESERVE).remove([chemin]);
            if (resultat.error) throw new Error('storage_delete_failed');
          },
          async deleteMetadata() {
            const resultat = await admin.rpc('snp_delete_reserve_document_gateway', {
              p_document_id: resourceId,
              p_actor_id: utilisateur.id,
            });
            if (resultat.error || resultat.data !== chemin) throw new Error('metadata_delete_failed');
            return resultat.data;
          },
          async restoreObject() {
            const resultat = await admin.storage.from(BUCKET_DOCUMENT_RESERVE).upload(chemin, octets, {
              contentType: reserveMimeType,
              cacheControl: '0',
              upsert: false,
            });
            if (resultat.error) throw new Error('storage_restore_failed');
          },
          onRestoreFailure() {
            console.error('[sensitive-upload] Restauration compensatoire réserve échouée.');
          },
        });
        try {
          await admin.from('security_events').insert({
            user_id: utilisateur.id,
            event_type: 'sensitive_upload_deleted',
            details: {
              profile: profileId,
              tenant_id: document.data.allocation_id,
              resource_id: resourceId,
            },
          });
        } catch {
          console.error('[sensitive-upload] Audit secondaire de suppression réserve indisponible.');
        }
        return;
      }
      if (profileId === PROFILE_DOCUMENT_FRET) {
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
      const fretMimeType = document.data.mime_type;
      const sauvegarde = await admin.storage.from(BUCKET_DOCUMENT_FRET).download(chemin);
      if (sauvegarde.error || !sauvegarde.data) throw new Error('storage_backup_failed');
      const octets = new Uint8Array(await sauvegarde.data.arrayBuffer());
      if (octets.byteLength !== document.data.file_size) throw new Error('storage_backup_failed');
      validerUploadServeur({
        fileName: document.data.file_name,
        declaredMimeType: document.data.mime_type,
        bytes: octets,
      }, POLITIQUE_DOCUMENT_FRET);

      const auditAutorisation = await admin.from('security_events').insert({
        user_id: utilisateur.id,
        event_type: 'sensitive_upload_delete_authorized',
        details: {
          profile: profileId,
          tenant_id: operation.data.mining_company_id,
          parent_id: operation.data.id,
          resource_id: resourceId,
        },
      });
      if (auditAutorisation.error) throw new Error('delete_audit_unavailable');

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
            contentType: fretMimeType,
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
        return;
      }

      let table = '';
      let bucket = '';
      let parentField = '';
      let pathField = '';
      let parentId = '';
      let tenantId = '';
      let reference: unknown = null;
      let fileName: unknown = null;
      let fileSize: unknown = null;
      let mimeType: unknown = null;
      let uploadedBy: string | null = null;
      let parentExists = false;
      let parentPermission = false;
      let hasWriteCapability = false;
      let mayDeleteAnyUploader = false;
      let mutable = true;
      let politique = POLITIQUE_DOCUMENT_PRODUCTION;

      const [session, preparationSonasp] = await Promise.all([
        clientActeur.rpc('snp_session_signaler_activite'),
        clientActeur.rpc('snp_actor_has_capability', { p_capability_code: 'sonasp.prepare' }),
      ]);
      if (
        session.error || preparationSonasp.error
        || (session.data as { is_active?: unknown } | null)?.is_active !== true
      ) throw new Error('delete_not_allowed');

      if (profileId === PROFILE_DOCUMENT_EXPEDITION) {
        const document = await admin.from('shipping_documents')
          .select('id, shipping_preparation_id, document_url, file_name, file_size, mime_type, uploaded_by')
          .eq('id', resourceId)
          .maybeSingle();
        if (document.error || !document.data) throw new Error('delete_not_allowed');
        const parent = await admin.from('shipping_preparations')
          .select('id, mining_company_id')
          .eq('id', document.data.shipping_preparation_id)
          .maybeSingle();
        const permission = await clientActeur.rpc('snp_sec_can_prepare_shipping', {
          p_shipping_id: document.data.shipping_preparation_id,
        });
        if (parent.error || permission.error || !parent.data?.mining_company_id) {
          throw new Error('delete_not_allowed');
        }
        table = 'shipping_documents';
        bucket = BUCKET_DOCUMENT_EXPEDITION;
        parentField = 'shipping_preparation_id';
        pathField = 'document_url';
        parentId = document.data.shipping_preparation_id;
        tenantId = parent.data.mining_company_id;
        reference = document.data.document_url;
        fileName = document.data.file_name;
        fileSize = document.data.file_size;
        mimeType = document.data.mime_type;
        uploadedBy = document.data.uploaded_by;
        parentExists = parent.data.id === parentId;
        parentPermission = permission.data === true;
        hasWriteCapability = permission.data === true;
        mayDeleteAnyUploader = true;
        politique = POLITIQUE_DOCUMENT_EXPEDITION;
      } else if (profileId === PROFILE_CERTIFICAT_ANALYSE) {
        const document = await admin.from('assay_certificates')
          .select('id, shipping_preparation_id, file_path, file_name, file_size, mime_type, uploaded_by, approval_status')
          .eq('id', resourceId)
          .maybeSingle();
        if (document.error || !document.data?.shipping_preparation_id) {
          throw new Error('delete_not_allowed');
        }
        const parent = await admin.from('shipping_preparations')
          .select('id, mining_company_id')
          .eq('id', document.data.shipping_preparation_id)
          .maybeSingle();
        const permission = await clientActeur.rpc('snp_sec_can_prepare_shipping', {
          p_shipping_id: document.data.shipping_preparation_id,
        });
        if (parent.error || permission.error || !parent.data?.mining_company_id) {
          throw new Error('delete_not_allowed');
        }
        table = 'assay_certificates';
        bucket = BUCKET_CERTIFICAT_ANALYSE;
        parentField = 'shipping_preparation_id';
        pathField = 'file_path';
        parentId = document.data.shipping_preparation_id;
        tenantId = parent.data.mining_company_id;
        reference = document.data.file_path;
        fileName = document.data.file_name;
        fileSize = document.data.file_size;
        mimeType = document.data.mime_type;
        uploadedBy = document.data.uploaded_by;
        parentExists = parent.data.id === parentId;
        parentPermission = permission.data === true;
        hasWriteCapability = permission.data === true;
        mayDeleteAnyUploader = true;
        mutable = document.data.approval_status === 'pending';
        politique = POLITIQUE_CERTIFICAT_ANALYSE;
      } else if (profileId === PROFILE_DOCUMENT_PRODUCTION) {
        const document = await admin.from('production_documents')
          .select('id, production_id, file_path, file_name, file_size, file_type, uploaded_by')
          .eq('id', resourceId)
          .maybeSingle();
        if (document.error || !document.data) throw new Error('delete_not_allowed');
        const parent = await admin.from('daily_production')
          .select('id, mining_company_id')
          .eq('id', document.data.production_id)
          .maybeSingle();
        const [permission, capaciteMine] = await Promise.all([
          clientActeur.rpc('snp_peut_consulter_production', { p_production_id: document.data.production_id }),
          clientActeur.rpc('snp_actor_has_capability', { p_capability_code: 'mine.operate' }),
        ]);
        if (
          parent.error || permission.error || capaciteMine.error
          || !parent.data?.mining_company_id
        ) throw new Error('delete_not_allowed');
        table = 'production_documents';
        bucket = BUCKET_DOCUMENT_PRODUCTION;
        parentField = 'production_id';
        pathField = 'file_path';
        parentId = document.data.production_id;
        tenantId = parent.data.mining_company_id;
        reference = document.data.file_path;
        fileName = document.data.file_name;
        fileSize = document.data.file_size;
        mimeType = document.data.file_type;
        uploadedBy = document.data.uploaded_by;
        parentExists = parent.data.id === parentId;
        parentPermission = permission.data === true;
        hasWriteCapability = capaciteMine.data === true || preparationSonasp.data === true;
        // La policy metadata historique limite la suppression à l'auteur.
        mayDeleteAnyUploader = false;
        politique = POLITIQUE_DOCUMENT_PRODUCTION;
      } else if (profileId === PROFILE_DOCUMENT_SOCIETE) {
        const document = await admin.from('mining_company_documents')
          .select('id, mining_company_id, file_path, file_name, file_size, mime_type, uploaded_by')
          .eq('id', resourceId)
          .maybeSingle();
        if (document.error || !document.data) throw new Error('delete_not_allowed');
        const parent = await admin.from('mining_companies')
          .select('id, is_active')
          .eq('id', document.data.mining_company_id)
          .maybeSingle();
        const permission = await clientActeur.rpc('snp_sec_can_prepare_company', {
          p_mining_company_id: document.data.mining_company_id,
        });
        const registryPermission = await clientActeur.rpc('snp_peut_gerer_sites_artisanaux');
        if (parent.error || permission.error || registryPermission.error || !parent.data) throw new Error('delete_not_allowed');
        table = 'mining_company_documents';
        bucket = BUCKET_DOCUMENT_SOCIETE;
        parentField = 'mining_company_id';
        pathField = 'file_path';
        parentId = document.data.mining_company_id;
        tenantId = document.data.mining_company_id;
        reference = document.data.file_path;
        fileName = document.data.file_name;
        fileSize = document.data.file_size;
        mimeType = document.data.mime_type;
        uploadedBy = document.data.uploaded_by;
        parentExists = parent.data.id === parentId;
        parentPermission = permission.data === true || registryPermission.data === true;
        hasWriteCapability = parentPermission;
        mayDeleteAnyUploader = true;
        mutable = parent.data.is_active === true;
        politique = POLITIQUE_DOCUMENT_SOCIETE_MINIERE;
      } else {
        throw new Error('delete_not_allowed');
      }

      if (!autoriserSuppressionDocumentSensible({
        actorId: utilisateur.id,
        parentId,
        tenantId,
        uploadedBy,
        activeSession: true,
        aal2: true,
        parentExists,
        parentPermission,
        hasWriteCapability,
        mayDeleteAnyUploader,
        mutable,
      })) throw new Error('delete_not_allowed');
      if (
        typeof reference !== 'string'
        || typeof fileName !== 'string'
        || typeof mimeType !== 'string'
        || !Number.isSafeInteger(fileSize)
        || (fileSize as number) <= 0
        || (fileSize as number) > politique.maxBytes
      ) throw new Error('delete_not_allowed');
      const chemin = cheminObjetLieAuParent(reference, bucket, parentId);
      if (!chemin) throw new Error('delete_not_allowed');
      const nomFichier = fileName;
      const tailleFichier = fileSize as number;
      const typeMime = mimeType;

      const sauvegarde = await admin.storage.from(bucket).download(chemin);
      if (sauvegarde.error || !sauvegarde.data) throw new Error('storage_backup_failed');
      const octets = new Uint8Array(await sauvegarde.data.arrayBuffer());
      if (octets.byteLength !== tailleFichier) throw new Error('storage_backup_failed');
      validerUploadServeur({
        fileName: nomFichier,
        declaredMimeType: typeMime,
        bytes: octets,
      }, politique);

      const auditAutorisation = await admin.from('security_events').insert({
        user_id: utilisateur.id,
        event_type: 'sensitive_upload_delete_authorized',
        details: {
          profile: profileId,
          tenant_id: tenantId,
          parent_id: parentId,
          resource_id: resourceId,
        },
      });
      if (auditAutorisation.error) throw new Error('delete_audit_unavailable');

      await supprimerObjetAvecCompensation({
        expectedPath: chemin,
        async removeObject() {
          const resultat = await admin.storage.from(bucket).remove([chemin]);
          if (resultat.error) throw new Error('storage_delete_failed');
        },
        async deleteMetadata() {
          const resultat = await clientActeur.from(table)
            .delete()
            .eq('id', resourceId)
            .eq(parentField, parentId)
            .eq(pathField, reference)
            .select(pathField)
            .maybeSingle();
          if (resultat.error || !resultat.data) throw new Error('metadata_delete_failed');
          const deletedReference = (resultat.data as unknown as Record<string, unknown>)[pathField];
          const deletedPath = cheminObjetLieAuParent(deletedReference, bucket, parentId);
          if (!deletedPath) throw new Error('metadata_delete_failed');
          return deletedPath;
        },
        async restoreObject() {
          const resultat = await admin.storage.from(bucket).upload(chemin, octets, {
            contentType: typeMime,
            cacheControl: '0',
            upsert: false,
          });
          if (resultat.error) throw new Error('storage_restore_failed');
        },
        onRestoreFailure() {
          console.error(`[sensitive-upload] Restauration compensatoire ${profileId} échouée.`);
        },
      });
      try {
        const audit = await admin.from('security_events').insert({
          user_id: utilisateur.id,
          event_type: 'sensitive_upload_deleted',
          details: {
            profile: profileId,
            tenant_id: tenantId,
            parent_id: parentId,
            resource_id: resourceId,
          },
        });
        if (audit.error) console.error('[sensitive-upload] Audit secondaire de suppression indisponible.');
      } catch {
        console.error('[sensitive-upload] Audit secondaire de suppression indisponible.');
      }
    },
  };

  Deno.serve(createSensitiveUploadHandler(dependances));
}
