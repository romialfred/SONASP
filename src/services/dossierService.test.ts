import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  createPrivateSignedUrl: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/lib/privateStorage', () => ({
  PRIVATE_STORAGE_BUCKETS: {
    shippingDocuments: 'shipping-documents',
    assayCertificates: 'ASSAY-CERTIFICATES',
    miningCompanyDocuments: 'mining-company-documents',
    productionDocuments: 'production-documents',
    freightCustomsDocuments: 'freight-customs-documents',
    paymentProofs: 'payment-proofs',
  },
  createPrivateSignedUrl: mocks.createPrivateSignedUrl,
}));

import { dossierService, type DocumentDossier } from './dossierService';

const piece = (surcharge: Partial<DocumentDossier>): DocumentDossier => ({
  etape: 'expedition',
  source: 'shipping_documents',
  id: 'doc-1',
  nom: 'Pièce',
  chemin: 'chemin/piece.pdf',
  ...surcharge,
});

describe('dossierService', () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.createPrivateSignedUrl.mockReset().mockResolvedValue('https://signee.example/piece');
  });

  it('appelle la procédure avec le type et l’identifiant', async () => {
    mocks.rpc.mockResolvedValue({ data: { ancre: { type: 'vente', id: 'v1' } }, error: null });
    await dossierService.charger('vente', 'v1');
    expect(mocks.rpc).toHaveBeenCalledWith('snp_dossier_complet', { p_type: 'vente', p_id: 'v1' });
  });

  it('propage l’erreur de la procédure sans la masquer', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('Dossier introuvable ou accès refusé.') });
    await expect(dossierService.charger('vente', 'absent')).rejects.toThrow('accès refusé');
  });

  it('signe chaque source dans son bucket', async () => {
    const cas: Array<[string, string]> = [
      ['production_documents', 'production-documents'],
      ['snp_requisitions_documents', 'contrats-documents'],
      ['shipping_documents', 'shipping-documents'],
      ['shipping_preparations', 'shipping-documents'],
      ['assay_certificates', 'ASSAY-CERTIFICATES'],
      ['snp_payment_proofs', 'payment-proofs'],
    ];
    for (const [source, bucket] of cas) {
      mocks.createPrivateSignedUrl.mockClear();
      await dossierService.urlPourDocument(piece({ source }));
      expect(mocks.createPrivateSignedUrl).toHaveBeenCalledWith(bucket, 'chemin/piece.pdf', 300);
    }
  });

  it('refuse d’ouvrir une pièce de référence sans fichier', async () => {
    const facture = piece({ source: 'snp_factures_achat', chemin: null });
    expect(dossierService.estOuvrable(facture)).toBe(false);
    expect(await dossierService.urlPourDocument(facture)).toBeNull();
    expect(mocks.createPrivateSignedUrl).not.toHaveBeenCalled();
  });

  it('présente les PDF de fret en référence : leur bucket est fermé fail-closed', async () => {
    // Le lot 2K a retiré toute politique de lecture client sur le bucket
    // hérité du fret. Annoncer un bouton « Ouvrir » qui échoue à tous les
    // coups serait un mensonge d'interface.
    const fret = piece({ source: 'freight_shipments' });
    expect(dossierService.estOuvrable(fret)).toBe(false);
    expect(await dossierService.urlPourDocument(fret)).toBeNull();
    expect(mocks.createPrivateSignedUrl).not.toHaveBeenCalled();
  });

  it('refuse une source inconnue plutôt que de deviner un bucket', async () => {
    const inconnue = piece({ source: 'table_inconnue' });
    expect(dossierService.estOuvrable(inconnue)).toBe(false);
    expect(await dossierService.urlPourDocument(inconnue)).toBeNull();
    expect(mocks.createPrivateSignedUrl).not.toHaveBeenCalled();
  });

  it('n’ouvre un document de vente historique que sur URL absolue', async () => {
    const absolue = piece({ source: 'sales_documents', chemin: 'https://exemple.test/doc.pdf' });
    expect(dossierService.estOuvrable(absolue)).toBe(true);
    expect(await dossierService.urlPourDocument(absolue)).toBe('https://exemple.test/doc.pdf');

    const relative = piece({ source: 'sales_documents', chemin: 'dossier/doc.pdf' });
    expect(dossierService.estOuvrable(relative)).toBe(false);
    expect(await dossierService.urlPourDocument(relative)).toBeNull();
    // Aucune signature tentée : le bucket de cette source n'est pas connu.
    expect(mocks.createPrivateSignedUrl).not.toHaveBeenCalled();
  });
});
