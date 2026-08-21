import { describe, expect, it } from 'vitest';
import {
  ecartEnPoints,
  ETATS_A_TRAITER,
  LIBELLES_DECISION,
  LIBELLES_ORIGINE,
  LIBELLES_STATUT_ANALYSE,
  TONS_STATUT_ANALYSE,
  type DecisionTeneur,
  type OrigineResultat,
  type StatutAnalyse,
} from './analysesTeneurService';
import { formaterEcart } from '@/components/contrats/AnalysesTeneur';

describe('écart d’un résultat à la déclaration', () => {
  it('garde le signe : au-dessus ou en dessous n’appelle pas la même conversation', () => {
    expect(ecartEnPoints(89, 90)).toBe(-1);
    expect(ecartEnPoints(90.5, 90)).toBe(0.5);
  });

  it('arrondit au millième, comme la base stocke la teneur', () => {
    expect(ecartEnPoints(89.4004, 90)).toBe(-0.6);
    expect(ecartEnPoints(89.3335, 89)).toBe(0.334);
  });

  it('affiche le signe même quand l’écart est favorable', () => {
    expect(formaterEcart(0.5)).toBe('+0.500 pt');
    expect(formaterEcart(-1)).toBe('-1.000 pt');
  });
});

describe('référentiels de l’analyse', () => {
  it('nomme les sept états en français, avec leur ton', () => {
    const etats: StatutAnalyse[] = [
      'en_attente', 'analysee', 'contre_analyse_requise',
      'laboratoire_independant_requis', 'tranchee', 'non_conforme', 'annulee',
    ];
    etats.forEach((etat) => {
      expect(LIBELLES_STATUT_ANALYSE[etat]).toBeTruthy();
      expect(TONS_STATUT_ANALYSE[etat]).toBeTruthy();
    });
  });

  it('distingue les quatre origines d’un résultat', () => {
    const origines: OrigineResultat[] = [
      'analyse_initiale', 'contre_analyse', 'laboratoire_independant', 'arbitrage',
    ];
    expect(Object.keys(LIBELLES_ORIGINE).sort()).toEqual([...origines].sort());
  });

  it('nomme les quatre décisions du moteur de teneur', () => {
    const decisions: DecisionTeneur[] = [
      'acceptee', 'contre_analyse', 'laboratoire_independant', 'non_conformite',
    ];
    expect(Object.keys(LIBELLES_DECISION).sort()).toEqual([...decisions].sort());
  });

  it('tient pour à traiter tout ce qui n’est ni tranché ni annulé', () => {
    // Un lot analysé mais non tranché bloque la facturation : il ne se laisse
    // pas oublier.
    expect(ETATS_A_TRAITER).not.toContain('tranchee');
    expect(ETATS_A_TRAITER).not.toContain('annulee');
    expect(ETATS_A_TRAITER).toContain('analysee');
    expect(ETATS_A_TRAITER).toContain('non_conforme');
  });
});
