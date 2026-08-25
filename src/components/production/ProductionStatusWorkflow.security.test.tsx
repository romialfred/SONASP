import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductionStatusWorkflow } from './ProductionStatusWorkflow';

const mocks = vi.hoisted(() => ({
  user: null as any,
  updateStatus: vi.fn(),
  requestId: vi.fn(() => '10000000-0000-4000-8000-000000000001'),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/hooks/useStatusTransitionControl', () => ({
  WorkflowModule: { PRODUCTION: 'production' },
  useStatusTransitionControl: () => ({
    canChangeStatus: true,
    checkTransition: () => true,
    responsibilityMessage: '',
  }),
}));

vi.mock('@/services/productionStatusService', () => ({
  productionStatusService: { updateStatus: mocks.updateStatus },
  createProductionTransitionRequestId: mocks.requestId,
}));

vi.mock('@/components/common/UnifiedStatusFlow', () => ({
  UnifiedStatusFlow: () => null,
}));

vi.mock('./ProductionStatusConfirmationModal', () => ({
  ProductionStatusConfirmationModal: ({ isOpen, onConfirm }: any) => isOpen ? (
    <button onClick={() => void onConfirm('Contrôle conforme').catch(() => undefined)}>
      confirmer-transition
    </button>
  ) : null,
}));

const production = {
  id: 'production-1',
  bar_reference: 'BAR-1',
  production_date: '2026-08-24',
  bullion_grams: 100,
  estimated_fineness_pct: 90,
  pure_gold_grams: 90,
  estimated_oz: 2.89,
};

describe('ProductionStatusWorkflow — sécurité de transition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());
  });

  it('échoue fermé sans capability sensible effective', () => {
    mocks.user = {
      is_active: true,
      role: 'manager',
      capabilities: ['reports.read'],
    };

    render(
      <ProductionStatusWorkflow
        productionId="production-1"
        currentStatus="prepared"
        production={production}
        onStatusChanged={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Passer à:/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Changement de statut verrouillé/i)).toBeInTheDocument();
  });

  it('réutilise la même clé idempotente après une erreur réseau', async () => {
    mocks.user = {
      is_active: true,
      role: 'mine',
      capabilities: ['mine.operate'],
    };
    mocks.updateStatus
      .mockRejectedValueOnce(new Error('réseau interrompu'))
      .mockResolvedValueOnce({ status: 'ready_for_customs' });

    render(
      <ProductionStatusWorkflow
        productionId="production-1"
        currentStatus="prepared"
        production={production}
        onStatusChanged={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText(/Passer à:/i));
    fireEvent.click(screen.getByText('confirmer-transition'));
    await waitFor(() => expect(mocks.updateStatus).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('confirmer-transition'));
    await waitFor(() => expect(mocks.updateStatus).toHaveBeenCalledTimes(2));

    expect(mocks.updateStatus.mock.calls[0][3].requestId)
      .toBe('10000000-0000-4000-8000-000000000001');
    expect(mocks.updateStatus.mock.calls[1][3].requestId)
      .toBe('10000000-0000-4000-8000-000000000001');
    expect(mocks.requestId).toHaveBeenCalledTimes(1);
  });
});
