import { describe, expect, it } from 'vitest';
import {
  GRAMMES_PAR_ONCE,
  grammesEnOnces,
  LIBELLES_CANAL,
  LIBELLES_IMPUTATION,
  LIBELLES_REGIME,
  LIBELLES_STATUT_REQUISITION,
  poidsNet,
  PORTEE_REGIME,
  TONS_STATUT_REQUISITION,
  type ImputationContractuelle,
  type RegimeJuridique,
  type StatutRequisition,
} from './requisitionsService';

describe('pesée d’un enlèvement', () => {
  it('déduit la tare du poids brut', () => {
    expect(poidsNet(16_000, 450)).toBe(15_550);
  });

  it('arrondit au milligramme, comme la base le contrôle', () => {
    // `snp_enlevement_poids` refuse un écart supérieur au milligramme entre le
    // net déclaré et la différence brut moins tare.
    expect(poidsNet(1000.0004, 0.0001)).toBe(1000);
  });

  it('ne suppose pas un poids manquant', () => {
    expect(poidsNet(null, 450)).toBeNull();
    expect(poidsNet(16_000, null)).toBeNull();
  });

  it('convertit les grammes en onces troy', () => {
    expect(grammesEnOnces(GRAMMES_PAR_ONCE)).toBeCloseTo(1, 9);
    expect(grammesEnOnces(15_550)).toBeCloseTo(15_550 / 31.1034768, 6);
    expect(grammesEnOnces(null)).toBeNull();
  });
});

describe('régimes juridiques', () => {
  it('en connaît exactement trois, qui ne se confondent pas', () => {
    const regimes: RegimeJuridique[] = ['executoire_sans_accord', 'accord_requis', 'a_qualifier'];
    expect(Object.keys(LIBELLES_REGIME).sort()).toEqual([...regimes].sort());
  });

  it('explique la portée de chacun sans en présenter aucun comme facultatif', () => {
    // Sous un régime exécutoire, l'accord de la mine n'est pas requis ; sous un
    // régime d'accord, il l'est. Aucun des deux textes ne doit laisser croire
    // l'inverse.
    expect(PORTEE_REGIME.executoire_sans_accord).toContain('accord n’est pas requis');
    expect(PORTEE_REGIME.accord_requis).toContain('accord de la mine');
    expect(PORTEE_REGIME.a_qualifier).toContain('ne peut être ni autorisée');
  });

  it('distingue l’accusé de réception de l’accord dans le vocabulaire', () => {
    expect(LIBELLES_STATUT_REQUISITION.accusee).toBe('Accusé de réception reçu');
    expect(LIBELLES_STATUT_REQUISITION.accusee).not.toMatch(/accord|accept/i);
  });
});

describe('référentiels de la réquisition', () => {
  it('nomme chaque état en français, avec son ton', () => {
    const etats: StatutRequisition[] = [
      'brouillon', 'verification_juridique', 'validation_metier', 'validation_direction',
      'autorisee', 'notifiee', 'accusee', 'contestee', 'executoire',
      'enlevement_planifie', 'en_cours_enlevement', 'collectee', 'en_analyse',
      'acceptee', 'facturee', 'payee', 'cloturee', 'suspendue', 'annulee',
    ];
    etats.forEach((etat) => {
      expect(LIBELLES_STATUT_REQUISITION[etat]).toBeTruthy();
      expect(TONS_STATUT_REQUISITION[etat]).toBeTruthy();
    });
  });

  it('offre les six règles d’imputation contractuelle', () => {
    const regles: ImputationContractuelle[] = [
      'totale', 'partielle', 'hors_contrat', 'periode_future', 'avenant', 'exclue',
    ];
    expect(Object.keys(LIBELLES_IMPUTATION).sort()).toEqual([...regles].sort());
  });

  it('couvre les canaux de notification, y compris le courrier officiel', () => {
    expect(Object.keys(LIBELLES_CANAL)).toContain('courrier_officiel');
    expect(Object.keys(LIBELLES_CANAL)).toContain('remise_en_main_propre');
  });
});
