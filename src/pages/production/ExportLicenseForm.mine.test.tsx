import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportLicenseForm } from './ExportLicenseForm';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  submitMineLicenseRequest: vi.fn(),
  workspace: {
    isMine: true,
    companyName: 'Mine Exemple SA',
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => ({}),
}));

vi.mock('@/hooks/useMineWorkspace', () => ({
  useMineWorkspace: () => mocks.workspace,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('@/components/layout/MainLayout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/services/exportLicenseService', () => ({
  exportLicenseService: {
    submitMineLicenseRequest: mocks.submitMineLicenseRequest,
  },
}));

describe('ExportLicenseForm — demande Société minière', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workspace.isMine = true;
    mocks.workspace.companyName = 'Mine Exemple SA';
    mocks.submitMineLicenseRequest.mockResolvedValue({ id: 'request-1', status: 'soumis' });
  });

  it('ne présente aucun champ de délivrance ou de quota accordé à la mine', () => {
    render(<ExportLicenseForm />);

    expect(screen.getByRole('heading', { name: 'Demander une licence d’exportation' })).toBeInTheDocument();
    expect(screen.getByText(/seule l’autorité compétente délivre la licence/i)).toBeInTheDocument();
    expect(screen.queryByText('Numéro de Licence *')).not.toBeInTheDocument();
    expect(screen.queryByText('Quantité Autorisée (grammes) *')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Générer' })).not.toBeInTheDocument();
  });

  it('soumet les seuls champs de demande puis confirme l’attente d’instruction', async () => {
    const user = userEvent.setup();
    render(<ExportLicenseForm />);

    await user.type(screen.getByLabelText('Quantité demandée (grammes) *'), '125000');
    await user.type(screen.getByLabelText('Date d’export souhaitée *'), '2026-09-30');
    await user.type(screen.getByLabelText('Destination prévue *'), 'Suisse');
    await user.type(screen.getByLabelText('Motif de la demande *'), 'Export trimestriel planifié');
    await user.type(screen.getByLabelText('Commentaire complémentaire'), 'Dossier prioritaire');
    await user.click(screen.getByRole('button', { name: 'Transmettre la demande' }));

    await waitFor(() => expect(mocks.submitMineLicenseRequest).toHaveBeenCalledWith({
      requestedQuantityGrams: 125000,
      desiredExportDate: '2026-09-30',
      destination: 'Suisse',
      reason: 'Export trimestriel planifié',
      comment: 'Dossier prioritaire',
    }));
    expect(await screen.findByText('Demande transmise à la SONASP')).toBeInTheDocument();
    expect(screen.getByText(/Aucun numéro, statut ni quota de licence n’a été créé/)).toBeInTheDocument();
  });

  it('affiche le refus RPC et ne simule aucun succès local', async () => {
    const user = userEvent.setup();
    mocks.submitMineLicenseRequest.mockRejectedValueOnce(
      new Error('Le service sécurisé de demande de licence n’est pas disponible.'),
    );
    render(<ExportLicenseForm />);

    await user.type(screen.getByLabelText('Quantité demandée (grammes) *'), '125000');
    await user.type(screen.getByLabelText('Date d’export souhaitée *'), '2026-09-30');
    await user.type(screen.getByLabelText('Destination prévue *'), 'Suisse');
    await user.type(screen.getByLabelText('Motif de la demande *'), 'Export trimestriel planifié');
    await user.click(screen.getByRole('button', { name: 'Transmettre la demande' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service sécurisé de demande de licence n’est pas disponible.',
    );
    expect(screen.queryByText('Demande transmise à la SONASP')).not.toBeInTheDocument();
  });
});
