import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveGoldMarketPanel } from './LiveGoldMarketPanel';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  clear: vi.fn(),
}));

vi.mock('@/services/liveGoldPriceService', () => ({
  clearPriceCache: mocks.clear,
  fetchLiveGoldPrice: mocks.fetch,
  formatGoldPrice: (value: number, digits = 2) => value.toFixed(digits).replace('.', ','),
  getMarketStatus: () => ({
    london: { isOpen: true, openTime: '', closeTime: '' },
    newYork: { isOpen: false, openTime: '', closeTime: '' },
  }),
}));

const price = {
  price: 2_848.87,
  timestamp: Date.parse('2026-09-04T16:58:37Z'),
  source: 'Référentiel SONASP',
  currency: 'USD',
  change24h: 11.87,
  changePercent24h: 0.42,
  openPrice: 2_837,
  high24h: 2_855.87,
  low24h: 2_839.87,
};

describe('LiveGoldMarketPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('est fermé par défaut et expose un déclencheur accessible', () => {
    render(<LiveGoldMarketPanel initialGoldPrice={price} />);
    const trigger = screen.getByRole('button', { name: 'Afficher le cours de l’or' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('live-gold-market-panel')).toHaveAttribute('aria-hidden', 'true');
  });

  it('s’ouvre puis se ferme avec le bouton de fermeture en restaurant le focus', async () => {
    const user = userEvent.setup();
    render(<LiveGoldMarketPanel initialGoldPrice={price} />);
    const trigger = screen.getByRole('button', { name: 'Afficher le cours de l’or' });
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Fermer le volet du cours de l’or' }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('se ferme avec Échap', async () => {
    const user = userEvent.setup();
    render(<LiveGoldMarketPanel initialGoldPrice={price} />);
    const trigger = screen.getByRole('button', { name: 'Afficher le cours de l’or' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('se ferme lors d’un clic extérieur', async () => {
    const user = userEvent.setup();
    render(<div><LiveGoldMarketPanel initialGoldPrice={price} /><button type="button">Extérieur</button></div>);
    const trigger = screen.getByRole('button', { name: 'Afficher le cours de l’or' });
    await user.click(trigger);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Extérieur' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('reste ouvert pendant un rafraîchissement', async () => {
    const user = userEvent.setup();
    let resolve!: (value: typeof price) => void;
    mocks.fetch.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<LiveGoldMarketPanel initialGoldPrice={price} />);
    const trigger = screen.getByRole('button', { name: 'Afficher le cours de l’or' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Actualiser le cours' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    resolve(price);
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
  });

  it('présente une erreur contrôlée et permet de relancer', async () => {
    mocks.fetch.mockResolvedValue(null);
    render(<LiveGoldMarketPanel />);
    expect(await screen.findByText('Cours indisponible')).toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Afficher le cours de l’or' });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
});
