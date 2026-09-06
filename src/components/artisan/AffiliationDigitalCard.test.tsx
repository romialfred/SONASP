import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AffiliationDigitalCard } from './AffiliationDigitalCard';
import { affiliationCountdown, type AffiliationCard } from '@/lib/affiliationCard';

const mocks = vi.hoisted(() => ({ signed: vi.fn(), download: vi.fn() }));
vi.mock('@/services/affiliationService', () => ({ affiliationService: { signedFile: mocks.signed, download: mocks.download } }));
export const cardFixture: AffiliationCard = {
  id: 'card-test', artisan_id: 'member-test', numero_carte: 'FS-TEST-1', numero_affiliation: 'FS-TEST', version: 1, template_version: 'faso-sanama-id1-v1',
  statut: 'en_exploitation', statut_effectif: 'active', snapshot: { nom: 'DOSSIER', prenoms: 'Test', role: 'exploitant', societe: null, titulaire_id: null, site_nom: 'Site nommé', commune: 'Commune', photo_reference: 'private/photo.png', numero_affiliation: 'FS-TEST' },
  validated_at: '2026-01-01', activated_at: '2026-01-01', valid_from: '2026-01-01', valid_until: '2026-12-31', jours_restants: 8, server_date: '2026-12-23',
  render_status: 'ready', render_revision: 2, recto_path: 'recto.png', verso_path: 'verso.png', pdf_path: 'card.pdf', verification_token: 'opaque', created_at: '2026-01-01', replaced_by: null,
};
describe('Carte numérique d’affiliation', () => {
  beforeEach(() => { mocks.signed.mockImplementation(async (path: string) => `/private/${path}`); mocks.download.mockResolvedValue(undefined); });
  it('bascule au clic et au clavier, avec une seule face accessible', async () => {
    render(<AffiliationDigitalCard card={cardFixture} />);
    const recto = await screen.findByRole('img', { name: /Recto de la carte/ });
    expect(recto).toHaveAttribute('aria-hidden', 'false');
    expect(screen.queryByRole('img', { name: /Verso de la carte/ })).not.toBeInTheDocument();
    const surface = screen.getAllByRole('button', { name: 'Voir le verso' })[0];
    fireEvent.click(surface);
    expect(screen.getByRole('img', { name: /Verso de la carte/ })).toHaveAttribute('aria-hidden', 'false');
    surface.focus(); await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('img', { name: /Recto de la carte/ })).toBeInTheDocument();
  });
  it('reprend les jours serveur sans recalcul depuis la date du navigateur', () => {
    render(<AffiliationDigitalCard card={cardFixture} />);
    expect(screen.getByText('8 jours restants')).toBeInTheDocument();
    expect(affiliationCountdown({ statut_effectif: 'active', jours_restants: 0 })).toBe('Expire aujourd’hui');
    expect(affiliationCountdown({ statut_effectif: 'inactive', jours_restants: 99 })).toBe('Activation en attente');
    expect(affiliationCountdown({ statut_effectif: 'expiree', jours_restants: -1 })).toBe('Expirée');
  });
  it('le téléchargement ne retourne pas la carte', async () => {
    render(<AffiliationDigitalCard card={cardFixture} />);
    await screen.findByRole('img', { name: /Recto de la carte/ });
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger le verso' }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalledWith('verso.png', expect.stringContaining('v1-r2-verso.png')));
    expect(screen.getByRole('img', { name: /Recto de la carte/ })).toBeInTheDocument();
  });
  it('ne propose aucun fichier ni compte à rebours fictif avant le rendu', () => {
    render(<AffiliationDigitalCard card={{ ...cardFixture, render_status: 'failed', statut_effectif: 'inactive', activated_at: null }} onRetry={vi.fn()} />);
    expect(screen.getByText('La génération a échoué')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Télécharger/ })).not.toBeInTheDocument();
    expect(screen.queryByText('8 jours restants')).not.toBeInTheDocument();
  });
  it('reprend un accès privé refusé sans générer une autre carte', async () => {
    mocks.signed.mockRejectedValueOnce(new Error('Expired'));
    render(<AffiliationDigitalCard card={cardFixture} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Recharger les fichiers' }));
    await screen.findByRole('img', { name: /Recto de la carte/ });
  });
});
