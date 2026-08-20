import { describe, expect, it } from 'vitest';
import {
  AUTEUR_INCONNU,
  AUTEUR_SYSTEME,
  composerBarre,
  composerHistorique,
  type LigneHistoriqueBrute,
} from './productionDetailsData';

const ligne = (partiel: Partial<LigneHistoriqueBrute> & { id: string }): LigneHistoriqueBrute => ({
  entity_id: 'p1',
  old_status: 'prepared',
  new_status: 'ready_for_customs',
  changed_by: 'u1',
  changed_at: '2026-08-19T10:00:00Z',
  ...partiel,
});

describe('composerHistorique', () => {
  it('nomme l’auteur par son nom complet', () => {
    const historique = composerHistorique(
      [ligne({ id: 'h1' })],
      [{ id: 'u1', email: 'a@sonasp.bf', full_name: 'Salif OUEDRAOGO' }]
    );
    expect(historique[0].user_email).toBe('Salif OUEDRAOGO');
  });

  it('se rabat sur le courriel quand le nom manque', () => {
    const historique = composerHistorique([ligne({ id: 'h1' })], [{ id: 'u1', email: 'a@sonasp.bf' }]);
    expect(historique[0].user_email).toBe('a@sonasp.bf');
  });

  it('distingue un changement automatique d’un auteur introuvable', () => {
    // Confondre les deux effaçait la responsabilité de chaque modification.
    const historique = composerHistorique(
      [ligne({ id: 'h1', changed_by: null }), ligne({ id: 'h2', changed_by: 'disparu' })],
      []
    );
    expect(historique[0].user_email).toBe(AUTEUR_SYSTEME);
    expect(historique[1].user_email).toBe(AUTEUR_INCONNU);
  });

  it('reprend la description à défaut de note', () => {
    const historique = composerHistorique(
      [ligne({ id: 'h1', notes: null, action_description: 'Passage en douane' })],
      []
    );
    expect(historique[0].notes).toBe('Passage en douane');
  });

  it('tient sur un historique vide', () => {
    expect(composerHistorique([], [])).toEqual([]);
  });
});

describe('composerBarre', () => {
  it('répartit le doré entre or, argent et impuretés', () => {
    const composition = composerBarre(1_000, 87.5, 10);
    expect(composition.orGrammes).toBe(875);
    expect(composition.argentGrammes).toBe(100);
    expect(composition.impuretesPct).toBe(2.5);
    expect(composition.impuretesGrammes).toBe(25);
  });

  it('traite l’argent absent comme nul', () => {
    const composition = composerBarre(1_000, 90, null);
    expect(composition.argentGrammes).toBe(0);
    expect(composition.impuretesPct).toBe(10);
  });

  it('ne produit pas d’impuretés négatives sur un titre incohérent', () => {
    // Or 95 % + argent 10 % dépasse 100 : l'incohérence se lit dans les parts,
    // pas dans une impureté négative.
    const composition = composerBarre(1_000, 95, 10);
    expect(composition.impuretesPct).toBe(0);
    expect(composition.impuretesGrammes).toBe(0);
  });

  it('tient sur un doré absent', () => {
    const composition = composerBarre(0, 90, 5);
    expect(composition.orGrammes).toBe(0);
    expect(composition.impuretesGrammes).toBe(0);
  });
});
