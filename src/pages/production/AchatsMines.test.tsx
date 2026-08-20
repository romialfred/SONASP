import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AchatsMines, { fcfa, onces, periodeMoisPrecedent } from './AchatsMines';

const mocks = vi.hoisted(() => ({
  stocksParSociete: vi.fn(),
  lister: vi.fn(),
  creer: vi.fn(),
  changerStatut: vi.fn(),
  prixGrammeFcfa: { valeur: 45_000 as number | null },
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/useCoursOr', () => ({
  useCoursOr: () => ({ prixGrammeFcfa: mocks.prixGrammeFcfa.valeur }),
}));

vi.mock('@/services/achatMineService', async () => {
  const reel = await vi.importActual<typeof import('@/services/achatMineService')>('@/services/achatMineService');
  return {
    ...reel,
    achatMineService: {
      stocksParSociete: mocks.stocksParSociete,
      lister: mocks.lister,
      creer: mocks.creer,
      changerStatut: mocks.changerStatut,
    },
  };
});

const stock = {
  mining_company_id: 'm1',
  nom: 'SEMAFO Boungou Gold Mine',
  produitOz: 1_000,
  acheteOz: 200,
  disponibleOz: 800,
  declarations: 12,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prixGrammeFcfa.valeur = 45_000;
  mocks.stocksParSociete.mockResolvedValue([stock]);
  mocks.lister.mockResolvedValue([]);
  mocks.creer.mockResolvedValue({ id: 'a1' });
  mocks.changerStatut.mockResolvedValue({ id: 'a1' });
});

describe('périodeMoisPrecedent', () => {
  it('retient le mois écoulé, bornes comprises', () => {
    expect(periodeMoisPrecedent(new Date(2026, 7, 19))).toEqual({ debut: '2026-07-01', fin: '2026-07-31' });
  });

  it('franchit le changement d’année', () => {
    expect(periodeMoisPrecedent(new Date(2026, 0, 5))).toEqual({ debut: '2025-12-01', fin: '2025-12-31' });
  });
});

describe('formats', () => {
  it('n’affiche pas de décimale sur les francs', () => {
    expect(fcfa(1234.6)).toMatch(/1\s?235 FCFA/);
  });

  it('affiche les onces au centième', () => {
    expect(onces(12.345)).toMatch(/12,35 oz/);
  });
});

describe('AchatsMines', () => {
  it('affiche le stock déclaré par chaque société', async () => {
    render(<AchatsMines />);
    expect(await screen.findByText('SEMAFO Boungou Gold Mine')).toBeInTheDocument();
    expect(mocks.stocksParSociete).toHaveBeenCalledWith(
      periodeMoisPrecedent().debut,
      periodeMoisPrecedent().fin
    );
  });

  it('nomme la source quand le chargement échoue, sans inventer de chiffres', async () => {
    mocks.stocksParSociete.mockRejectedValue({ message: 'réseau indisponible' });
    render(<AchatsMines />);
    expect(await screen.findByText(/Impossible de charger|réseau indisponible/)).toBeInTheDocument();
    expect(screen.queryByText('SEMAFO Boungou Gold Mine')).not.toBeInTheDocument();
  });

  it('enregistre un achat au prix du marché et recharge la liste', async () => {
    render(<AchatsMines />);
    await screen.findByText('SEMAFO Boungou Gold Mine');

    fireEvent.click(screen.getByRole('button', { name: /Nouvel achat/ }));
    fireEvent.change(screen.getByLabelText(/Société minière/), { target: { value: 'm1' } });
    fireEvent.change(screen.getByLabelText(/Quantité achetée/), { target: { value: '100' } });

    // Le prix à l'once découle du cours du gramme : 45 000 × 31,1034768.
    const prix = screen.getByLabelText(/Prix à l’once/) as HTMLInputElement;
    await waitFor(() => expect(Number(prix.value)).toBe(Math.round(45_000 * 31.1034768)));

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));

    await waitFor(() => expect(mocks.creer).toHaveBeenCalledTimes(1));
    const envoye = mocks.creer.mock.calls[0][0];
    expect(envoye).toMatchObject({ mining_company_id: 'm1', quantite_oz: 100, statut: 'en_attente' });
    expect(envoye.montant_total_fcfa).toBeGreaterThan(envoye.montant_brut_fcfa);
    expect(mocks.stocksParSociete).toHaveBeenCalledTimes(2);
  });

  it('refuse un achat supérieur au stock disponible', async () => {
    render(<AchatsMines />);
    await screen.findByText('SEMAFO Boungou Gold Mine');

    fireEvent.click(screen.getByRole('button', { name: /Nouvel achat/ }));
    fireEvent.change(screen.getByLabelText(/Société minière/), { target: { value: 'm1' } });
    fireEvent.change(screen.getByLabelText(/Quantité achetée/), { target: { value: '900' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));

    await waitFor(() => expect(screen.getByText(/dépasse le stock disponible/)).toBeInTheDocument());
    expect(mocks.creer).not.toHaveBeenCalled();
  });

  it('reporte tout le stock disponible dans la quantité', async () => {
    render(<AchatsMines />);
    await screen.findByText('SEMAFO Boungou Gold Mine');

    fireEvent.click(screen.getByRole('button', { name: /Nouvel achat/ }));
    fireEvent.change(screen.getByLabelText(/Société minière/), { target: { value: 'm1' } });
    fireEvent.click(screen.getByRole('button', { name: /Acheter tout le stock/ }));

    expect((screen.getByLabelText(/Quantité achetée/) as HTMLInputElement).value).toBe('800');
  });

  it('laisse le prix vide quand le cours n’est pas connu, plutôt que d’en inventer un', async () => {
    mocks.prixGrammeFcfa.valeur = null;
    render(<AchatsMines />);
    await screen.findByText('SEMAFO Boungou Gold Mine');

    fireEvent.click(screen.getByRole('button', { name: /Nouvel achat/ }));
    expect((screen.getByLabelText(/Prix à l’once/) as HTMLInputElement).value).toBe('');
  });
});
