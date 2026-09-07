import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerForm } from './CustomerForm';
const mocks = vi.hoisted(() => ({ id: 'client-a' as string | undefined, user: { id: 'user-a', mining_company_id: 'mine-a' }, load: vi.fn(), save: vi.fn(), navigate: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('react-router-dom', async importOriginal => ({ ...await importOriginal<typeof import('react-router-dom')>(), useParams: () => ({ id: mocks.id }), useNavigate: () => mocks.navigate }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/services/customerDossierService', () => ({ loadCustomerDossier: mocks.load, saveCustomerDossier: mocks.save }));
vi.mock('@/hooks/useAlert', () => ({ useAlert: () => ({ success: mocks.success, error: mocks.error }) }));
const bank = { id: 'bank-a', bankName: 'Banque recette', country: 'Burkina Faso', city: 'Ouagadougou', accountNumber: '123', iban: '', swiftCode: 'TEST', currency: 'XOF', isPrimary: true, isActive: true };
const dossier = { customer: { id: 'client-a', name: 'CLIENT RECETTE', email: 'client@example.test', phone: '+22670000000', country: 'Burkina Faso', address: 'Zone de recette', contact_person: 'Contact recette', tax_id: 'TEST-IFU', payment_terms: 'Immediate', credit_limit: 0, status: 'pending' }, banks: [bank] };
const view = () => <MemoryRouter><CustomerForm /></MemoryRouter>;
beforeEach(() => { vi.clearAllMocks(); mocks.id = 'client-a'; mocks.user = { id: 'user-a', mining_company_id: 'mine-a' }; mocks.load.mockResolvedValue(dossier); mocks.save.mockResolvedValue('client-a'); });
describe('Dossier client — composants, sans preuve de persistance réelle', () => {
  it('relit un crédit nul et conserve les identifiants bancaires dans le contrat de sauvegarde', async () => {
    render(view());
    expect(await screen.findByLabelText(/Limite de crédit/)).toHaveValue(0);
    fireEvent.submit(screen.getByRole('form', { name: 'Dossier client' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('client-a', expect.objectContaining({ credit_limit: 0, status: 'pending' }), [bank]));
    expect(mocks.navigate).toHaveBeenCalledWith('/customers/client-a', expect.anything());
  });
  it('empêche les soumissions répétées pendant une sauvegarde différée', async () => {
    let finish!: (value: string) => void; mocks.save.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(view()); await screen.findByLabelText(/Limite de crédit/);
    const form = screen.getByRole('form', { name: 'Dossier client' }); fireEvent.submit(form); fireEvent.submit(form);
    expect(mocks.save).toHaveBeenCalledTimes(1);
    await act(async () => finish('client-a'));
    expect(mocks.success).toHaveBeenCalledTimes(1);
  });
  it('interdit la sauvegarde après échec de lecture des banques et permet de réessayer', async () => {
    mocks.load.mockRejectedValueOnce(new Error('Lecture impossible'));
    render(view()); await screen.findByText('Dossier client indisponible');
    expect(screen.queryByRole('form')).not.toBeInTheDocument(); expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByLabelText(/Limite de crédit/)).toHaveValue(0);
  });
  it('réinitialise tous les champs et les banques lors du passage édition → création', async () => {
    const { rerender } = render(view()); await screen.findByDisplayValue('CLIENT RECETTE');
    mocks.id = undefined; rerender(view());
    await waitFor(() => expect(screen.getByLabelText(/Raison sociale/)).toHaveValue(''));
    expect(screen.getByText('Aucun compte bancaire ajouté')).toBeInTheDocument();
    expect(screen.getByLabelText(/Limite de crédit/)).toHaveValue(500000);
  });
  it('relit le dossier lorsque seule la mine du contexte change', async () => {
    const { rerender } = render(view()); await screen.findByDisplayValue('CLIENT RECETTE');
    mocks.user = { ...mocks.user, mining_company_id: 'mine-b' }; rerender(view());
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2));
  });
  it('ignore une réponse de sauvegarde arrivée après la sortie de la page', async () => {
    let finish!: (value: string) => void; mocks.save.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { unmount } = render(view()); await screen.findByDisplayValue('CLIENT RECETTE');
    fireEvent.submit(screen.getByRole('form', { name: 'Dossier client' })); unmount();
    await act(async () => finish('client-a'));
    expect(mocks.navigate).not.toHaveBeenCalled(); expect(mocks.success).not.toHaveBeenCalled();
  });
  it('affiche les erreurs de pays et refuse une banque incomplète avant tout appel', async () => {
    mocks.id = undefined; render(view()); await screen.findByRole('form');
    fireEvent.submit(screen.getByRole('form'));
    expect(screen.getByLabelText(/Pays/)).toHaveAttribute('aria-invalid', 'true');
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('rouvre une banque incomplète à chaque soumission puis accepte sa correction', async () => {
    mocks.load.mockResolvedValue({ ...dossier, banks: [bank, { ...bank, id: 'bank-b', isPrimary: false, city: '' }] });
    render(view()); await screen.findByDisplayValue('CLIENT RECETTE');
    fireEvent.submit(screen.getByRole('form'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fermer le compte bancaire 2' })).toHaveAttribute('aria-expanded', 'true'));
    expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le compte bancaire 2' }));
    fireEvent.submit(screen.getByRole('form'));
    await waitFor(() => expect(screen.getByRole('textbox', { name: /Ville/ })).toHaveFocus());
    fireEvent.change(screen.getByRole('textbox', { name: /Ville/ }), { target: { value: 'Bobo-Dioulasso' } });
    fireEvent.submit(screen.getByRole('form'));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('client-a', expect.anything(), [bank, expect.objectContaining({ id: 'bank-b', city: 'Bobo-Dioulasso' })]));
  });
  it('conserve les valeurs historiques hors catalogue sans substitution implicite', async () => {
    mocks.load.mockResolvedValue({ customer: { ...dossier.customer, country: 'Pays historique', payment_terms: 'À réception', status: null }, banks: [{ ...bank, country: 'Pays historique', currency: 'AED' }] });
    render(view()); await screen.findByDisplayValue('CLIENT RECETTE');
    expect(screen.getByRole('option', { name: 'À réception (valeur enregistrée)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'AED (valeur enregistrée)' })).toBeInTheDocument();
    fireEvent.submit(screen.getByRole('form'));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('client-a', expect.objectContaining({ country: 'Pays historique', payment_terms: 'À réception', status: null }), [expect.objectContaining({ country: 'Pays historique', currency: 'AED' })]));
  });
});
