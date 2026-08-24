import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangeStatusModal } from './ChangeStatusModal';
import type { FreightCustomsOperation } from '@/services/freightCustomsService';

const mocks = vi.hoisted(() => ({
  transitionStatus: vi.fn(),
  notify: vi.fn(),
  auth: {
    user: {
      id: '10000000-0000-4000-8000-000000000001',
      is_active: true,
      capabilities: ['freight.customs.approve'],
    },
  },
}));

vi.mock('@/services/freightCustomsService', () => ({
  freightCustomsService: { transitionStatus: mocks.transitionStatus },
  FreightCustomsConflictError: class FreightCustomsConflictError extends Error {},
}));
vi.mock('@/contexts/NotificationContext', () => ({
  useNotification: () => ({ showNotification: mocks.notify }),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));

const operation: FreightCustomsOperation = {
  id: '20000000-0000-4000-8000-000000000001',
  shipping_preparation_id: '30000000-0000-4000-8000-000000000001',
  reference_number: 'FC-20260824-00000001',
  status: 'customs_pending',
  created_by: '10000000-0000-4000-8000-000000000009',
  prepared_by: '10000000-0000-4000-8000-000000000009',
  created_at: '2026-08-24T00:00:00Z',
  updated_at: '2026-08-24T00:00:00Z',
};

describe('ChangeStatusModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user = {
      id: '10000000-0000-4000-8000-000000000001',
      is_active: true,
      capabilities: ['freight.customs.approve'],
    };
  });

  it('n’offre aucun choix arbitraire et appelle uniquement l’étape suivante attendue', async () => {
    mocks.transitionStatus.mockResolvedValue({ ...operation, status: 'customs_approved' });
    const onSuccess = vi.fn();
    render(<ChangeStatusModal operation={operation} onClose={vi.fn()} onSuccess={onSuccess} />);

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('Approuvé Douane')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Référence Douane'), { target: { value: 'DOU-42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer l’étape suivante' }));

    await waitFor(() => expect(mocks.transitionStatus).toHaveBeenCalledWith(
      operation.id,
      'customs_pending',
      'customs_approved',
      {
        customs_office: null,
        customs_officer_name: null,
        customs_reference_number: 'DOU-42',
        notes: null,
      },
    ));
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('bloque visuellement l’auto-approbation et ne contacte pas le service', () => {
    mocks.auth.user = {
      ...mocks.auth.user,
      id: operation.prepared_by as string,
    };
    render(<ChangeStatusModal operation={operation} onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('préparateur');
    expect(screen.getByRole('button', { name: 'Confirmer l’étape suivante' })).toBeDisabled();
    expect(mocks.transitionStatus).not.toHaveBeenCalled();
  });

  it('reste fail-closed lorsque la capacité AAL2 manque', () => {
    mocks.auth.user = { ...mocks.auth.user, capabilities: [] };
    render(<ChangeStatusModal operation={operation} onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('capacité requise');
    expect(screen.getByRole('button', { name: 'Confirmer l’étape suivante' })).toBeDisabled();
  });
});
