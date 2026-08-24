import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FreightCustomsCreate from './FreightCustomsCreate';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  notify: vi.fn(),
  getAvailableShipments: vi.fn(),
  createOperation: vi.fn(),
  updateOperation: vi.fn(),
  auth: {
    user: {
      id: '10000000-0000-4000-8000-000000000001',
      is_active: true,
      capabilities: [] as string[],
    },
  },
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/components/layout/MainLayout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/contexts/NotificationContext', () => ({
  useNotification: () => ({ showNotification: mocks.notify }),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/services/freightCustomsService', () => ({
  freightCustomsService: {
    getAvailableShipments: mocks.getAvailableShipments,
    createOperation: mocks.createOperation,
    updateOperation: mocks.updateOperation,
  },
}));

describe('FreightCustomsCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user.capabilities = [];
  });

  it('reste fail-closed sans capacité freight.prepare autoritative', async () => {
    render(<FreightCustomsCreate />);

    expect(await screen.findByText('Création non autorisée')).toBeInTheDocument();
    expect(mocks.getAvailableShipments).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Créer l’opération/i })).not.toBeInTheDocument();
  });

  it('crée par RPC puis enregistre la note avec la version composite reçue', async () => {
    mocks.auth.user.capabilities = ['freight.prepare'];
    mocks.getAvailableShipments.mockResolvedValue([{
      id: '30000000-0000-4000-8000-000000000001',
      reference_number: 'SHIP-42',
      status: 'ready_for_expedition',
      total_weight_grams: 1000,
      total_weight_oz: 32.15,
      mining_companies: { id: '40000000-0000-4000-8000-000000000001', name: 'Mine A' },
    }]);
    const created = {
      id: '20000000-0000-4000-8000-000000000001',
      shipping_preparation_id: '30000000-0000-4000-8000-000000000001',
      reference_number: 'FC-20260824-00000001',
      status: 'customs_pending',
      updated_at: '2026-08-24T00:00:00Z',
    };
    mocks.createOperation.mockResolvedValue(created);
    mocks.updateOperation.mockResolvedValue({ ...created, notes: 'Dossier complet' });

    render(<FreightCustomsCreate />);
    await screen.findByText(/SHIP-42/);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: created.shipping_preparation_id } });
    fireEvent.change(screen.getByPlaceholderText('Notes ou observations pour cette opération douanière...'), {
      target: { value: ' Dossier complet ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Créer l'opération/i }));

    await waitFor(() => expect(mocks.createOperation).toHaveBeenCalledWith(created.shipping_preparation_id));
    expect(mocks.updateOperation).toHaveBeenCalledWith(
      created.id,
      created.updated_at,
      { notes: 'Dossier complet' },
    );
    expect(mocks.navigate).toHaveBeenCalledWith(`/freight-customs/${created.id}`);
  });
});
