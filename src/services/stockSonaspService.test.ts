import { describe, expect, it } from 'vitest';
import { calculerStockSonasp } from './stockSonaspService';
import { GRAMMES_PAR_ONCE } from './achatMineService';

describe('calculerStockSonasp', () => {
  it('additionne les deux filières d’achat', () => {
    const stock = calculerStockSonasp(
      [{ quantite_oz: 100, statut: 'validee' }],
      [{ quantite_grammes: GRAMMES_PAR_ONCE * 10, statut: 'validee' }],
      []
    );
    expect(stock.achatMinesOz).toBe(100);
    expect(stock.achatArtisansOz).toBeCloseTo(10, 3);
    expect(stock.entreesOz).toBeCloseTo(110, 3);
    expect(stock.disponibleOz).toBeCloseTo(110, 3);
  });

  it('retranche les ventes déjà conclues à l’international', () => {
    const stock = calculerStockSonasp(
      [{ quantite_oz: 500, statut: 'payee' }],
      [],
      [{ quantity_oz: 200, status: 'completed' }, { quantity_oz: 50, status: 'pending_management_approval' }]
    );
    expect(stock.venduOz).toBe(250);
    expect(stock.disponibleOz).toBe(250);
  });

  it('ignore ce qui n’est pas acquis : achat annulé, vente artisanale en attente, vente annulée', () => {
    const stock = calculerStockSonasp(
      [{ quantite_oz: 100, statut: 'annulee' }],
      [{ quantite_grammes: 1_000, statut: 'en_attente' }],
      [{ quantity_oz: 10, status: 'cancelled' }]
    );
    expect(stock.entreesOz).toBe(0);
    expect(stock.venduOz).toBe(0);
    expect(stock.disponibleOz).toBe(0);
  });

  it('n’exporte ni un achat minier en attente ni l’or affecté à la réserve nationale', () => {
    const stock = calculerStockSonasp(
      [
        { quantite_oz: 100, statut: 'en_attente' },
        { quantite_oz: 80, statut: 'validee' },
      ],
      [],
      [],
      [],
      [{ quantity_national_reserve_oz: 25 }],
    );
    expect(stock.achatMinesOz).toBe(80);
    expect(stock.reserveNationaleOz).toBe(25);
    expect(stock.disponibleOz).toBe(55);
  });

  it('signale le découvert au lieu d’afficher un stock négatif', () => {
    // Vendre plus qu'on n'a acheté est une anomalie : elle doit se voir.
    const stock = calculerStockSonasp([], [], [{ quantity_oz: 30, status: 'sold' }]);
    expect(stock.disponibleOz).toBe(0);
    expect(stock.decouvert).toBe(true);
  });

  it('ne signale aucun découvert sur un stock équilibré', () => {
    const stock = calculerStockSonasp([{ quantite_oz: 30, statut: 'validee' }], [], [{ quantity_oz: 30, status: 'sold' }]);
    expect(stock.disponibleOz).toBe(0);
    expect(stock.decouvert).toBe(false);
  });

  it('convertit le disponible en grammes', () => {
    const stock = calculerStockSonasp([{ quantite_oz: 2, statut: 'validee' }], [], []);
    expect(stock.disponibleGrammes).toBeCloseTo(2 * GRAMMES_PAR_ONCE, 2);
  });

  it('tient sur des sources vides', () => {
    const stock = calculerStockSonasp([], [], []);
    expect(stock).toMatchObject({ entreesOz: 0, venduOz: 0, disponibleOz: 0, decouvert: false });
  });

  it('compte les cessions comptoirs acceptées ou payées, pas les autres', () => {
    // La vente des comptoirs à la SONASP est obligatoire : l'or cédé entre au
    // bilan matière dès l'acceptation, payé ou non.
    const stock = calculerStockSonasp(
      [],
      [],
      [],
      [
        { quantity_grams: GRAMMES_PAR_ONCE * 5, status: 'accepted' },
        { quantity_grams: GRAMMES_PAR_ONCE * 3, status: 'paid' },
        { quantity_grams: GRAMMES_PAR_ONCE * 100, status: 'submitted' },
        { quantity_grams: GRAMMES_PAR_ONCE * 100, status: 'rejected' },
        { quantity_grams: GRAMMES_PAR_ONCE * 100, status: 'cancelled' },
      ]
    );
    expect(stock.cessionComptoirsOz).toBeCloseTo(8, 3);
    expect(stock.entreesOz).toBeCloseTo(8, 3);
    expect(stock.disponibleOz).toBeCloseTo(8, 3);
  });
});
