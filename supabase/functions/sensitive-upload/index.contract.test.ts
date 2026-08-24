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
});
