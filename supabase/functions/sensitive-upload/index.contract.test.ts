import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/functions/sensitive-upload/index.ts'),
  'utf8',
);

describe('contrat d’intégration sensitive-upload', () => {
  it('lie le profil assay à une session active et à l’autorisation Shipping serveur', () => {
    expect(source).toContain("const PROFILE_CERTIFICAT_ANALYSE = 'assay-certificate'");
    expect(source).toContain("clientActeur.rpc('snp_session_signaler_activite')");
    expect(source).toContain("clientActeur.rpc('snp_sec_can_prepare_shipping'");
    expect(source).toContain('activeSession:');
    expect(source).toContain('canPrepareShipping:');
  });

  it('persiste dans le bucket privé avec acteur serveur et états pending', () => {
    expect(source).toContain("const BUCKET_CERTIFICAT_ANALYSE = 'ASSAY-CERTIFICATES'");
    expect(source).toContain('uploaded_by: input.actorId');
    expect(source).toContain("parsing_status: 'pending'");
    expect(source).toContain("approval_status: 'pending'");
    expect(source).toContain("remove([chemin])");
    expect(source).not.toContain('getPublicUrl');
  });

  it('lie Shipping et Production à leur parent, tenant, AAL2 et capability', () => {
    expect(source).toContain("const PROFILE_DOCUMENT_EXPEDITION = 'shipping-document'");
    expect(source).toContain("const PROFILE_DOCUMENT_PRODUCTION = 'production-document'");
    expect(source).toContain("clientActeur.rpc('snp_sec_can_prepare_shipping'");
    expect(source).toContain("clientActeur.rpc('snp_peut_consulter_production'");
    expect(source).toContain("p_capability_code: 'mine.operate'");
    expect(source).toContain("p_capability_code: 'sonasp.prepare'");
    expect(source).toContain("niveauAssurance(token) === 'aal2'");
    expect(source).toContain("bucket: BUCKET_DOCUMENT_EXPEDITION");
    expect(source).toContain("bucket: BUCKET_DOCUMENT_PRODUCTION");
  });

  it('lie le binaire fret au contrat RPC acteur 4F avec nettoyage compensatoire', () => {
    expect(source).toContain("const PROFILE_DOCUMENT_FRET = 'freight-customs-document'");
    expect(source).toContain("p_capability_code: 'freight.prepare'");
    expect(source).toContain("clientActeur.rpc('snp_fret_peut_consulter_tenant'");
    expect(source).toContain("clientActeur.rpc('snp_fret_ajouter_document'");
    expect(source).toContain("p_file_path: chemin");
    expect(source).toContain("bucket: BUCKET_DOCUMENT_FRET");
    expect(source).toContain("remove([chemin])");
    expect(source).not.toContain("from('freight_customs_documents').insert");
  });

  it('lie la preuve paiement au parent 4H sans URL libre et avec rejeu binaire vérifié', () => {
    expect(source).toContain("const PROFILE_PREUVE_PAIEMENT = 'international-payment-proof'");
    expect(source).toContain("const BUCKET_PREUVE_PAIEMENT = 'payment-proofs'");
    expect(source).toContain("p_capability_code: 'sonasp.finance.execute'");
    expect(source).toContain("clientActeur.rpc('snp_peut_consulter_vente'");
    expect(source).toContain("clientActeur.rpc('snp_paiement_preuve_rattacher'");
    expect(source).toContain('paymentMatchesSaleAndTenant:');
    expect(source).toContain('actorExecutedPayment:');
    expect(source).toContain('sellerIsActiveSonasp:');
    expect(source).toContain("crypto.subtle.digest('SHA-256'");
    expect(source).toContain('download(chemin)');
    expect(source).toContain('metadata: metadonneesObjet');
    expect(source).toContain('safe_file_name: input.file.safeFileName');
    expect(source).toContain('uploaded_by: input.actorId');
    expect(source).toContain("admin.from('snp_payment_proofs')");
    expect(source).toContain('resultatPersistanceCertain = false');
    expect(source).toContain('objetCree && resultatPersistanceCertain');
    expect(source).not.toContain('getPublicUrl');
  });

  it('compense la suppression fret si la RPC metadata échoue', () => {
    expect(source).toContain("clientActeur.rpc('snp_fret_supprimer_document'");
    expect(source).toContain("download(chemin)");
    expect(source).toContain("upload(chemin, octets");
    expect(source).toContain("event_type: 'sensitive_upload_deleted'");
  });

  it('route les quatre suppressions privées par la même frontière serveur', () => {
    expect(source).toContain('PROFILS_SUPPRESSION_DOCUMENTAIRE');
    expect(source).toContain("table = 'production_documents'");
    expect(source).toContain("table = 'shipping_documents'");
    expect(source).toContain("table = 'mining_company_documents'");
    expect(source).toContain("table = 'assay_certificates'");
    expect(source).toContain('autoriserSuppressionDocumentSensible({');
    expect(source).toContain('cheminObjetLieAuParent(reference, bucket, parentId)');
    expect(source).toContain("clientActeur.rpc('snp_sec_can_prepare_company'");
    expect(source).toContain("clientActeur.rpc('snp_sec_can_prepare_shipping'");
    expect(source).toContain("clientActeur.rpc('snp_peut_consulter_production'");
  });

  it('sauvegarde, valide, supprime puis restaure si le DML metadata échoue', () => {
    expect(source).toContain('admin.storage.from(bucket).download(chemin)');
    expect(source).toContain('validerUploadServeur({');
    expect(source).toContain('admin.storage.from(bucket).remove([chemin])');
    expect(source).toContain('clientActeur.from(table)');
    expect(source).toContain("event_type: 'sensitive_upload_delete_authorized'");
    expect(source).toContain('.eq(pathField, reference)');
    expect(source).toContain('admin.storage.from(bucket).upload(chemin, octets');
    expect(source).toContain('parent_id: parentId');
  });
});
