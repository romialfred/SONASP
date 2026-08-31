import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { InternationalPaymentDetailView } from './InternationalPaymentDetailView';
import { paymentDetailFixture } from './internationalPaymentDetail.fixture';

function setup(detail = paymentDetailFixture(), onDownload = vi.fn().mockResolvedValue(undefined)) {
  const onRefresh = vi.fn();
  render(<MemoryRouter><InternationalPaymentDetailView detail={detail} onRefresh={onRefresh} onDownload={onDownload} /></MemoryRouter>);
  return { onDownload, onRefresh };
}
describe('Payment detail interactions', () => {
  it('displays the five tabs and real settlement totals, not screenshot amounts', () => {
    setup();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.getByText('Vente entièrement réglée')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /48,55 %/ })).toBeInTheDocument();
    expect(screen.queryByText(/Confirmé par la banque/)).not.toBeInTheDocument();
  });
  it('filters all upstream documents by stage and file name', () => {
    setup(); fireEvent.click(screen.getByRole('tab', { name: 'Documents 4' }));
    expect(screen.getAllByRole('article')).toHaveLength(4);
    fireEvent.change(screen.getByRole('combobox', { name: 'Étape du dossier' }), { target: { value: 'expedition' } });
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Bordereau d’expédition.pdf')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Rechercher un document' }), { target: { value: 'inconnu' } });
    expect(screen.getByText('Aucun document pour cette sélection.')).toBeInTheDocument();
  });
  it('exposes actual refinery and payment events in the full chronology', () => {
    setup(); fireEvent.click(screen.getByRole('tab', { name: 'Historique' }));
    expect(screen.getByText('Résultats de raffinage reçus')).toBeInTheDocument();
    expect(screen.getByText('Solde confirmé')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrer la chronologie' }), { target: { value: 'analyse' } });
    expect(screen.queryByText('Solde confirmé')).not.toBeInTheDocument();
  });
  it('keeps documents and filter state when returning to the tab', () => {
    setup(); fireEvent.click(screen.getByRole('tab', { name: 'Documents 4' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Rechercher un document' }), { target: { value: 'certificat' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Aperçu' })); fireEvent.click(screen.getByRole('tab', { name: 'Documents 4' }));
    expect(screen.getByRole('textbox', { name: 'Rechercher un document' })).toHaveValue('certificat');
  });
  it('supports keyboard tab navigation', () => {
    setup(); fireEvent.keyDown(screen.getByRole('tab', { name: 'Aperçu' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Détails du paiement' })).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: 'Détails du paiement' })).toBeInTheDocument();
  });
  it('downloads the current proof through the provided private handler', async () => {
    const { onDownload } = setup(); fireEvent.click(screen.getByRole('button', { name: 'Télécharger le justificatif' }));
    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ id: 'doc-proof' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Télécharger le justificatif' })).toBeEnabled());
  });
  it('reports document failures and never renders external links as downloadable files', async () => {
    const detail = paymentDetailFixture(); detail.dossier!.documents[1].chemin = 'https://evil.test/file.pdf';
    setup(detail, vi.fn().mockRejectedValue(new Error('RLS')));
    expect(screen.getByRole('button', { name: 'Télécharger Facture commerciale.pdf' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger le justificatif' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Le téléchargement a échoué');
  });
  it('does not show a success illustration for an unconfirmed payment or fabricate upstream data', () => {
    const detail = paymentDetailFixture(); detail.payment.status = 'processing'; detail.dossier = null; detail.unavailable = ['dossier'];
    setup(detail);
    expect(screen.getByRole('heading', { name: 'Rapprochement en attente' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Paiement confirmé' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Documents/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Le dossier documentaire n’a pas pu être chargé');
  });
  it('links the sale and all actual payments without granting write actions', () => {
    setup(); fireEvent.click(screen.getByRole('tab', { name: 'Détails du paiement' }));
    expect(within(screen.getByRole('region', { name: 'Versements de la vente' })).getAllByRole('link')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /approuver|confirmer le paiement/i })).not.toBeInTheDocument();
  });
  it('opens and closes the functional actions menu', () => {
    const { onRefresh } = setup(); fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByRole('link', { name: 'Voir la vente associée' })).toHaveAttribute('href', '/sales/sale-a');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('link', { name: 'Voir la vente associée' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actions' })); fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
  it('preserves dossier tax adjustments and credits without adding them again to the balance', () => {
    const detail = paymentDetailFixture();
    detail.dossier!.comptes = { taxes: [{ code: 'tva', devise: 'XOF', complement_du: 4000, trop_percu: 0, net: 4000 }], avoirs: [{ reference: 'AV-001', montant: 50, devise: 'USD', statut: 'emis' }] };
    setup(detail); fireEvent.click(screen.getByRole('tab', { name: 'Réconciliation' }));
    expect(screen.getByRole('region', { name: 'Ajustements fiscaux et avoirs du dossier' })).toHaveTextContent('AV-001');
    expect(screen.getByText('Vente entièrement réglée')).toBeInTheDocument();
  });
});
