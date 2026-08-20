import { describe, expect, it } from 'vitest';
import {
  bornesPeriodes,
  cumulerObjectif,
  dernieresRevisions,
  ecartAuBut,
  joursParMois,
  libelleMois,
  realiseSur,
  type LigneObjectif,
} from './productionInSafeData';

describe('bornesPeriodes', () => {
  it('arrête les trois périodes au jour dit', () => {
    // Jeudi 20 août 2026.
    const bornes = bornesPeriodes(new Date(2026, 7, 20));
    expect(bornes.semaine).toEqual({ debut: '2026-08-17', fin: '2026-08-20' }); // lundi
    expect(bornes.mois).toEqual({ debut: '2026-08-01', fin: '2026-08-20' });
    expect(bornes.annee).toEqual({ debut: '2026-01-01', fin: '2026-08-20' });
  });

  it('fait commencer la semaine le lundi, dimanche compris', () => {
    // Dimanche 23 août 2026 : la semaine a commencé le 17.
    expect(bornesPeriodes(new Date(2026, 7, 23)).semaine.debut).toBe('2026-08-17');
  });

  it('remonte au mois précédent quand la semaine est à cheval', () => {
    // Mardi 1er septembre 2026 : semaine ouverte le lundi 31 août.
    expect(bornesPeriodes(new Date(2026, 8, 1)).semaine.debut).toBe('2026-08-31');
  });
});

describe('joursParMois', () => {
  it('compte les jours de chaque mois traversé', () => {
    const jours = joursParMois({ debut: '2026-07-30', fin: '2026-08-02' });
    expect(jours.get('2026-07')).toBe(2);
    expect(jours.get('2026-08')).toBe(2);
  });

  it('rend une période vide pour des bornes inversées', () => {
    expect(joursParMois({ debut: '2026-08-10', fin: '2026-08-01' }).size).toBe(0);
  });
});

const ligne = (partiel: Partial<LigneObjectif> & { month: number; dailyOz: number }): LigneObjectif => ({
  year: 2026,
  ...partiel,
});

describe('cumulerObjectif', () => {
  it('cumule au prorata des jours', () => {
    const objectif = cumulerObjectif([ligne({ month: 8, dailyOz: 100 })], { debut: '2026-08-01', fin: '2026-08-10' });
    expect(objectif.totalOz).toBe(1_000);
    expect(objectif.complet).toBe(true);
  });

  it('additionne les rythmes de chaque société', () => {
    const objectif = cumulerObjectif(
      [ligne({ month: 8, dailyOz: 100, mining_company_id: 'a' }), ligne({ month: 8, dailyOz: 50, mining_company_id: 'b' })],
      { debut: '2026-08-01', fin: '2026-08-02' }
    );
    expect(objectif.totalOz).toBe(300);
  });

  it('applique le rythme propre à chaque mois d’une période à cheval', () => {
    const objectif = cumulerObjectif(
      [ligne({ month: 7, dailyOz: 10 }), ligne({ month: 8, dailyOz: 100 })],
      { debut: '2026-07-30', fin: '2026-08-02' }
    );
    expect(objectif.totalOz).toBe(2 * 10 + 2 * 100);
  });

  it('nomme un mois sans objectif au lieu de le compter pour zéro', () => {
    // Sans cela, un objectif partiel se lirait comme un objectif atteint.
    const objectif = cumulerObjectif([ligne({ month: 8, dailyOz: 100 })], { debut: '2026-07-30', fin: '2026-08-02' });
    expect(objectif.moisManquants).toEqual(['2026-07']);
    expect(objectif.complet).toBe(false);
    expect(objectif.totalOz).toBe(200);
  });

  it('rend un objectif incomplet quand aucune ligne n’existe', () => {
    const objectif = cumulerObjectif([], { debut: '2026-08-01', fin: '2026-08-03' });
    expect(objectif.totalOz).toBe(0);
    expect(objectif.complet).toBe(false);
  });

  it('distingue deux années de même mois', () => {
    const objectif = cumulerObjectif(
      [ligne({ month: 1, dailyOz: 100, year: 2025 })],
      { debut: '2026-01-01', fin: '2026-01-05' }
    );
    expect(objectif.complet).toBe(false);
  });
});

describe('dernieresRevisions', () => {
  it('ne retient que la révision la plus récente d’un même mois', () => {
    const retenues = dernieresRevisions([
      ligne({ month: 8, dailyOz: 100, revision: '2026-04-01' }),
      ligne({ month: 8, dailyOz: 130, revision: '2026-07-01' }),
    ]);
    expect(retenues).toHaveLength(1);
    expect(retenues[0].dailyOz).toBe(130);
  });

  it('garde les mois et sociétés distincts', () => {
    const retenues = dernieresRevisions([
      ligne({ month: 8, dailyOz: 100, mining_company_id: 'a' }),
      ligne({ month: 8, dailyOz: 50, mining_company_id: 'b' }),
      ligne({ month: 9, dailyOz: 70, mining_company_id: 'a' }),
    ]);
    expect(retenues).toHaveLength(3);
  });
});

describe('realiseSur', () => {
  const productions = [
    { production_date: '2026-08-01', estimated_oz: 10 },
    { production_date: '2026-08-15', estimated_oz: 20 },
    { production_date: '2026-09-01', estimated_oz: 999 },
  ];

  it('ne retient que les jours de la période, bornes comprises', () => {
    expect(realiseSur(productions, { debut: '2026-08-01', fin: '2026-08-15' })).toBe(30);
  });

  it('tolère une once absente', () => {
    expect(realiseSur([{ production_date: '2026-08-01', estimated_oz: null }], { debut: '2026-08-01', fin: '2026-08-31' })).toBe(0);
  });
});

describe('ecartAuBut', () => {
  it('mesure le dépassement', () => {
    const ecart = ecartAuBut(120, { totalOz: 100, moisManquants: [], complet: true });
    expect(ecart).toEqual({ ecartOz: 20, pourcentage: 20, atteint: true });
  });

  it('mesure le retard', () => {
    expect(ecartAuBut(80, { totalOz: 100, moisManquants: [], complet: true })?.atteint).toBe(false);
  });

  it('ne juge pas sur un objectif incomplet', () => {
    // Un écart calculé sur un objectif partiel accuserait à tort.
    expect(ecartAuBut(80, { totalOz: 100, moisManquants: ['2026-07'], complet: false })).toBeNull();
  });

  it('ne divise pas par un objectif nul', () => {
    expect(ecartAuBut(80, { totalOz: 0, moisManquants: [], complet: true })).toBeNull();
  });
});

describe('libelleMois', () => {
  it('écrit le mois en clair', () => {
    expect(libelleMois('2026-03')).toBe('mars 2026');
  });

  it('rend la clé telle quelle si elle est illisible', () => {
    expect(libelleMois('bizarre')).toBe('bizarre');
  });
});
