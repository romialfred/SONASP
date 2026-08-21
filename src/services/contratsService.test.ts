import { describe, expect, it } from 'vitest';
import {
  ETATS_VIVANTS,
  formaterFcfa,
  formaterNombre,
  formaterQuantite,
  joursAvantEcheance,
  LIBELLES_METHODE_PRIX,
  LIBELLES_PARTENAIRE,
  LIBELLES_STATUT_CONTRAT,
  LIBELLES_STATUT_DEFAUT,
  TONS_STATUT_CONTRAT,
  TONS_STATUT_DEFAUT,
  type StatutContrat,
  type StatutDefaut,
} from './contratsService';

describe('lisibilité des montants et quantités', () => {
  it('sépare les milliers d’un montant en francs', () => {
    expect(formaterFcfa(1_903_795_510)).toMatch(/^1\s903\s795\s510 FCFA$/);
  });

  it('garde les décimales d’une quantité d’or', () => {
    // Une once se compte au dix-millième : arrondir au franc ferait perdre
    // plusieurs grammes sur un lot.
    expect(formaterQuantite(499.9463)).toMatch(/^499,9463 oz$/);
    expect(formaterQuantite(1000, 'g')).toMatch(/^1\s000,00 g$/);
  });

  it('affiche « — » plutôt qu’un zéro trompeur quand la valeur manque', () => {
    expect(formaterQuantite(null)).toBe('—');
    expect(formaterFcfa(undefined)).toBe('—');
    expect(formaterNombre(Number.NaN)).toBe('—');
  });
});

describe('échéance d’un contrat', () => {
  const dansNJours = (jours: number) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + jours);
    return date.toISOString().slice(0, 10);
  };

  it('compte les jours qui restent avant le terme', () => {
    expect(joursAvantEcheance({ date_fin: dansNJours(30) })).toBe(30);
    expect(joursAvantEcheance({ date_fin: dansNJours(0) })).toBe(0);
  });

  it('rend un nombre négatif pour un contrat déjà échu', () => {
    expect(joursAvantEcheance({ date_fin: dansNJours(-5) })).toBe(-5);
  });

  it('ne devine pas une date illisible', () => {
    expect(joursAvantEcheance({ date_fin: 'pas une date' })).toBeNull();
  });
});

describe('référentiels', () => {
  it('nomme chaque état du contrat en français', () => {
    const etats: StatutContrat[] = [
      'brouillon', 'soumis', 'revue_juridique', 'validation_metier', 'validation_financiere',
      'approuve', 'signe', 'actif', 'suspendu', 'echu', 'resilie', 'cloture', 'rejete', 'annule',
    ];
    etats.forEach((etat) => {
      expect(LIBELLES_STATUT_CONTRAT[etat]).toBeTruthy();
      expect(TONS_STATUT_CONTRAT[etat]).toBeTruthy();
    });
  });

  it('nomme chaque état d’un manquement', () => {
    const etats: StatutDefaut[] = [
      'detecte', 'a_qualifier', 'confirme', 'conteste', 'en_traitement',
      'action_corrective', 'regularise', 'non_regularise', 'clos', 'annule',
    ];
    etats.forEach((etat) => {
      expect(LIBELLES_STATUT_DEFAUT[etat]).toBeTruthy();
      expect(TONS_STATUT_DEFAUT[etat]).toBeTruthy();
    });
  });

  it('distingue les quatre catégories de partenaire', () => {
    // Un orpailleur ne reçoit pas le formulaire d'une mine industrielle : la
    // distinction se lit dès le référentiel.
    expect(Object.keys(LIBELLES_PARTENAIRE)).toHaveLength(4);
    expect(LIBELLES_PARTENAIRE.artisan).toBe('Artisan minier');
  });

  it('offre sept méthodes de fixation du prix', () => {
    expect(Object.keys(LIBELLES_METHODE_PRIX)).toHaveLength(7);
  });

  it('ne tient pour vivant qu’un contrat actif ou suspendu', () => {
    // Un contrat échu ou clôturé n'appelle plus de décision de renouvellement.
    expect(ETATS_VIVANTS).toEqual(['actif', 'suspendu']);
    expect(ETATS_VIVANTS).not.toContain('echu');
    expect(ETATS_VIVANTS).not.toContain('cloture');
  });
});
