import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApprobateursPage from './ApprobateursPage';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  setApprover: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  user: {
    id: 'admin-current',
    role: 'admin',
    is_active: true,
    // La gestion des approbateurs est gouvernée par la capacité (comme la route et
    // la RPC), pas par le rôle seul : un compte habilité porte accounts.manage.
    capabilities: ['accounts.manage'],
  },
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));

vi.mock('@/hooks/useCustomAlert', () => ({
  useCustomAlert: () => ({
    alertState: { isOpen: false, message: '', type: 'success' },
    showSuccess: mocks.showSuccess,
    showError: mocks.showError,
    closeAlert: vi.fn(),
  }),
}));

vi.mock('@/components/ui/CustomAlert', () => ({ CustomAlert: () => null }));

vi.mock('@/services/salesApproverService', () => ({
  salesApproverService: {
    list: mocks.list,
    setApprover: mocks.setApprover,
  },
}));

const users = [
  {
    id: 'admin-current',
    email: 'admin@sonasp.bf',
    full_name: 'Administrateur courant',
    role: 'admin',
    is_active: true,
    is_sales_approver: false,
  },
  {
    id: 'factory-1',
    email: 'usine@sonasp.bf',
    full_name: 'Awa Usine',
    role: 'factory',
    is_active: true,
    is_sales_approver: false,
  },
  {
    id: 'owner-1',
    email: 'owner@sonasp.bf',
    full_name: 'Propriétaire',
    role: 'owner',
    is_active: true,
    is_sales_approver: false,
  },
] as const;

describe('ApprobateursPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue(users);
    mocks.setApprover.mockResolvedValue(undefined);
  });

  it('affiche la page dans la gouttière standard et propose une désignation', async () => {
    const { container } = render(<ApprobateursPage />);
    await waitFor(() => expect(screen.getByText('Awa Usine')).toBeInTheDocument());

    expect(container.querySelector('main.sn-page.approvers-page')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Désigner' }));

    const select = screen.getByLabelText('Utilisateur');
    expect(within(select).getByRole('option', { name: /Awa Usine/ })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: /Administrateur courant/ })).not.toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: /Propriétaire/ })).not.toBeInTheDocument();
  });

  it('désigne un compte autorisé via le service sécurisé', async () => {
    render(<ApprobateursPage />);
    await waitFor(() => expect(screen.getByText('Awa Usine')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Désigner' }));
    fireEvent.change(screen.getByLabelText('Utilisateur'), { target: { value: 'factory-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la désignation' }));

    await waitFor(() => expect(mocks.setApprover).toHaveBeenCalledWith('factory-1', true));
    expect(mocks.showSuccess).toHaveBeenCalledWith('Droit d’approbation accordé.');
  });

  it('interdit à un administrateur de modifier sa propre habilitation', async () => {
    render(<ApprobateursPage />);
    await waitFor(() => expect(screen.getByText('Administrateur courant')).toBeInTheDocument());

    const row = screen.getByText('Administrateur courant').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLTableRowElement).getByRole('button', { name: 'Accorder' })).toBeDisabled();
  });
});
