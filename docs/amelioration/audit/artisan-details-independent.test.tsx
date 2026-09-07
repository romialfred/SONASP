import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ArtisanMinierDetails from '@/pages/artisan-minier/ArtisanMinierDetails';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({ id: 'a1', user: { id: 'actor-a', role: 'owner', is_active: true, organization_id: 'org-a', mining_company_id: 'mine-a', access_role_id: 'role-a' } as Record<string, unknown>, artisan: vi.fn(), sales: vi.fn(), infractions: vi.fn(), showError: vi.fn(), navigate: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, useParams: () => ({ id: mocks.id }), Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/hooks/useCustomAlert', () => ({ useCustomAlert: () => ({ alertState: { isOpen: false, message: '', type: 'info' }, showError: mocks.showError, closeAlert: vi.fn() }) }));
vi.mock('@/components/ui/CustomAlert', () => ({ CustomAlert: () => null }));
vi.mock('@/components/artisan/ArtisanDossierSummary', () => ({ ArtisanDossierSummary: ({ artisan }: { artisan: { nom: string } }) => <div data-testid="identity-summary">{artisan.nom}</div> }));
vi.mock('@/components/artisan/AffiliationDossier', () => ({ AffiliationDossier: () => <div data-testid="affiliation-double" /> }));
vi.mock('@/services/artisanMinierService', () => ({ artisanMinierService: { getById: mocks.artisan } }));
vi.mock('@/services/artisanGoldSalesService', () => ({ artisanGoldSalesService: { getByArtisan: mocks.sales } }));
vi.mock('@/services/artisanInfractionsService', () => ({ artisanInfractionsService: { getByArtisanId: mocks.infractions } }));

const artisan = { id: 'a1', type_personne: 'physique', type_artisan: 'exploitant', nom: 'QA ANCIEN', prenoms: 'Contexte', actif: true, telephone: '+22600000000' };
const sale = { id: 'sale-a', artisan_id: 'a1', numero_recu: 'QA-ANCIEN', date_vente: '2026-09-01', type_or: 'poudre', quantite_grammes: 150, montant_total_fcfa: 9000000, statut: 'payee' };
const infraction = { id: 'infraction-a', artisan_id: 'a1', type_infraction: 'QA ancien contexte', date_infraction: '2026-09-01', statut_traitement: 'en_cours' };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; }
beforeEach(() => { vi.clearAllMocks(); mocks.id = 'a1'; mocks.user = { id: 'actor-a', role: 'owner', is_active: true, organization_id: 'org-a', mining_company_id: 'mine-a', access_role_id: 'role-a' }; mocks.artisan.mockResolvedValue(artisan); mocks.sales.mockResolvedValue([]); mocks.infractions.mockResolvedValue([]); });

describe('Audit indépendant du détail Artisan — lectures simulées, sans Auth/DB réelle', () => {
  it.each(['organization_id', 'mining_company_id', 'access_role_id'])('change %s seul : masque/recharge le même dossier et rejette les anciennes annexes', async field => {
    const oldSales = deferred<typeof sale[]>(); const oldInfractions = deferred<typeof infraction[]>(); const newIdentity = deferred<typeof artisan>();
    mocks.sales.mockReturnValueOnce(oldSales.promise); mocks.infractions.mockReturnValueOnce(oldInfractions.promise);
    const { rerender } = render(<ArtisanMinierDetails />); await screen.findByRole('heading', { name: 'QA ANCIEN Contexte' });
    mocks.artisan.mockReturnValueOnce(newIdentity.promise); mocks.user = { ...mocks.user, [field]: 'new-context' }; rerender(<ArtisanMinierDetails />);
    expect(screen.queryByRole('heading', { name: 'QA ANCIEN Contexte' })).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.artisan).toHaveBeenCalledTimes(2));
    await act(async () => newIdentity.resolve({ ...artisan, nom: 'QA NOUVEAU' }));
    await screen.findByRole('heading', { name: 'QA NOUVEAU Contexte' });
    await act(async () => { oldSales.resolve([sale]); oldInfractions.resolve([infraction]); });
    const stats = within(screen.getByRole('region', { name: 'Indicateurs du dossier' }));
    expect(stats.getByText('0,00 g')).toBeInTheDocument(); expect(stats.queryByText('150,00 g')).not.toBeInTheDocument();
    expect(screen.queryByText('1 infraction(s) en cours')).not.toBeInTheDocument();
    expect(mocks.sales).toHaveBeenCalledTimes(2); expect(mocks.infractions).toHaveBeenCalledTimes(2);
  });
  it('ignore une identité de l’ancien utilisateur qui répond après le nouveau', async () => {
    const old = deferred<typeof artisan>(); mocks.artisan.mockReturnValueOnce(old.promise);
    const { rerender } = render(<ArtisanMinierDetails />); mocks.user = { ...mocks.user, id: 'actor-b' };
    mocks.artisan.mockResolvedValue({ ...artisan, nom: 'QA NOUVEAU' }); rerender(<ArtisanMinierDetails />);
    await screen.findByRole('heading', { name: 'QA NOUVEAU Contexte' }); await act(async () => old.resolve(artisan));
    expect(screen.queryByRole('heading', { name: 'QA ANCIEN Contexte' })).not.toBeInTheDocument();
    expect(mocks.showError).not.toHaveBeenCalled();
  });
  it('bascule d’Infractions vers Informations quand le contexte devient collecteur', async () => {
    mocks.infractions.mockResolvedValue([infraction]); const { rerender } = render(<ArtisanMinierDetails />);
    await screen.findByRole('heading', { name: 'QA ANCIEN Contexte' }); fireEvent.click(screen.getByRole('tab', { name: /Infractions/ }));
    expect(screen.queryByTestId('identity-summary')).not.toBeInTheDocument();
    mocks.user = { id: 'collector-b', role: 'customer', is_active: true, capabilities: ['collector.operate'] }; rerender(<ArtisanMinierDetails />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Informations/ })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByTestId('identity-summary')).toBeInTheDocument(); expect(screen.queryByRole('tab', { name: /Infractions/ })).not.toBeInTheDocument();
    expect(mocks.infractions).toHaveBeenCalledTimes(1);
  });
  it('une reprise de ventes A échouant après navigation B ne rend pas B indisponible', async () => {
    const retryA = deferred<typeof sale[]>(); mocks.sales.mockRejectedValueOnce(new Error('Ancienne panne')).mockReturnValueOnce(retryA.promise).mockResolvedValueOnce([]);
    const { rerender } = render(<ArtisanMinierDetails />); fireEvent.click(await screen.findByRole('button', { name: 'Réessayer les ventes' }));
    await waitFor(() => expect(mocks.sales).toHaveBeenCalledTimes(2));
    mocks.id = 'a2'; mocks.artisan.mockResolvedValue({ ...artisan, id: 'a2', nom: 'QA NOUVEAU' }); rerender(<ArtisanMinierDetails />);
    await screen.findByRole('heading', { name: 'QA NOUVEAU Contexte' }); await act(async () => retryA.reject(new Error('Reprise obsolète')));
    expect(screen.queryByRole('button', { name: 'Réessayer les ventes' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Indicateurs du dossier' })).getByText('0,00 g')).toBeInTheDocument();
  });
});
