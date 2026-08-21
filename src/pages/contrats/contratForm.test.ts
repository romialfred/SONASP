import { describe, expect, it } from 'vitest';
import { dureeEnMois, nombrePeriodes } from './ContratForm';
import { echeanceProche, SEUIL_ECHEANCE_JOURS } from './ContratsPage';
import type { Contrat } from '@/services/contratsService';

const contrat = (over: Partial<Contrat>): Contrat =>
  ({ statut: 'actif', date_fin: '2026-12-31', ...over } as Contrat);

const dansNJours = (jours: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + jours);
  return date.toISOString().slice(0, 10);
};

describe('durée d’un contrat', () => {
  it('compte les mois entamés, comme une fiche les lit', () => {
    // Du 1er septembre au 28 février, il y a six mois d'exécution, non cinq.
    expect(dureeEnMois('2026-09-01', '2027-02-28')).toBe(6);
    expect(dureeEnMois('2026-01-15', '2026-01-31')).toBe(1);
  });

  it('refuse une fin antérieure au début', () => {
    expect(dureeEnMois('2026-12-01', '2026-01-01')).toBeNull();
  });

  it('ne devine rien sans dates', () => {
    expect(dureeEnMois('', '2026-01-01')).toBeNull();
    expect(dureeEnMois('2026-01-01', '')).toBeNull();
  });
});

describe('découpage de l’échéancier', () => {
  it('découpe en mois, en trimestres ou en semaines selon la périodicité', () => {
    expect(nombrePeriodes('2026-09-01', '2027-02-28', 'mensuelle')).toBe(6);
    expect(nombrePeriodes('2026-01-01', '2026-12-31', 'trimestrielle')).toBe(4);
    expect(nombrePeriodes('2026-01-01', '2026-01-28', 'hebdomadaire')).toBe(4);
  });

  it('ne découpe pas une livraison unique', () => {
    expect(nombrePeriodes('2026-01-01', '2026-12-31', 'unique')).toBe(1);
  });

  it('laisse une périodicité personnalisée à la saisie', () => {
    // Elle ne se déduit pas : la base crée une seule période, que l'agent
    // ventile ensuite lui-même.
    expect(nombrePeriodes('2026-01-01', '2026-12-31', 'personnalisee')).toBe(1);
  });
});

describe('contrats dont le terme approche', () => {
  it('retient un contrat actif dont le terme tombe dans la fenêtre', () => {
    expect(echeanceProche(contrat({ date_fin: dansNJours(30) }))).toBe(true);
    expect(echeanceProche(contrat({ date_fin: dansNJours(SEUIL_ECHEANCE_JOURS) }))).toBe(true);
  });

  it('écarte un contrat déjà échu : il n’attend plus de renouvellement', () => {
    expect(echeanceProche(contrat({ date_fin: dansNJours(-1) }))).toBe(false);
  });

  it('écarte un contrat clôturé, quelle que soit sa date de fin', () => {
    expect(echeanceProche(contrat({ statut: 'cloture', date_fin: dansNJours(10) }))).toBe(false);
    expect(echeanceProche(contrat({ statut: 'brouillon', date_fin: dansNJours(10) }))).toBe(false);
  });

  it('retient un contrat suspendu : la suspension ne repousse pas le terme', () => {
    expect(echeanceProche(contrat({ statut: 'suspendu', date_fin: dansNJours(10) }))).toBe(true);
  });
});
