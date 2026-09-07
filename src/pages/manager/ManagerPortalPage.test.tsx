import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { managerPortalService } from '@/services/managerPortalService';
import ManagerPortalPage from './ManagerPortalPage';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'direction@sonasp.bf', full_name: 'Direction générale', role: 'manager', is_active: true, id: 'manager-test' }, signOut: vi.fn() }),
}));
vi.mock('@/services/managerPortalService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/managerPortalService')>();
  return { ...original, managerPortalService: { load: vi.fn() } };
});

const mockedLoad = vi.mocked(managerPortalService.load);
const snapshot = {
  companies: [{ id: 'mine-1', name: 'Mine A', abbreviation: 'MA', code: 'M-A' }],
  productions: [{ id: 'p1', mining_company_id: 'mine-1', production_date: '2026-08-20', estimated_oz: 42, estimated_fineness_pct: 91, status: 'prepared' }],
  budgets: [], forecasts: [], requests: [], contracts: [], invoices: [], payments: [], analyses: [],
};

describe('ManagerPortalPage', () => {
  beforeEach(() => { vi.clearAllMocks(); mockedLoad.mockResolvedValue(snapshot); });

  it('affiche un portail Direction distinct et explicitement consultatif', async () => {
    render(<MemoryRouter initialEntries={['/portail-direction']}><ManagerPortalPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Pilotage national' })).toBeInTheDocument());
    expect(screen.getByRole('complementary', { name: 'Navigation principale' })).toBeInTheDocument();
    expect(screen.getByText(/Consultation uniquement · Direction SONASP/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Production nationale' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /créer|modifier|valider/i })).not.toBeInTheDocument();
  });

  it('présente les statuts persistés avec leur libellé français', async () => {
    render(<MemoryRouter initialEntries={['/portail-direction/production']}><ManagerPortalPage /></MemoryRouter>);

    expect(await screen.findByText('Préparé')).toBeInTheDocument();
    expect(screen.queryByText('prepared')).not.toBeInTheDocument();
  });
});
