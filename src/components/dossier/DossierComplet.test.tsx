import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  charger: vi.fn(),
  urlPourDocument: vi.fn(),
  estOuvrable: vi.fn(),
}));

vi.mock('@/services/dossierService', async (importActual) => {
  const reel = await importActual<typeof import('@/services/dossierService')>();
  return {
    ...reel,
    dossierService: {
      charger: mocks.charger,
      urlPourDocument: mocks.urlPourDocument,
      estOuvrable: mocks.estOuvrable,
    },
  };
});

import { DossierComplet } from './DossierComplet';

const DOSSIER = {
  ancre: { type: 'vente' as const, id: 'v1' },
  chaine: {
    productions: [{ id: 'p1', reference: 'BAR-001', statut: 'shipped', date: '2026-08-01' }],
    expeditions: [{ id: 'sp1', reference: 'LOT-2026-01', statut: 'shipped', raffinerie: 'Rand' }],
    conciliation: { id: 'c1', reference: 'REC-2026-0001', statut: 'validee' },
    vente: { id: 'v1', reference: 'SL-2026-011', statut: 'completed', client: 'Client Or' },
    paiements: [{ id: 'pay1', reference: 'PAY-1', statut: 'executed' }],
  },
  documents: [
    {
      etape: 'expedition' as const, source: 'shipping_documents', id: 'doc1',
      nom: 'Packing list', chemin: 'sp1/packing.pdf', taille: 20480, date: '2026-08-02T10:00:00Z',
    },
    {
      etape: 'vente_locale' as const, source: 'snp_factures_achat', id: 'fac1',
      nom: 'Facture FA-2026-0001', chemin: null, date: '2026-08-03T10:00:00Z',
    },
  ],
  chronologie: [
    { etape: 'production' as const, date: '2026-08-01T08:00:00Z', titre: 'Production enregistrée', detail: 'BAR-001' },
    { etape: 'vente' as const, date: '2026-08-05T09:00:00Z', titre: 'Vente créée', detail: 'SL-2026-011', acteur: 'A. Testeur' },
  ],
  comptes: {
    montant_vente: 1000,
    devise: 'USD',
    avances_recues: 400,
    engagements_en_attente: 250,
    ecart_conciliation: -100,
    taxes: [{ code: 'tva', devise: 'XOF', trop_percu: 18, net: -18 }],
  },
};

describe('DossierComplet', () => {
  beforeEach(() => {
    mocks.charger.mockReset().mockResolvedValue(DOSSIER);
    mocks.urlPourDocument.mockReset().mockResolvedValue('https://signee.example/doc');
    mocks.estOuvrable.mockReset().mockImplementation(
      (document: { chemin: string | null }) => Boolean(document.chemin),
    );
  });

  it('affiche la chaîne et la chronologie groupée par étape', async () => {
    render(<DossierComplet type="vente" id="v1" />);

    await waitFor(() => {
      expect(screen.getByText('LOT-2026-01')).toBeInTheDocument();
    });
    expect(screen.getByText('REC-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Production enregistrée')).toBeInTheDocument();
    expect(screen.getByText('A. Testeur')).toBeInTheDocument();
    expect(mocks.charger).toHaveBeenCalledWith('vente', 'v1');
  });

  it('ouvre un document par URL signée et marque les références sans fichier', async () => {
    const ouvrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<DossierComplet type="vente" id="v1" />);
    await waitFor(() => expect(screen.getByText('LOT-2026-01')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('radio', { name: /Documents/ }));
    expect(await screen.findByText('Packing list')).toBeInTheDocument();
    // La facture sans fichier est une référence, pas un bouton d'ouverture.
    expect(screen.getByText('référence')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Ouvrir/ }));
    await waitFor(() => {
      expect(ouvrir).toHaveBeenCalledWith('https://signee.example/doc', '_blank', 'noopener,noreferrer');
    });
    ouvrir.mockRestore();
  });

  it('calcule le solde attendu : définitif après conciliation moins avances', async () => {
    render(<DossierComplet type="vente" id="v1" />);
    await waitFor(() => expect(screen.getByText('LOT-2026-01')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('radio', { name: /Comptes/ }));
    // (1000 - 100) - 400 = 500
    expect(await screen.findByText('500,00 USD')).toBeInTheDocument();
    expect(screen.getByText('TVA')).toBeInTheDocument();
    // La taxe garde sa propre devise, celle du grand livre fiscal.
    expect(screen.getByText(/trop-perçu 18,00 XOF/)).toBeInTheDocument();
    // Un engagement non exécuté n'est pas une avance reçue.
    expect(screen.getByText('Engagements en attente')).toBeInTheDocument();
    expect(screen.getByText('250,00 USD')).toBeInTheDocument();
  });

  it('dit l’échec de chargement au lieu de le taire', async () => {
    mocks.charger.mockRejectedValue(new Error('Dossier introuvable ou accès refusé.'));
    render(<DossierComplet type="vente" id="absent" />);
    expect(await screen.findByText(/accès refusé/)).toBeInTheDocument();
  });
});
