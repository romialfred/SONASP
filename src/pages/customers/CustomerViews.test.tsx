import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerProfile } from './CustomerProfile';
import { CustomerListing } from './CustomerListing';
const mocks = vi.hoisted(() => ({ load: vi.fn(), directory: vi.fn(), sales: vi.fn(), user: { id: 'user-a', role: 'owner', is_active: true, mining_company_id: '' } }));
vi.mock('react-router-dom', async importOriginal => ({ ...await importOriginal<typeof import('react-router-dom')>(), useParams: () => ({ id: 'client-a' }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/charts/LineChartWidget', () => ({ LineChartWidget: () => <div>Graphique issu des ventes chargées</div> }));
vi.mock('@/services/customerDossierService', async importOriginal => ({ ...await importOriginal<typeof import('@/services/customerDossierService')>(), loadCustomerDossier: mocks.load, loadCustomerDirectory: mocks.directory, loadCustomerSales: mocks.sales }));
const customer = { id: 'client-a', name: 'CLIENT RECETTE', email: 'client@example.test', phone: '+22670000000', country: 'Burkina Faso', address: 'Zone de recette', contact_person: 'Contact recette', tax_id: 'TEST-IFU', payment_terms: 'Immediate', credit_limit: 123.45, status: 'pending', created_at: '2026-09-01T00:00:00Z' };
const bank = { id: 'bank-a', bankName: 'Banque recette', country: 'Burkina Faso', city: 'Ouagadougou', accountNumber: '123', iban: 'TEST-IBAN', swiftCode: 'TEST', currency: 'XOF', isPrimary: true, isActive: true };
const sale = { id: 'sale-from-db', customer_id: 'client-a', sale_number: 'DB-2026-17', created_at: '2026-09-01T00:00:00Z', status: 'customer_approved', quantity_oz: 2, final_proceeds: 100, currency: 'USD' };
beforeEach(() => { vi.clearAllMocks(); mocks.user = { id: 'user-a', role: 'owner', is_active: true, mining_company_id: '' }; mocks.load.mockResolvedValue({ customer, banks: [bank] }); mocks.directory.mockResolvedValue([customer]); mocks.sales.mockResolvedValue([sale]); });
describe('Vues Clients — composants sans serveur réel', () => {
  it('affiche les données relues, le crédit décimal et les banques', async () => {
    render(<MemoryRouter><CustomerProfile /></MemoryRouter>);
    await screen.findByRole('heading', { level: 1, name: 'CLIENT RECETTE' });
    expect(screen.getByText(/123,45/)).toBeInTheDocument();
    expect(screen.getByText('TEST-IFU')).toBeInTheDocument();
    expect(screen.getByDisplayValue('TEST-IBAN')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Écrire au client' })).toHaveAttribute('href', 'mailto:client%40example.test');
    expect(screen.getByRole('link', { name: 'Registre des paiements' })).toHaveAttribute('href', '/payments');
  });
  it('ouvre uniquement la vraie référence et aucun historique synthétique', async () => {
    render(<MemoryRouter><CustomerProfile /></MemoryRouter>); await screen.findByRole('heading', { level: 1 });
    fireEvent.click(screen.getByRole('tab', { name: /Transactions/ }));
    expect(screen.getByRole('link', { name: 'Consulter la vente DB-2026-17' })).toHaveAttribute('href', '/sales/sale-from-db');
    expect(screen.queryByText(/SL-2024/)).not.toBeInTheDocument();
  });
  it('distingue les ventes indisponibles d’un historique vide', async () => {
    mocks.sales.mockRejectedValue(new Error('Indisponibilité'));
    render(<MemoryRouter><CustomerProfile /></MemoryRouter>); await screen.findByText('Indicateurs indisponibles');
    fireEvent.click(screen.getByRole('tab', { name: /Transactions/ }));
    expect(screen.getByText('Ventes indisponibles. Utilisez Actualiser pour réessayer.')).toBeInTheDocument();
    expect(screen.queryByText('Aucune vente enregistrée pour ce client.')).not.toBeInTheDocument();
  });
  it('calcule les compteurs avant pagination et combine recherche et statut', async () => {
    mocks.directory.mockResolvedValue(Array.from({ length: 25 }, (_, index) => ({ ...customer, id: `client-${index}`, name: `CLIENT ${index}`, status: index < 12 ? 'active' : 'pending' })));
    render(<MemoryRouter><CustomerListing /></MemoryRouter>);
    await screen.findByRole('tab', { name: 'Tous (25)' });
    expect(screen.getByRole('tab', { name: 'Actif (12)' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Consulter CLIENT/ })).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByRole('link', { name: 'Consulter CLIENT 10' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Rechercher un client'), { target: { value: 'CLIENT 24' } });
    expect(screen.getByRole('tab', { name: 'Tous (1)' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Consulter CLIENT 24' })).toBeInTheDocument();
  });
  it('ne convertit pas une erreur de répertoire en liste vide', async () => {
    mocks.directory.mockRejectedValue(new Error('Refus'));
    render(<MemoryRouter><CustomerListing /></MemoryRouter>);
    await screen.findByText('Répertoire indisponible');
    expect(screen.queryByText('Aucun client enregistré dans votre périmètre.')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('recharge la liste lorsque seule la mine du contexte change', async () => {
    const { rerender } = render(<MemoryRouter><CustomerListing /></MemoryRouter>);
    await screen.findByRole('table'); mocks.user = { ...mocks.user, mining_company_id: 'mine-b' };
    rerender(<MemoryRouter><CustomerListing /></MemoryRouter>);
    await waitFor(() => expect(mocks.directory).toHaveBeenCalledTimes(2));
    expect(mocks.sales).toHaveBeenCalledTimes(2);
  });
  it('relit les filtres et la pagination depuis l’URL', async () => {
    mocks.directory.mockResolvedValue(Array.from({ length: 25 }, (_, index) => ({ ...customer, id: `client-${index}`, name: `CLIENT ${index}` })));
    render(<MemoryRouter initialEntries={['/customers?status=pending&page=2&q=CLIENT']}><CustomerListing /></MemoryRouter>);
    await screen.findByRole('tab', { name: 'En attente (25)' });
    expect(screen.getByRole('tab', { name: 'En attente (25)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: 'Consulter CLIENT 10' })).toBeInTheDocument();
  });
  it('propose un retour au contexte de liste transmis au détail', async () => {
    render(<MemoryRouter initialEntries={[{ pathname: '/customers/client-a', state: { customersReturnTo: '/customers?status=pending&page=2' } }]}><CustomerProfile /></MemoryRouter>);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('link', { name: 'Retour au répertoire' })).toHaveAttribute('href', '/customers?status=pending&page=2');
  });
});
