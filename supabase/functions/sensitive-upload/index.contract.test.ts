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
});
