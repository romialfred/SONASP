import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AffiliationDossier } from '@/components/artisan/AffiliationDossier';

const mocks = vi.hoisted(() => ({ list: vi.fn(), history: vi.fn(), dues: vi.fn(), tariffs: vi.fn(), user: {} as Record<string, unknown> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/services/affiliationService', () => ({ affiliationService: { list: mocks.list, history: mocks.history, dues: mocks.dues, tariffs: mocks.tariffs } }));
vi.mock('@/services/carteProfessionnelleService', () => ({ carteProfessionnelleService: {} }));
vi.mock('@/components/artisan/AffiliationDigitalCard', () => ({ AffiliationDigitalCard: ({ card }: { card: { id: string } }) => <p>APERÇU-{card.id}</p> }));
vi.mock('@/components/artisan/AffiliationPaymentPanel', () => ({ AffiliationPaymentPanel: ({ dues }: { dues: { id: string } | null }) => <p>FINANCE-{dues?.id ?? 'VIDE'}</p> }));
const cardA = { id: 'card-a', artisan_id: 'artisan', holder_name: 'Titulaire autorisé A', numero_affiliation: 'FS-A', version: 1, statut: 'validee', statut_effectif: 'inactive', snapshot: null, validated_at: '2026-01-01', render_status: 'ready' };
const cardB = { ...cardA, id: 'card-b', numero_affiliation: 'FS-B', version: 2 };
const finance = (id: string) => ({ droit: { id, montant: 100, statut: 'ouvert', debut: '2026-01-01', fin: '2026-12-31' }, encaissements: [] });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const view = (initialCardId = 'card-a') => <MemoryRouter><AffiliationDossier artisanId="artisan" initialCardId={initialCardId} /></MemoryRouter>;

describe('Audit indépendant : portée et relecture affiliation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user = { id: 'controller-a', organization_id: 'org-a', is_active: true, capabilities: ['artisan.membership.manage'] };
    mocks.list.mockResolvedValue([cardA, cardB]);
    mocks.history.mockResolvedValue([]);
    mocks.tariffs.mockResolvedValue([]);
    mocks.dues.mockImplementation((id: string) => Promise.resolve(finance(id)));
  });

  it('masque immédiatement les données lors du changement de session à artisan identique', async () => {
    const { rerender } = render(view());
    await screen.findByText('FINANCE-card-a');
    mocks.list.mockImplementation(() => new Promise(() => {}));
    mocks.user = { ...mocks.user, id: 'controller-b', organization_id: 'org-b' };
    rerender(view());
    expect(screen.queryByText('FINANCE-card-a')).not.toBeInTheDocument();
    expect(screen.queryByText('APERÇU-card-a')).not.toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });

  it('reprend les droits de la nouvelle émission si la sélection change pendant la relecture', async () => {
    const { rerender } = render(view());
    await screen.findByText('FINANCE-card-a');
    const pending = deferred<ReturnType<typeof finance>>();
    mocks.dues.mockImplementation((id: string) => id === 'card-a' ? pending.promise : Promise.resolve(finance(id)));
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    await waitFor(() => expect(mocks.dues).toHaveBeenCalledTimes(2));
    rerender(view('card-b'));
    await screen.findByText('APERÇU-card-b');
    await act(async () => pending.resolve(finance('card-a')));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actualiser' })).toBeEnabled());
    expect(await screen.findByText('FINANCE-card-b')).toBeInTheDocument();
    expect(screen.queryByText('FINANCE-card-a')).not.toBeInTheDocument();
  });

  it('ne laisse pas une relecture lente de nouveaux droits bloquée par le changement dues_card_id', async () => {
    render(view());
    await screen.findByText('FINANCE-card-a');
    const pending = deferred<ReturnType<typeof finance>>();
    mocks.list.mockResolvedValue([{ ...cardA, dues_card_id: 'new-dues' }, cardB]);
    mocks.dues.mockImplementation((id: string) => id === 'new-dues' ? pending.promise : Promise.resolve(finance(id)));
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    await waitFor(() => expect(mocks.dues).toHaveBeenLastCalledWith('new-dues'));
    await act(async () => pending.resolve(finance('new-dues')));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actualiser' })).toBeEnabled());
    expect(await screen.findByText('FINANCE-new-dues')).toBeInTheDocument();
    expect(screen.queryByText('Chargement des droits…')).not.toBeInTheDocument();
  });
});
