import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AffiliationDossier } from './AffiliationDossier';
const mocks = vi.hoisted(() => ({ list: vi.fn(), dues: vi.fn(), history: vi.fn(), tariffs: vi.fn(), activate: vi.fn(), renderCard: vi.fn(), prepare: vi.fn(), review: vi.fn(), validate: vi.fn(), caps: [] as string[] }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'controller', is_active: true, capabilities: mocks.caps } }) }));
vi.mock('@/services/affiliationService', () => ({ affiliationService: { list: mocks.list, dues: mocks.dues, history: mocks.history, tariffs: mocks.tariffs, activate: mocks.activate, render: mocks.renderCard, prepare: mocks.prepare, reviewReceipt: mocks.review } }));
vi.mock('@/services/carteProfessionnelleService', () => ({ carteProfessionnelleService: { valider: mocks.validate } }));
vi.mock('./AffiliationDigitalCard', () => ({ AffiliationDigitalCard: () => <p>Carte numérique</p> }));
const card = { id: 'card', artisan_id: 'artisan', numero_affiliation: 'FS-TEST', version: 1, statut: 'validee', statut_effectif: 'inactive', snapshot: { role: 'exploitant' }, validated_at: '2026-01-01', activated_at: null, render_status: 'ready' };
const dues = { id: 'dues', carte_id: 'card', montant: 100, devise: 'XOF', statut: 'ouvert', debut: '2026-09-01', fin: '2027-08-31' };
describe('Dossier d’affiliation et activation', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.caps = ['artisan.cards.manage', 'artisan.membership.manage', 'artisan.membership.confirm', 'artisan.cards.activate'];
    mocks.list.mockResolvedValue([card]); mocks.history.mockResolvedValue([]); mocks.tariffs.mockResolvedValue([]);
    mocks.dues.mockResolvedValue({ droit: dues, encaissements: [{ id: 'receipt', montant: 100, statut: 'confirme', reference: 'RC-TEST', date_paiement: '2026-09-01', created_by: 'maker' }] });
    mocks.activate.mockResolvedValue({ ...card, statut_effectif: 'active' }); mocks.renderCard.mockResolvedValue(undefined); mocks.review.mockResolvedValue(undefined);
  });
  it('le chargement d’une carte payée ne déclenche aucune activation', async () => {
    render(<AffiliationDossier artisanId="artisan" />);
    await screen.findByText(/Je confirme l’activation/);
    expect(mocks.activate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Activer la carte' })).toBeDisabled();
  });
  it('exige la confirmation manuelle et empêche une double activation', async () => {
    render(<AffiliationDossier artisanId="artisan" />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Je confirme/ }));
    const button = screen.getByRole('button', { name: 'Activer la carte' });
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(mocks.activate).toHaveBeenCalledTimes(1));
    expect(mocks.activate).toHaveBeenCalledWith('card');
  });
  it('un paiement confirmé séparément ne déclenche pas l’activation', async () => {
    mocks.dues.mockResolvedValue({ droit: dues, encaissements: [{ id: 'receipt', montant: 100, statut: 'en_attente', reference: 'RC-TEST', created_by: 'maker', date_paiement: '2026-09-01' }] });
    render(<AffiliationDossier artisanId="artisan" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer le paiement' }));
    await waitFor(() => expect(mocks.review).toHaveBeenCalledWith('receipt', 'confirme'));
    expect(mocks.activate).not.toHaveBeenCalled();
  });
  it('le paiement partiel reste bloquant', async () => {
    mocks.dues.mockResolvedValue({ droit: dues, encaissements: [{ id: 'receipt', montant: 40, statut: 'confirme', reference: 'PARTIEL', date_paiement: '2026-09-01' }] });
    render(<AffiliationDossier artisanId="artisan" />);
    await screen.findByText('60 XOF');
    expect(screen.getByRole('button', { name: 'Activer la carte' })).toBeDisabled();
  });
  it('ne lit ni n’affiche les encaissements à un utilisateur sans habilitation financière', async () => {
    mocks.caps = []; render(<AffiliationDossier artisanId="artisan" />);
    await screen.findByText('Carte numérique');
    expect(mocks.dues).not.toHaveBeenCalled();
    expect(screen.queryByText('RC-TEST')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activer la carte' })).not.toBeInTheDocument();
  });
  it('distingue une activation réussie d’un échec du rendu définitif', async () => {
    mocks.renderCard.mockRejectedValue(new Error('renderer unavailable'));
    render(<AffiliationDossier artisanId="artisan" />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Je confirme/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Activer la carte' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('L’activation est enregistrée');
    expect(mocks.activate).toHaveBeenCalledTimes(1);
  });
});
