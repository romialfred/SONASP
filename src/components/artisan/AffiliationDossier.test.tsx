import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AffiliationDossier } from './AffiliationDossier';
const mocks = vi.hoisted(() => ({ list: vi.fn(), dues: vi.fn(), history: vi.fn(), tariffs: vi.fn(), activate: vi.fn(), renderCard: vi.fn(), prepare: vi.fn(), review: vi.fn(), record: vi.fn(), validate: vi.fn(), caps: [] as string[] }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'controller', is_active: true, capabilities: mocks.caps } }) }));
vi.mock('@/services/affiliationService', () => ({ affiliationService: { list: mocks.list, dues: mocks.dues, history: mocks.history, tariffs: mocks.tariffs, activate: mocks.activate, render: mocks.renderCard, prepare: mocks.prepare, reviewReceipt: mocks.review, recordReceipt: mocks.record } }));
vi.mock('@/services/carteProfessionnelleService', () => ({ carteProfessionnelleService: { valider: mocks.validate } }));
vi.mock('./AffiliationDigitalCard', () => ({ AffiliationDigitalCard: ({ onRetry, busy }: { onRetry?: () => void; busy?: boolean }) => <><p>Carte numérique</p>{onRetry && <button disabled={busy} onClick={onRetry}>Générer les deux faces</button>}</> }));
const card = { id: 'card', artisan_id: 'artisan', numero_affiliation: 'FS-TEST', version: 1, statut: 'validee', statut_effectif: 'inactive', snapshot: { role: 'exploitant' }, validated_at: '2026-01-01', activated_at: null, render_status: 'ready' };
const dues = { id: 'dues', carte_id: 'card', montant: 100, devise: 'XOF', statut: 'ouvert', debut: '2026-09-01', fin: '2027-08-31' };
describe('Dossier d’affiliation et activation', () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.caps = ['artisan.cards.manage', 'artisan.membership.manage', 'artisan.membership.confirm', 'artisan.cards.activate'];
    mocks.list.mockResolvedValue([card]); mocks.history.mockResolvedValue([]); mocks.tariffs.mockResolvedValue([]);
    mocks.dues.mockResolvedValue({ droit: dues, encaissements: [{ id: 'receipt', montant: 100, statut: 'confirme', reference: 'RC-TEST', date_paiement: '2026-09-01', created_by: 'maker' }] });
    mocks.activate.mockResolvedValue({ ...card, statut_effectif: 'active' }); mocks.renderCard.mockResolvedValue(undefined); mocks.review.mockResolvedValue(undefined);
  });
  it('ne présente pas une lecture initiale échouée comme une absence de dossier', async () => {
    mocks.list.mockRejectedValueOnce(new Error('lecture indisponible'));
    render(<MemoryRouter><AffiliationDossier artisanId="artisan" /></MemoryRouter>);
    await screen.findByRole('alert');
    expect(screen.queryByText('Aucun dossier d’affiliation disponible')).not.toBeInTheDocument();
    expect(screen.queryByText('Enregistrez d’abord le dossier de l’artisan.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await screen.findByText('Carte numérique');
  });
  it('ne confirme pas une actualisation si la liste des cartes est inaccessible', async () => {
    render(<MemoryRouter><AffiliationDossier artisanId="artisan" /></MemoryRouter>);
    await screen.findByText('RC-TEST');
    mocks.list.mockRejectedValueOnce(new Error('lecture indisponible'));
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    await screen.findByRole('alert');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actualiser' })).toBeEnabled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activer la carte' })).toBeDisabled();
  });
  it('ne confirme pas une actualisation si la relecture des droits échoue', async () => {
    render(<MemoryRouter><AffiliationDossier artisanId="artisan" /></MemoryRouter>);
    await screen.findByText('RC-TEST');
    mocks.dues.mockRejectedValueOnce(new Error('droits indisponibles'));
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    await screen.findAllByRole('alert');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actualiser' })).toBeEnabled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText('Aucune opération tracée pour cette émission.')).not.toBeInTheDocument();
  });
  it('distingue une action enregistrée de sa relecture échouée et reprend sans la rejouer', async () => {
    render(<MemoryRouter><AffiliationDossier artisanId="artisan" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Je confirme/ }));
    mocks.list.mockRejectedValueOnce(new Error('lecture indisponible'));
    fireEvent.click(screen.getByRole('button', { name: 'Activer la carte' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('L’opération est enregistrée');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(mocks.activate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Statut actualisé');
    expect(mocks.activate).toHaveBeenCalledTimes(1);
    expect(mocks.renderCard).toHaveBeenCalledTimes(1);
  });
  it('relit les droits liés à la carte retournée par la dernière actualisation', async () => {
    render(<MemoryRouter><AffiliationDossier artisanId="artisan" /></MemoryRouter>);
    await screen.findByText('RC-TEST');
    mocks.list.mockResolvedValue([{ ...card, dues_card_id: 'renewed-dues-card' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    await screen.findByRole('status');
    expect(mocks.dues).toHaveBeenLastCalledWith('renewed-dues-card');
  });
  it('le chargement d’une carte payée ne déclenche aucune activation', async () => {
    render(<MemoryRouter><AffiliationDossier artisanId="artisan" /></MemoryRouter>);
    await screen.findByText(/Je confirme l’activation/);
    expect(mocks.activate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Activer la carte' })).toBeDisabled();
    for (const name of ['Identité du titulaire', 'Site de rattachement', 'Informations de la carte']) {
      const completedCheck = screen.getByRole('checkbox', { name });
      expect(completedCheck).toBeChecked();
      expect(completedCheck).toBeDisabled();
    }
  });
  it('exige la confirmation manuelle et empêche une double activation', async () => {
    render(<MemoryRouter><AffiliationDossier artisanId="artisan" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Je confirme/ }));
    const button = screen.getByRole('button', { name: 'Activer la carte' });
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(mocks.activate).toHaveBeenCalledTimes(1));
    expect(mocks.activate).toHaveBeenCalledWith('card');
  });
  it('un paiement confirmé séparément ne déclenche pas l’activation', async () => {
    mocks.dues.mockResolvedValue({ droit: dues, encaissements: [{ id: 'receipt', montant: 100, statut: 'en_attente', reference: 'RC-TEST', created_by: 'maker', date_paiement: '2026-09-01' }] });
    render(<MemoryRouter><AffiliationDossier artisanId="artisan" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer le paiement' }));
    await waitFor(() => expect(mocks.review).toHaveBeenCalledWith('receipt', 'confirme'));
    expect(mocks.activate).not.toHaveBeenCalled();
  });
  it('le paiement partiel reste bloquant', async () => {
    mocks.dues.mockResolvedValue({ droit: dues, encaissements: [{ id: 'receipt', montant: 40, statut: 'confirme', reference: 'PARTIEL', date_paiement: '2026-09-01' }] });
    render(<MemoryRouter><AffiliationDossier artisanId="artisan" /></MemoryRouter>);
    await screen.findByText('60 FCFA');
    expect(screen.getByRole('button', { name: 'Activer la carte' })).toBeDisabled();
  });
  it('ne lit ni n’affiche les encaissements à un utilisateur sans habilitation financière', async () => {
    mocks.caps = []; render(<MemoryRouter><AffiliationDossier artisanId="artisan" /></MemoryRouter>);
    await screen.findByText('Carte numérique');
    expect(mocks.dues).not.toHaveBeenCalled();
    expect(screen.queryByText('RC-TEST')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activer la carte' })).not.toBeInTheDocument();
  });
  it('distingue une activation réussie d’un échec du rendu définitif', async () => {
    mocks.renderCard.mockRejectedValue(new Error('renderer unavailable'));
    render(<MemoryRouter><AffiliationDossier artisanId="artisan" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Je confirme/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Activer la carte' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('L’activation est enregistrée');
    expect(mocks.activate).toHaveBeenCalledTimes(1);
  });
  it('génère après confirmation intégrale et attend toujours la validation et l’activation manuelles', async () => {
    let confirmed = false;
    mocks.list.mockImplementation(async () => [{ ...card, statut: 'en_cours', validated_at: null, render_status: 'pending', adhesion_status: confirmed ? 'paye' : 'en_attente' }]);
    mocks.dues.mockImplementation(async () => ({ droit: dues, encaissements: [{ id: 'receipt', montant: 100, statut: confirmed ? 'confirme' : 'en_attente', reference: 'RC-TEST', created_by: 'maker', date_paiement: '2026-09-01' }] }));
    mocks.review.mockImplementation(async () => { confirmed = true; });
    render(<MemoryRouter><AffiliationDossier artisanId="artisan" /></MemoryRouter>);
    const confirmButton = await screen.findByRole('button', { name: 'Confirmer le paiement' });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);
    await screen.findByRole('status');
    expect(mocks.review).toHaveBeenCalledTimes(1);
    expect(mocks.review).toHaveBeenCalledWith('receipt', 'confirme');
    expect(mocks.renderCard).toHaveBeenCalledTimes(1);
    expect(mocks.renderCard).toHaveBeenCalledWith('card');
    expect(mocks.review.mock.invocationCallOrder[0]).toBeLessThan(mocks.renderCard.mock.invocationCallOrder[0]);
    expect(mocks.validate).not.toHaveBeenCalled();
    expect(mocks.activate).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Activer la carte' })).toBeDisabled();
  });
  it('ne génère pas lorsqu’un encaissement confirmé ne couvre qu’une partie des droits', async () => {
    let confirmed = false;
    mocks.list.mockImplementation(async () => [{ ...card, statut: 'en_cours', validated_at: null, render_status: 'pending', adhesion_status: confirmed ? 'partiel' : 'en_attente' }]);
    mocks.dues.mockImplementation(async () => ({ droit: dues, encaissements: [{ id: 'partial', montant: 40, statut: confirmed ? 'confirme' : 'en_attente', reference: 'PARTIEL', created_by: 'maker', date_paiement: '2026-09-01' }] }));
    mocks.review.mockImplementation(async () => { confirmed = true; });
    render(<MemoryRouter><AffiliationDossier artisanId="artisan" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer le paiement' }));
    await screen.findByRole('status');
    expect(mocks.review).toHaveBeenCalledWith('partial', 'confirme');
    expect(mocks.renderCard).not.toHaveBeenCalled();
    expect(mocks.activate).not.toHaveBeenCalled();
    expect(screen.getByText('60 FCFA')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Générer les deux faces' })).not.toBeInTheDocument();
  });
  it('reprend seulement le rendu après un paiement confirmé dont la génération échoue', async () => {
    let confirmed = false;
    mocks.list.mockImplementation(async () => [{ ...card, statut: 'en_cours', validated_at: null, render_status: 'pending', adhesion_status: confirmed ? 'paye' : 'en_attente' }]);
    mocks.dues.mockImplementation(async () => ({ droit: dues, encaissements: [{ id: 'receipt', montant: 100, statut: confirmed ? 'confirme' : 'en_attente', reference: 'RC-TEST', created_by: 'maker', date_paiement: '2026-09-01' }] }));
    mocks.review.mockImplementation(async () => { confirmed = true; });
    mocks.renderCard.mockRejectedValueOnce(new Error('renderer unavailable')).mockResolvedValue(undefined);
    render(<MemoryRouter><AffiliationDossier artisanId="artisan" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer le paiement' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Le paiement est confirmé');
    expect(alert).toHaveTextContent('sans enregistrer un autre paiement');
    expect(screen.queryByRole('button', { name: 'Confirmer le paiement' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer un paiement' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Générer les deux faces' }));
    await screen.findByRole('status');
    expect(mocks.renderCard).toHaveBeenCalledTimes(2);
    expect(mocks.review).toHaveBeenCalledTimes(1);
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.activate).not.toHaveBeenCalled();
  });
});
