import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerForm } from '@/pages/customers/CustomerForm';
import { CustomerListing } from '@/pages/customers/CustomerListing';
import { CustomerProfile } from '@/pages/customers/CustomerProfile';
import { BankAccountForm } from '@/components/customers/BankAccountForm';
import { customerActivity } from '@/services/customerDossierService';
import { CUSTOMER_COUNTRY_OPTIONS, customerCountryLabel } from '@/lib/customerCountryLabels';
import { COUNTRIES } from '@/constants/countries';

const mocks = vi.hoisted(() => ({ id: 'client-a', user: { id: 'actor-a', role: 'owner', is_active: true, mining_company_id: 'mine-a', access_role_id: 'role-a' }, load: vi.fn(), directory: vi.fn(), sales: vi.fn(), save: vi.fn(), navigate: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('react-router-dom', async original => ({ ...await original<typeof import('react-router-dom')>(), useParams: () => ({ id: mocks.id }), useNavigate: () => mocks.navigate }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/charts/LineChartWidget', () => ({ LineChartWidget: () => <div data-testid="chart-double" /> }));
vi.mock('@/hooks/useAlert', () => ({ useAlert: () => ({ success: mocks.success, error: mocks.error }) }));
vi.mock('@/services/customerDossierService', async original => ({ ...await original<typeof import('@/services/customerDossierService')>(), loadCustomerDossier: mocks.load, loadCustomerDirectory: mocks.directory, loadCustomerSales: mocks.sales, saveCustomerDossier: mocks.save }));

const customer = { id: 'client-a', name: 'QA CLIENT A', email: 'qa@example.invalid', phone: '+22600000000', country: 'Burkina Faso', address: 'Adresse de recette', contact_person: 'Contact fictif', tax_id: 'QA-IFU', payment_terms: 'Immediate', credit_limit: 0, status: 'pending', created_at: '2026-09-01T00:00:00Z' };
const bank = { id: 'bank-a', bankName: 'Coris Bank International', country: 'Burkina Faso', city: 'Ouagadougou', accountNumber: 'QA-123', iban: 'QA-IBAN', swiftCode: 'QA-SWIFT', currency: 'XOF', isPrimary: true, isActive: true };
const dossier = { customer, banks: [bank] };
const sale = { id: 'sale-a', customer_id: customer.id, sale_number: 'QA-SALE-A', created_at: '2026-09-01T00:00:00Z', status: 'customer_approved', quantity_oz: 2, final_proceeds: 123.45, currency: 'USD' };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; }
const form = () => <MemoryRouter><CustomerForm /></MemoryRouter>;
const profile = () => <MemoryRouter><CustomerProfile /></MemoryRouter>;
const listing = () => <MemoryRouter><CustomerListing /></MemoryRouter>;
beforeEach(() => { vi.clearAllMocks(); mocks.id = 'client-a'; mocks.user = { id: 'actor-a', role: 'owner', is_active: true, mining_company_id: 'mine-a', access_role_id: 'role-a' }; mocks.load.mockResolvedValue(dossier); mocks.directory.mockResolvedValue([customer]); mocks.sales.mockResolvedValue([sale]); mocks.save.mockResolvedValue('client-a'); });

describe('Audit indépendant Clients — jsdom/services doublés, aucune persistance réelle', () => {
  it('ignore le chargement A qui répond après le chargement B du formulaire', async () => {
    const old = deferred<typeof dossier>(); mocks.load.mockReturnValueOnce(old.promise);
    const { rerender } = render(form());
    mocks.id = 'client-b'; mocks.load.mockResolvedValue({ customer: { ...customer, id: 'client-b', name: 'QA CLIENT B' }, banks: [] }); rerender(form());
    await screen.findByDisplayValue('QA CLIENT B');
    await act(async () => old.resolve(dossier));
    expect(screen.queryByDisplayValue('QA CLIENT A')).not.toBeInTheDocument();
    expect(screen.getByText('Aucun compte bancaire ajouté')).toBeInTheDocument();
  });
  it('ignore une ancienne erreur de sauvegarde après changement du rôle d’accès', async () => {
    const old = deferred<string>(); mocks.save.mockReturnValueOnce(old.promise);
    const { rerender } = render(form()); await screen.findByDisplayValue('QA CLIENT A'); fireEvent.submit(screen.getByRole('form'));
    mocks.user = { ...mocks.user, access_role_id: 'role-b' }; rerender(form());
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2)); await screen.findByRole('form');
    await act(async () => old.reject(new Error('Ancienne erreur')));
    expect(mocks.error).not.toHaveBeenCalled(); expect(mocks.navigate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Mettre à jour le client/ })).toBeEnabled();
  });
  it('préserve B lorsque le détail A et ses ventes répondent tardivement', async () => {
    const oldDossier = deferred<typeof dossier>(); const oldSales = deferred<typeof sale[]>();
    mocks.load.mockReturnValueOnce(oldDossier.promise); mocks.sales.mockReturnValueOnce(oldSales.promise);
    const { rerender } = render(profile());
    mocks.id = 'client-b'; mocks.load.mockResolvedValue({ customer: { ...customer, id: 'client-b', name: 'QA CLIENT B' }, banks: [] }); mocks.sales.mockResolvedValue([]); rerender(profile());
    await screen.findByRole('heading', { level: 1, name: 'QA CLIENT B' });
    await act(async () => { oldDossier.resolve(dossier); oldSales.resolve([sale]); });
    expect(screen.queryByText('QA CLIENT A')).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('tab', { name: /Transactions/ }));
    expect(screen.queryByText('QA-SALE-A')).not.toBeInTheDocument(); expect(screen.getByText('Aucune vente enregistrée pour ce client.')).toBeInTheDocument();
  });
  it('masque immédiatement le détail puis recharge si seul access_role_id change', async () => {
    const next = deferred<typeof dossier>(); const { rerender } = render(profile()); await screen.findByRole('heading', { level: 1, name: 'QA CLIENT A' });
    mocks.load.mockReturnValueOnce(next.promise); mocks.user = { ...mocks.user, access_role_id: 'role-b' }; rerender(profile());
    expect(screen.queryByRole('heading', { level: 1, name: 'QA CLIENT A' })).not.toBeInTheDocument();
    await act(async () => next.resolve({ customer: { ...customer, name: 'QA NOUVEAU CONTEXTE' }, banks: [] }));
    await screen.findByRole('heading', { level: 1, name: 'QA NOUVEAU CONTEXTE' });
  });
  it('rejette les réponses anciennes du répertoire et de ses ventes après changement de mine', async () => {
    const oldCustomers = deferred<typeof customer[]>(); const oldSales = deferred<typeof sale[]>();
    mocks.directory.mockReturnValueOnce(oldCustomers.promise); mocks.sales.mockReturnValueOnce(oldSales.promise);
    const { rerender } = render(listing()); mocks.user = { ...mocks.user, mining_company_id: 'mine-b' }; mocks.directory.mockResolvedValue([]); mocks.sales.mockResolvedValue([]); rerender(listing());
    await screen.findByText('Aucun client enregistré dans votre périmètre.');
    await act(async () => { oldCustomers.resolve([customer]); oldSales.resolve([sale]); });
    expect(screen.queryByRole('link', { name: 'Consulter QA CLIENT A' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tous (0)' })).toHaveAttribute('aria-selected', 'true');
  });
  it('conserve un onglet de statut inconnu actif lorsque la recherche réduit son total à zéro', async () => {
    mocks.directory.mockResolvedValue([{ ...customer, status: null }, { ...customer, id: 'client-b', name: 'QA CLIENT B' }]); render(listing());
    fireEvent.click(await screen.findByRole('tab', { name: 'Non renseigné (1)' }));
    fireEvent.change(screen.getByLabelText('Rechercher un client'), { target: { value: 'CLIENT B' } });
    expect(screen.getByRole('tab', { name: 'Non renseigné (0)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Aucun client ne correspond aux filtres.')).toBeInTheDocument();
  });
  it('ne prétend pas qu’il n’y a aucune vente lorsque la lecture a échoué', async () => {
    mocks.sales.mockRejectedValue(new Error('Lecture indisponible')); render(profile()); await screen.findByText('Indicateurs indisponibles');
    expect(screen.getByText('Ventes indisponibles')).toBeInTheDocument();
    expect(screen.queryByText('Aucune vente approuvée')).not.toBeInTheDocument();
  });
  it('affiche les centimes enregistrés d’une vente dans le détail', async () => {
    render(profile()); await screen.findByRole('heading', { level: 1 }); fireEvent.click(screen.getByRole('tab', { name: /Transactions/ }));
    expect(screen.getAllByText(/123,45/).length).toBeGreaterThan(0);
  });
  it('traduit uniquement le pays et préserve une raison sociale homonyme avec fiscalité absente', async () => {
    mocks.load.mockResolvedValue({ customer: { ...customer, name: 'Guinea', country: 'Guinea', tax_id: null }, banks: [] });
    render(profile()); await screen.findByRole('heading', { level: 1, name: 'Guinea' });
    expect(screen.getByText('Raison sociale', { selector: 'dt' }).nextElementSibling).toHaveTextContent(/^Guinea$/);
    expect(screen.getByText('Pays', { selector: 'dt' }).nextElementSibling).toHaveTextContent(/^Guinée$/);
    expect(screen.getByText('Identifiant fiscal / immatriculation', { selector: 'dt' }).nextElementSibling).toHaveTextContent(/^Non renseigné$/);
  });
  it('n’accepte pas un chemin de retour externe ou étranger au répertoire', async () => {
    render(<MemoryRouter initialEntries={[{ pathname: '/customers/client-a', state: { customersReturnTo: 'https://example.invalid/redirect' } }]}><CustomerProfile /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Retour au répertoire' })).toHaveAttribute('href', '/customers');
  });
  it('retire le compte principal sans muter les identités ou objets reçus', () => {
    const first = Object.freeze({ ...bank }); const second = Object.freeze({ ...bank, id: 'bank-b', isPrimary: false }); const change = vi.fn();
    render(<BankAccountForm banks={[first, second]} onChange={change} />); fireEvent.click(screen.getByRole('button', { name: 'Retirer le compte bancaire 1' }));
    expect(second.isPrimary).toBe(false); expect(change).toHaveBeenCalledWith([{ ...second, isPrimary: true }]); expect(first.id).toBe('bank-a');
  });
  it('ne calcule pas de total avec montant non fini ou devise inconnue', () => {
    for (const bad of [NaN, Infinity, -Infinity]) expect(customerActivity([{ ...sale, final_proceeds: bad }]).total).toBeNull();
    expect(customerActivity([{ ...sale, currency: null }]).total).toBeNull();
    expect(customerActivity([{ ...sale, final_proceeds: 0 }])).toMatchObject({ count: 1, total: 0, average: 0 });
  });
  it('traduit les huit graphies historiques corrigées sans changer ni perdre une valeur du catalogue API', () => {
    const mappings = { 'Antigua and Barbuda': 'AG', 'Bosnia and Herzegovina': 'BA', 'Czech Republic': 'CZ', 'Saint Kitts and Nevis': 'KN', 'Saint Lucia': 'LC', 'Saint Vincent and the Grenadines': 'VC', 'Sao Tome and Principe': 'ST', 'Trinidad and Tobago': 'TT' };
    const french = new Intl.DisplayNames(['fr'], { type: 'region' });
    for (const [value, code] of Object.entries(mappings)) expect(customerCountryLabel(value)).toBe(french.of(code));
    expect(CUSTOMER_COUNTRY_OPTIONS.map(option => option.value).sort()).toEqual([...COUNTRIES].sort());
    expect(new Set(CUSTOMER_COUNTRY_OPTIONS.map(option => option.value)).size).toBe(COUNTRIES.length);
  });
  it('ne propose pas le catalogue guinéen pour la Guinée-Bissau ou la Guinée équatoriale', () => {
    const { rerender } = render(<BankAccountForm banks={[{ ...bank, country: 'Guinea-Bissau' }]} onChange={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: /Nom de la banque/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Ecobank Guinée' })).not.toBeInTheDocument();
    rerender(<BankAccountForm banks={[{ ...bank, country: 'Equatorial Guinea' }]} onChange={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: /Nom de la banque/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Ecobank Guinée' })).not.toBeInTheDocument();
  });
});
