import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MineExportLicenseRequest } from '@/services/exportLicenseService';

const mocks = vi.hoisted(() => ({
  user: {
    id: 'sonasp-approver',
    role: 'management',
    is_active: true,
    capabilities: ['sonasp.approve'] as string[] | undefined,
  },
  getSonaspLicenseRequests: vi.fn(),
  decideMineLicenseRequest: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/services/exportLicenseService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/exportLicenseService')>();
  return {
    ...actual,
    exportLicenseService: {
      getSonaspLicenseRequests: mocks.getSonaspLicenseRequests,
      decideMineLicenseRequest: mocks.decideMineLicenseRequest,
    },
  };
});

import ExportLicenseRequestsInboxPage from './ExportLicenseRequestsInboxPage';

const submitted: MineExportLicenseRequest = {
  id: 'request-12345678',
  mining_company_id: 'mine-1',
  requested_quantity_grams: 120_000,
  desired_export_date: '2026-10-10',
  destination: 'Suisse',
  reason: 'Exporter la production certifiée du trimestre',
  comment: 'Certificats joints au dossier',
  status: 'submitted',
  submitted_by: 'mine-user',
  submitted_at: '2026-08-24T10:00:00Z',
  created_at: '2026-08-24T10:00:00Z',
  updated_at: '2026-08-24T10:00:00Z',
  reviewed_by: null,
  reviewed_at: null,
  decision_reason: null,
  license_id: null,
  mining_company: { id: 'mine-1', name: 'Mine Exemple', code: 'MEX' },
};

describe('ExportLicenseRequestsInboxPage', () => {
  beforeEach(() => {
    mocks.user.role = 'management';
    mocks.user.capabilities = ['sonasp.approve'];
    mocks.getSonaspLicenseRequests.mockReset().mockResolvedValue([submitted]);
    mocks.decideMineLicenseRequest.mockReset().mockImplementation(async (input) => ({
      ...submitted,
      status: input.decision,
      decision_reason: input.decisionReason,
      reviewed_by: 'sonasp-approver',
      reviewed_at: '2026-08-24T12:00:00Z',
      license_id: input.decision === 'approved' ? 'license-1' : null,
    }));
  });

  it('liste les demandes et ouvre le dossier complet', async () => {
    const user = userEvent.setup();
    render(<ExportLicenseRequestsInboxPage />);

    expect(await screen.findByText('Mine Exemple')).toBeInTheDocument();
    expect(screen.getAllByText(/120\s000 g/)).not.toHaveLength(0);
    await user.click(screen.getByRole('button', { name: /Voir le dossier/i }));

    expect(screen.getByText('Exporter la production certifiée du trimestre')).toBeInTheDocument();
    expect(screen.getByText('Certificats joints au dossier')).toBeInTheDocument();
  });

  it('accorde via le seul contrat de service sans acteur, audit ni tenant client', async () => {
    const user = userEvent.setup();
    render(<ExportLicenseRequestsInboxPage />);

    await user.click(await screen.findByRole('button', { name: /^Accorder$/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Numéro de licence/i), 'EXP-2026-001');
    await user.clear(within(dialog).getByLabelText(/Institution émettrice/i));
    await user.type(within(dialog).getByLabelText(/Institution émettrice/i), 'SONASP');
    await user.type(within(dialog).getByLabelText(/Date de début/i), '2026-08-25');
    await user.type(within(dialog).getByLabelText(/Date de fin/i), '2027-08-24');
    await user.type(within(dialog).getByLabelText(/Motif de décision/i), 'Dossier réglementaire conforme');
    await user.type(within(dialog).getByLabelText(/Commentaire interne/i), 'Double contrôle réalisé');
    await user.click(within(dialog).getByRole('button', { name: /Confirmer la décision/i }));

    await waitFor(() => expect(mocks.decideMineLicenseRequest).toHaveBeenCalledWith({
      requestId: 'request-12345678',
      decision: 'approved',
      licenseNumber: 'EXP-2026-001',
      startDate: '2026-08-25',
      endDate: '2027-08-24',
      issuingInstitution: 'SONASP',
      authorizedQuantityGrams: 120_000,
      decisionReason: 'Dossier réglementaire conforme',
      comments: 'Double contrôle réalisé',
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('licence créée de façon atomique');
  });

  it('bloque un motif trop court et un volume supérieur à la demande avant le service', async () => {
    const user = userEvent.setup();
    render(<ExportLicenseRequestsInboxPage />);

    await user.click(await screen.findByRole('button', { name: /^Accorder$/i }));
    const dialog = screen.getByRole('dialog');
    const quantity = within(dialog).getByLabelText(/Quantité autorisée/i);
    await user.clear(quantity);
    await user.type(quantity, '120001');
    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('au moins 10 caractères');
    await user.type(within(dialog).getByLabelText(/Motif de décision/i), 'Justification suffisamment complète');
    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('dépasser la quantité demandée');
    expect(mocks.decideMineLicenseRequest).not.toHaveBeenCalled();
  });

  it('affiche le refus de concurrence RPC, conserve le formulaire et recharge la file', async () => {
    const user = userEvent.setup();
    mocks.getSonaspLicenseRequests
      .mockResolvedValueOnce([submitted])
      .mockResolvedValueOnce([{
        ...submitted,
        status: 'approved',
        reviewed_by: 'other-approver',
        reviewed_at: '2026-08-24T11:00:00Z',
        license_id: 'license-other',
      }]);
    mocks.decideMineLicenseRequest.mockRejectedValueOnce({
      code: '23514',
      message: 'Une demande approved ne peut plus être décidée.',
    });
    render(<ExportLicenseRequestsInboxPage />);

    await user.click(await screen.findByRole('button', { name: /^Rejeter$/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Motif de décision/i), 'Pièces réglementaires incomplètes');
    await user.click(within(dialog).getByRole('button', { name: /Confirmer la décision/i }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('ne peut plus être décidée');
    expect(dialog).toBeInTheDocument();
    await waitFor(() => expect(mocks.getSonaspLicenseRequests).toHaveBeenCalledTimes(2));
    expect(within(dialog).getByRole('button', { name: /Confirmer la décision/i })).toBeDisabled();
  });

  it('échoue fermé sans capability AAL2 explicite et ne charge aucun dossier', async () => {
    mocks.user.capabilities = undefined;
    render(<ExportLicenseRequestsInboxPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('AAL2');
    expect(mocks.getSonaspLicenseRequests).not.toHaveBeenCalled();
    expect(mocks.decideMineLicenseRequest).not.toHaveBeenCalled();
  });

  it('rend une erreur de lecture visible sans inventer une boîte vide', async () => {
    mocks.getSonaspLicenseRequests.mockRejectedValueOnce({ message: 'Lecture RLS refusée' });
    render(<ExportLicenseRequestsInboxPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Lecture RLS refusée');
    expect(screen.getByText('Aucune demande dans cette vue')).toBeInTheDocument();
  });
});
