import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Requisition } from '@/services/requisitionsService';
import { RequisitionDetails } from './RequisitionDetails';

const mocks = vi.hoisted(() => ({
  requisition: vi.fn(),
  execution: vi.fn(),
  notifications: vi.fn(),
  enlevements: vi.fn(),
  historique: vi.fn(),
  transitions: vi.fn(),
  repondreMine: vi.fn(),
  contrats: vi.fn(),
}));

vi.mock('@/hooks/useMineWorkspace', () => ({
  useMineWorkspace: () => ({ isMine: true, companyId: 'mine-1' }),
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/contrats/AnalysesTeneur', () => ({
  AnalysesTeneur: () => <div>Analyses internes</div>,
}));

vi.mock('@/components/contrats/PiecesContractuelles', () => ({
  PiecesContractuelles: () => <div>Pièces consultables</div>,
}));

vi.mock('@/services/requisitionsService', async () => {
  const actual = await vi.importActual<typeof import('@/services/requisitionsService')>(
    '@/services/requisitionsService',
  );
  return {
    ...actual,
    requisitionsService: {
      ...actual.requisitionsService,
      requisition: mocks.requisition,
      execution: mocks.execution,
      notifications: mocks.notifications,
      enlevements: mocks.enlevements,
      historique: mocks.historique,
      transitions: mocks.transitions,
      repondreMine: mocks.repondreMine,
    },
  };
});

vi.mock('@/services/contratsService', async () => {
  const actual = await vi.importActual<typeof import('@/services/contratsService')>(
    '@/services/contratsService',
  );
  return {
    ...actual,
    contratsService: { ...actual.contratsService, lister: mocks.contrats },
  };
});

const requisition = {
  id: 'req-1',
  reference: 'REQ-2026-001',
  objet: 'Mise à disposition de production',
  partenaire_type: 'societe_miniere',
  mining_company_id: 'mine-1',
  site_id: null,
  contrat_id: null,
  type_requisition: 'partielle',
  regime_juridique: 'accord_requis',
  autorite_origine: 'SONASP',
  nature_acte: 'Décision',
  reference_acte: 'DEC-001',
  date_signature_acte: '2026-08-20',
  date_effet: '2026-08-21',
  periode_debut: null,
  periode_fin: null,
  quantite_oz: 100,
  unite: 'oz',
  pourcentage_production: null,
  produits_concernes: 'Or doré',
  teneur_estimee_pct: 92,
  lieu_stockage: null,
  lieu_enlevement: null,
  delai_mise_a_disposition_jours: null,
  modalites_enlevement: null,
  conditions_transport: null,
  conditions_analyse: null,
  methode_prix: 'cours_du_jour',
  prix_once_fcfa: null,
  modalites_paiement: 'Virement',
  responsable_id: null,
  equipe: null,
  confidentialite: 'interne',
  observations: null,
  accuse_reception_le: null,
  accuse_reception_par: null,
  observations_mine: null,
  observations_recues_le: null,
  contestation_motif: null,
  contestation_recue_le: null,
  accord_mine: null,
  accord_recu_le: null,
  imputation_contractuelle: null,
  imputation_motif: null,
  imputation_decidee_le: null,
  statut: 'notifiee',
  motif_statut: null,
  date_autorisation: '2026-08-20T09:00:00Z',
  date_notification: '2026-08-21T09:00:00Z',
  date_executoire: null,
  date_cloture: null,
  created_by: 'sonasp-user',
  created_at: '2026-08-20T09:00:00Z',
  updated_at: '2026-08-21T09:00:00Z',
  mining_company: { id: 'mine-1', name: 'Mine Exemple', code: 'MEX' },
  contrat: null,
} satisfies Requisition;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/requisitions/req-1']}>
      <Routes>
        <Route path="/requisitions/:id" element={<RequisitionDetails />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequisitionDetails — réception Société minière', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requisition.mockResolvedValue(requisition);
    mocks.execution.mockResolvedValue(null);
    mocks.notifications.mockResolvedValue([]);
    mocks.enlevements.mockResolvedValue([]);
    mocks.historique.mockResolvedValue([]);
    mocks.transitions.mockResolvedValue(['executoire']);
    mocks.contrats.mockResolvedValue([]);
    mocks.repondreMine.mockResolvedValue({ ...requisition, statut: 'accusee' });
  });

  it('charge exclusivement le tenant et approuve avec un commentaire obligatoire', async () => {
    const user = userEvent.setup();
    renderPage();

    const approver = await screen.findByRole('button', { name: 'Approuver et transmettre' });
    expect(approver).toBeDisabled();
    expect(mocks.requisition).toHaveBeenCalledWith('req-1', 'mine-1');
    expect(mocks.transitions).not.toHaveBeenCalled();
    expect(mocks.contrats).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Modifier/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Consigner une notification/ })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Commentaire'), 'Accord de la direction');
    expect(approver).toBeEnabled();
    await user.click(approver);

    await waitFor(() => expect(mocks.repondreMine).toHaveBeenCalledWith(
      'req-1',
      'approuver',
      'Accord de la direction',
    ));
    expect(await screen.findByText('Votre approbation a été transmise à la SONASP.')).toBeInTheDocument();
  });

  it('transmet un rejet motivé par la même RPC contrôlée', async () => {
    const user = userEvent.setup();
    renderPage();

    const rejeter = await screen.findByRole('button', { name: 'Rejeter / contester' });
    expect(rejeter).toBeDisabled();
    await user.type(screen.getByLabelText('Commentaire'), 'Quantité indisponible');
    await user.click(rejeter);

    await waitFor(() => expect(mocks.repondreMine).toHaveBeenCalledWith(
      'req-1',
      'contester',
      'Quantité indisponible',
    ));
    expect(await screen.findByText('Votre contestation a été transmise à la SONASP.')).toBeInTheDocument();
  });

  it('affiche le refus serveur sans annoncer une transition réussie', async () => {
    const user = userEvent.setup();
    mocks.repondreMine.mockRejectedValueOnce(
      new Error('Une réponse a déjà été enregistrée pour cette réquisition.'),
    );
    renderPage();

    await user.type(await screen.findByLabelText('Commentaire'), 'Accord après contrôle');
    await user.click(screen.getByRole('button', { name: 'Approuver et transmettre' }));

    expect(await screen.findByText(
      'Une réponse a déjà été enregistrée pour cette réquisition.',
    )).toBeInTheDocument();
    expect(screen.queryByText('Votre approbation a été transmise à la SONASP.')).not.toBeInTheDocument();
  });
});
