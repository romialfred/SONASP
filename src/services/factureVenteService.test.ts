import { describe, expect, it } from 'vitest';
import {
  CERTIFICATION_DEMO,
  composerFacture,
  contenuQrSpecimen,
  groupePourTaux,
  montantEnLettres,
  numeroFacture,
  recapitulerGroupes,
  type LigneFacture,
} from './factureVenteService';
import type { ArtisanGoldSale } from './artisanGoldSalesService';

describe('montantEnLettres', () => {
  it('écrit le montant de la facture de référence', () => {
    // « QUATRE-VINGT-DEUX MILLE DEUX CENT QUATRE-VINGT-QUATORZE FCFA »
    expect(montantEnLettres(82_294)).toBe('quatre-vingt-deux mille deux cent quatre-vingt-quatorze francs CFA');
  });

  it('respecte les accords du français', () => {
    expect(montantEnLettres(80)).toBe('quatre-vingts francs CFA');
    expect(montantEnLettres(81)).toBe('quatre-vingt-un francs CFA');
    expect(montantEnLettres(200)).toBe('deux cents francs CFA');
    expect(montantEnLettres(203)).toBe('deux cent trois francs CFA');
    expect(montantEnLettres(71)).toBe('soixante et onze francs CFA');
    expect(montantEnLettres(21)).toBe('vingt et un francs CFA');
    expect(montantEnLettres(1_000)).toBe('mille francs CFA');
    expect(montantEnLettres(2_000)).toBe('deux mille francs CFA');
  });

  it('couvre les grands montants et le zéro', () => {
    expect(montantEnLettres(0)).toBe('zéro francs CFA');
    expect(montantEnLettres(1_000_000)).toBe('un million francs CFA');
    expect(montantEnLettres(2_500_000)).toBe('deux millions cinq cent mille francs CFA');
    expect(montantEnLettres(1_000_000_000)).toBe('un milliard francs CFA');
    // « cent » reste invariable devant « mille », mais s'accorde devant « millions ».
    expect(montantEnLettres(500_000)).toBe('cinq cent mille francs CFA');
    expect(montantEnLettres(200_000_000)).toBe('deux cents millions francs CFA');
  });

  it('arrondit : le FCFA n’a pas de subdivision', () => {
    expect(montantEnLettres(1_000.4)).toBe('mille francs CFA');
  });
});

describe('numeroFacture', () => {
  it('dérive le numéro de facture du numéro de vente', () => {
    expect(numeroFacture('VE-OR-2026-00007')).toBe('FA-2026-00007');
  });

  it('ne fabrique rien à partir d’un numéro inconnu', () => {
    expect(numeroFacture('REC-001')).toBe('FA-—');
    expect(numeroFacture('')).toBe('FA-—');
  });
});

describe('groupePourTaux', () => {
  it('rattache le taux au groupe de taxation', () => {
    expect(groupePourTaux(18)).toBe('B');
    expect(groupePourTaux(10)).toBe('C');
    expect(groupePourTaux(0)).toBe('A');
  });
});

describe('recapitulerGroupes', () => {
  const ligne = (over: Partial<LigneFacture>): LigneFacture => ({
    reference: 'R',
    designation: 'D',
    quantite: 1,
    unite: 'g',
    prixUnitaire: 100,
    remise: 0,
    montantHt: 100,
    groupe: 'B',
    ...over,
  });

  it('cumule les bases par groupe et applique le taux du groupe', () => {
    const recap = recapitulerGroupes([
      ligne({ montantHt: 50_000, groupe: 'C' }),
      ligne({ montantHt: 20_000, groupe: 'B' }),
      ligne({ montantHt: 2_500, groupe: 'C' }),
    ]);

    expect(recap.map((g) => g.groupe)).toEqual(['B', 'C']);
    expect(recap.find((g) => g.groupe === 'C')?.baseHt).toBe(52_500);
    expect(recap.find((g) => g.groupe === 'C')?.montantTva).toBe(5_250);
    expect(recap.find((g) => g.groupe === 'B')?.montantTva).toBe(3_600);
  });
});

const vente: ArtisanGoldSale = {
  id: 's1',
  artisan_id: 'a1',
  date_vente: '2026-08-19',
  quantite_grammes: 100,
  type_or: 'lingot',
  purete_karat: 22,
  prix_kg_fcfa: 40_000_000,
  montant_brut_fcfa: 4_000_000,
  tva_taux: 18,
  tva_montant_fcfa: 720_000,
  taxe_dev_comm_taux: 1,
  taxe_dev_comm_montant_fcfa: 40_000,
  montant_total_fcfa: 4_760_000,
  numero_recu: 'VE-OR-2026-00007',
  statut: 'validee',
};

const contexte = {
  vendeur: { raisonSociale: 'SONASP' },
  client: { raisonSociale: 'KABORE Awa' },
};

describe('composerFacture', () => {
  it('rend chaque composante du net à payer visible', () => {
    // La facture de référence affichait 78 994 de TTC pour 82 294 de net à payer,
    // sans qu'aucune ligne n'explique les 3 300 d'écart.
    const facture = composerFacture(vente, contexte);

    expect(facture.totalHt).toBe(4_000_000);
    expect(facture.totalTva).toBe(720_000);
    expect(facture.totalAutresTaxes).toBe(40_000);
    expect(facture.totalTtc).toBe(4_760_000);
    expect(facture.netAPayer).toBe(4_760_000);

    const somme = facture.totalHt + facture.totalTva + facture.totalAutresTaxes - facture.acompte;
    expect(somme).toBe(facture.netAPayer);
  });

  it('nomme la taxe de développement communal plutôt que de la noyer', () => {
    const facture = composerFacture(vente, contexte);
    expect(facture.autresTaxes).toHaveLength(1);
    expect(facture.autresTaxes[0].libelle).toContain('Taxe de développement communal');
    expect(facture.autresTaxes[0].montant).toBe(40_000);
  });

  it('reprend le numéro de vente et en dérive le numéro de facture', () => {
    const facture = composerFacture(vente, contexte);
    expect(facture.numeroVente).toBe('VE-OR-2026-00007');
    expect(facture.numero).toBe('FA-2026-00007');
  });

  it('écrit le net à payer en toutes lettres', () => {
    expect(composerFacture(vente, contexte).montantEnLettres).toBe(
      'quatre millions sept cent soixante mille francs CFA'
    );
  });

  it('marque la pièce comme spécimen et n’émet aucune certification', () => {
    const facture = composerFacture(vente, contexte);

    expect(facture.specimen).toBe(true);
    expect(facture.certification.effective).toBe(false);
    // Fabriquer un code d'apparence officielle serait une falsification de
    // document fiscal : les champs annoncent leur propre absence.
    expect(facture.certification.codeSecef).toBe(CERTIFICATION_DEMO.codeSecef);
    expect(facture.certification.codeSecef).toMatch(/SPECIMEN/);
    expect(facture.certification.nimMcf).toMatch(/non raccordé/i);
    expect(facture.certification.isf).toMatch(/non attribué/i);
    expect(facture.certification.dateCertification).toBe('Non certifiée');
  });
});

describe('contenuQrSpecimen', () => {
  const base = { numero: 'FA-2026-00007', numeroVente: 'VE-OR-2026-00007', date: '2026-08-19', netAPayer: 4_760_000 };

  it('annonce en clair qu’il ne s’agit pas d’une certification', () => {
    const contenu = contenuQrSpecimen(base);
    expect(contenu.split('\n')[0]).toBe('SPECIMEN - FACTURE NON CERTIFIEE');
    expect(contenu).toContain('Aucune valeur fiscale');
    expect(contenu).toContain('non raccordee');
  });

  it('n’imite aucune charge utile de certification', () => {
    const contenu = contenuQrSpecimen(base);
    // Ni code SECeF, ni NIM, ni signature : rien qu'un lecteur puisse prendre
    // pour une preuve de certification.
    expect(contenu).not.toMatch(/SECEF[A-Z0-9]{10,}/);
    expect(contenu).not.toMatch(/NIM\s*:/);
  });

  it('reprend les références de la pièce', () => {
    const contenu = contenuQrSpecimen(base);
    expect(contenu).toContain('FA-2026-00007');
    expect(contenu).toContain('VE-OR-2026-00007');
  });
});
