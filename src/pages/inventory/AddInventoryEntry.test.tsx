import { describe, expect, it } from 'vitest';
import { GRAMMES_PAR_ONCE } from './inventoryOverviewData';
import { SAISIE_VIDE, calculer, valider, type Expedition, type SaisieEntree } from './AddInventoryEntry';

const lot: Expedition = {
  id: 'e1',
  reference_number: 'EXP-2026-001',
  shipment_date: '2026-05-10',
  total_bullion_grams: 12_000,
  total_pure_gold_grams: 11_000,
  total_pure_gold_oz: 353.66,
  production_count: 4,
  mining_company_id: 'm1',
  refinerie: 'Rand Refinery',
};

const saisie = (over: Partial<SaisieEntree> = {}): SaisieEntree => ({
  ...SAISIE_VIDE,
  shipment_id: 'e1',
  weight_before_melting_grams: '12000',
  weight_after_melting_grams: '11800',
  fineness_percentage: '99.5',
  silver_percentage: '0.3',
  metal_retained_percentage: '98.5',
  ...over,
});

describe('calculer', () => {
  it('déduit l’or fin de la masse, du titre et du métal restitué', () => {
    const resultat = calculer(saisie(), lot);
    const attendu = (11_800 * 99.5 * 0.985) / 100;
    expect(resultat.orFinGrammes).toBeCloseTo(attendu, 6);
    expect(resultat.orFinOnces).toBeCloseTo(attendu / GRAMMES_PAR_ONCE, 6);
  });

  it('calcule les impuretés par complément à 100', () => {
    expect(calculer(saisie(), lot).impuretes).toBeCloseTo(0.2, 6);
  });

  it('n’annonce ni rendement ni impuretés sans saisie', () => {
    // Un rendement de 0 % sur une pesée vide se lirait comme une perte totale.
    const vide = calculer(SAISIE_VIDE, null);
    expect(vide.rendement).toBeNull();
    expect(vide.impuretes).toBeNull();
    expect(vide.ecartOnces).toBeNull();
  });

  it('mesure le rendement de fonte', () => {
    expect(calculer(saisie(), lot).rendement).toBeCloseTo((11_800 / 12_000) * 100, 6);
  });

  it('n’annonce aucun écart sans quantité attendue au lot', () => {
    expect(calculer(saisie(), { ...lot, total_pure_gold_oz: 0 }).ecartOnces).toBeNull();
    expect(calculer(saisie(), null).ecartPourcentage).toBeNull();
  });

  it('signe l’écart à l’expédition', () => {
    const resultat = calculer(saisie(), { ...lot, total_pure_gold_oz: 300 });
    expect(resultat.ecartOnces).not.toBeNull();
    expect(resultat.ecartOnces as number).toBeGreaterThan(0);
    expect(resultat.ecartPourcentage as number).toBeGreaterThan(0);
  });
});

describe('valider', () => {
  it('accepte une saisie complète', () => {
    expect(valider(saisie())).toBeNull();
  });

  it('exige une expédition et des pesées', () => {
    expect(valider(saisie({ shipment_id: '' }))).toMatch(/expédition/);
    expect(valider(saisie({ weight_before_melting_grams: '0' }))).toMatch(/avant fonte/);
    expect(valider(saisie({ weight_after_melting_grams: '' }))).toMatch(/après fonte/);
  });

  it('refuse une masse après fonte supérieure à la masse avant', () => {
    // La fonte ne crée pas de matière.
    expect(valider(saisie({ weight_after_melting_grams: '13000' }))).toMatch(/dépasser/);
  });

  it('borne les titres et refuse une somme supérieure à 100 %', () => {
    expect(valider(saisie({ fineness_percentage: '0' }))).toMatch(/titre en or/);
    expect(valider(saisie({ fineness_percentage: '101' }))).toMatch(/titre en or/);
    expect(valider(saisie({ silver_percentage: '5' }))).toMatch(/dépasse 100/);
    expect(valider(saisie({ metal_retained_percentage: '0' }))).toMatch(/restitué/);
  });
});
