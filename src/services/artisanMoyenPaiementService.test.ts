import { describe, expect, it } from 'vitest';
import {
  MOYEN_VIDE,
  appliquerPrincipalUnique,
  coordonneeMasquee,
  libelleMoyen,
  moyenParDefaut,
  validerMoyen,
  type MoyenPaiement,
} from './artisanMoyenPaiementService';

const mobile = (over: Partial<MoyenPaiement> = {}): MoyenPaiement => ({
  ...MOYEN_VIDE('a1'),
  type: 'orange_money',
  titulaire: 'KABORE Awa',
  numero_telephone: '+22670112233',
  ...over,
});

const bancaire = (over: Partial<MoyenPaiement> = {}): MoyenPaiement => ({
  ...MOYEN_VIDE('a1'),
  type: 'virement_bancaire',
  titulaire: 'KABORE Awa',
  banque: 'Coris Bank',
  numero_compte: 'BF76 1234 5678 9012',
  ...over,
});

describe('coordonneeMasquee', () => {
  it('ne montre que les quatre derniers caractères', () => {
    // Comme sur un relevé bancaire : de quoi reconnaître le compte, pas de quoi le recopier.
    expect(coordonneeMasquee(mobile())).toBe('•••• 2233');
    expect(coordonneeMasquee(bancaire())).toBe('•••• 9012');
  });

  it('supporte l’absence de coordonnée et les valeurs courtes', () => {
    expect(coordonneeMasquee({ type: 'especes' })).toBe('—');
    expect(coordonneeMasquee({ type: 'orange_money', numero_telephone: '12' })).toBe('12');
  });
});

describe('libelleMoyen', () => {
  it('associe le canal et le titulaire', () => {
    expect(libelleMoyen(mobile())).toBe('Orange Money — KABORE Awa');
  });

  it('préfère le libellé personnalisé', () => {
    expect(libelleMoyen({ ...mobile(), libelle: 'Compte principal' })).toBe('Compte principal — KABORE Awa');
  });
});

describe('validerMoyen', () => {
  it('accepte un moyen complet', () => {
    expect(validerMoyen(mobile())).toBeNull();
    expect(validerMoyen(bancaire())).toBeNull();
  });

  it('exige le titulaire quel que soit le canal', () => {
    expect(validerMoyen(mobile({ titulaire: '  ' }))).toMatch(/titulaire/);
  });

  it('exige un numéro mobile au bon format', () => {
    // Un moyen sans coordonnée exploitable se découvrirait au moment de payer.
    expect(validerMoyen(mobile({ numero_telephone: '' }))).toMatch(/numéro de téléphone/i);
    expect(validerMoyen(mobile({ numero_telephone: '70-AB-CD' }))).toMatch(/format/);
    expect(validerMoyen(mobile({ numero_telephone: '+226 70 11 22 33' }))).toBeNull();
  });

  it('exige banque et compte pour un virement ou un chèque', () => {
    expect(validerMoyen(bancaire({ banque: '' }))).toMatch(/banque/i);
    expect(validerMoyen(bancaire({ numero_compte: '' }))).toMatch(/compte/i);
    expect(validerMoyen(bancaire({ type: 'cheque', banque: '' }))).toMatch(/banque/i);
  });

  it('n’exige aucune coordonnée pour les espèces', () => {
    expect(validerMoyen({ ...MOYEN_VIDE('a1'), type: 'especes', titulaire: 'KABORE Awa' })).toBeNull();
  });
});

describe('appliquerPrincipalUnique', () => {
  it('ne laisse qu’un seul principal', () => {
    // Sans cela, l'écran de paiement en présélectionnerait plusieurs.
    const resultat = appliquerPrincipalUnique(
      [mobile({ est_principal: true }), bancaire({ est_principal: true }), mobile()],
      1
    );
    expect(resultat.map((moyen) => moyen.est_principal)).toEqual([false, true, false]);
  });
});

describe('moyenParDefaut', () => {
  it('retient le principal', () => {
    const principal = bancaire({ id: 'm2', est_principal: true });
    expect(moyenParDefaut([mobile({ id: 'm1' }), principal])?.id).toBe('m2');
  });

  it('retombe sur le premier actif à défaut de principal', () => {
    expect(moyenParDefaut([mobile({ id: 'm1' }), bancaire({ id: 'm2' })])?.id).toBe('m1');
  });

  it('écarte les moyens désactivés', () => {
    expect(moyenParDefaut([mobile({ id: 'm1', actif: false })])).toBeNull();
    expect(moyenParDefaut([])).toBeNull();
  });
});
