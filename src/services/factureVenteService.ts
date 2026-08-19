import type { ArtisanGoldSale } from './artisanGoldSalesService';

/**
 * Facture de vente d'or artisanale.
 *
 * ⚠️ SPÉCIMEN — la certification n'est pas raccordée.
 *
 * La note de service n°2025-0885/MEF/SG/DGI du 29 décembre 2025 réserve les
 * éléments de certification (code SECeF, NIM MCF, compteurs, date de
 * certification, QR code) au **Module de Contrôle de Facturation**, appareil
 * acquis auprès de la Chambre de Commerce et d'Industrie. La plateforme, en tant
 * que système de facturation d'entreprise (SFE), doit par ailleurs être
 * homologuée et recevoir un ISF.
 *
 * Tant que ces deux conditions ne sont pas remplies, ce module compose la partie
 * commerciale de la facture — la seule qui nous appartienne — et marque la pièce
 * `SPÉCIMEN`. Le bloc de certification est rempli de valeurs de démonstration
 * explicitement identifiées comme telles : elles ne sont ni calculées, ni
 * plausibles, ni utilisables. Fabriquer un code d'apparence officielle serait une
 * falsification de document fiscal.
 */

/** Groupes de taxation, repris de la structure de la facture certifiée. */
export type GroupeTaxation = 'A' | 'B' | 'C' | 'D' | 'E';

export interface TauxGroupe {
  code: GroupeTaxation;
  libelle: string;
  taux: number;
}

/**
 * Table des groupes employés par la plateforme.
 * Le cahier des charges de la DGI fixera la table de référence ; celle-ci ne
 * couvre que les régimes que nous appliquons aujourd'hui.
 */
export const GROUPES_TAXATION: Record<GroupeTaxation, TauxGroupe> = {
  A: { code: 'A', libelle: 'Exonéré', taux: 0 },
  B: { code: 'B', libelle: 'TVA 18 %', taux: 18 },
  C: { code: 'C', libelle: 'TVA 10 %', taux: 10 },
  D: { code: 'D', libelle: 'TVA 0 % (export)', taux: 0 },
  E: { code: 'E', libelle: 'Hors champ', taux: 0 },
};

export interface LigneFacture {
  reference: string;
  designation: string;
  quantite: number;
  unite: string;
  prixUnitaire: number;
  remise: number;
  montantHt: number;
  groupe: GroupeTaxation;
}

export interface AutreTaxe {
  libelle: string;
  base: number;
  taux: number;
  montant: number;
}

export interface RecapGroupe {
  groupe: GroupeTaxation;
  libelle: string;
  baseHt: number;
  taux: number;
  montantTva: number;
}

export interface PartieFacture {
  raisonSociale: string;
  adresse?: string;
  telephone?: string;
  ifu?: string;
  rccm?: string;
  regimeImposition?: string;
  divisionFiscale?: string;
}

export interface Certification {
  /** Toujours `false` tant que le MCF n'est pas raccordé. */
  effective: boolean;
  codeSecef: string;
  nimMcf: string;
  isf: string;
  compteur: string;
  dateCertification: string;
  /** Contenu encodé dans le QR ; annonce le caractère non certifié. */
  contenuQr: string;
}

export interface Facture {
  numero: string;
  numeroVente: string;
  date: string;
  echeance: string | null;
  vendeur: PartieFacture;
  client: PartieFacture;
  objet: string;
  lignes: LigneFacture[];
  recapGroupes: RecapGroupe[];
  autresTaxes: AutreTaxe[];
  totalHt: number;
  totalTva: number;
  totalAutresTaxes: number;
  totalTtc: number;
  acompte: number;
  netAPayer: number;
  montantEnLettres: string;
  modeReglement: string;
  certification: Certification;
  specimen: boolean;
}

/* ------------------------------------------------------------------ Lettres */

const UNITES = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
];

const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

/** Nombre inférieur à cent, orthographe française. */
function souscent(valeur: number): string {
  if (valeur < 20) return UNITES[valeur];
  const dizaine = Math.floor(valeur / 10);
  const unite = valeur % 10;

  // 70-79 et 90-99 se disent « soixante-dix » et « quatre-vingt-dix ».
  if (dizaine === 7 || dizaine === 9) {
    const base = DIZAINES[dizaine];
    const reste = UNITES[10 + unite];
    return unite === 1 && dizaine === 7 ? `${base} et onze` : `${base}-${reste}`;
  }
  if (unite === 0) return dizaine === 8 ? 'quatre-vingts' : DIZAINES[dizaine];
  if (unite === 1 && dizaine !== 8) return `${DIZAINES[dizaine]} et un`;
  return `${DIZAINES[dizaine]}-${UNITES[unite]}`;
}

/**
 * Nombre inférieur à mille.
 * `devantMille` supprime l'accord de « cent » : il prend un s quand il termine le
 * nombre (« deux cents ») mais reste invariable devant « mille »
 * (« deux cent mille »). Devant « millions » et « milliards », qui sont des noms
 * et non des multiplicateurs, l'accord subsiste (« deux cents millions »).
 */
function souscmille(valeur: number, devantMille = false): string {
  if (valeur < 100) return souscent(valeur);
  const centaines = Math.floor(valeur / 100);
  const reste = valeur % 100;
  const tete = centaines === 1 ? 'cent' : `${UNITES[centaines]} cent`;
  if (reste === 0) return centaines === 1 || devantMille ? tete : `${tete}s`;
  return `${tete} ${souscent(reste)}`;
}

/**
 * Montant en toutes lettres, pour la mention « Arrêtée la présente facture à… ».
 * Les centimes sont écartés : le FCFA n'a pas de subdivision en circulation.
 */
export function montantEnLettres(montant: number, devise = 'francs CFA'): string {
  const entier = Math.round(Math.abs(montant));
  if (entier === 0) return `zéro ${devise}`;

  const tranches: Array<{ valeur: number; singulier: string; pluriel: string }> = [
    { valeur: 1_000_000_000, singulier: 'milliard', pluriel: 'milliards' },
    { valeur: 1_000_000, singulier: 'million', pluriel: 'millions' },
    { valeur: 1_000, singulier: 'mille', pluriel: 'mille' },
  ];

  let reste = entier;
  const morceaux: string[] = [];

  tranches.forEach(({ valeur, singulier, pluriel }) => {
    const compte = Math.floor(reste / valeur);
    if (compte === 0) return;
    reste %= valeur;
    if (valeur === 1_000) {
      // « mille » est invariable et ne se fait pas précéder de « un ».
      morceaux.push(compte === 1 ? 'mille' : `${souscmille(compte, true)} mille`);
      return;
    }
    morceaux.push(`${souscmille(compte)} ${compte > 1 ? pluriel : singulier}`);
  });

  if (reste > 0) morceaux.push(souscmille(reste));

  const lettres = morceaux.join(' ').replace(/\s+/g, ' ').trim();
  return `${montant < 0 ? 'moins ' : ''}${lettres} ${devise}`;
}

/* ------------------------------------------------------------------ Calculs */

export const arrondi = (valeur: number) => Math.round((Number(valeur) || 0) * 100) / 100;

/** Récapitulatif par groupe de taxation, à partir des lignes. */
export function recapitulerGroupes(lignes: LigneFacture[]): RecapGroupe[] {
  const parGroupe = new Map<GroupeTaxation, RecapGroupe>();

  lignes.forEach((ligne) => {
    const reference = GROUPES_TAXATION[ligne.groupe];
    const existant = parGroupe.get(ligne.groupe) || {
      groupe: ligne.groupe,
      libelle: reference.libelle,
      baseHt: 0,
      taux: reference.taux,
      montantTva: 0,
    };
    existant.baseHt = arrondi(existant.baseHt + ligne.montantHt);
    existant.montantTva = arrondi((existant.baseHt * reference.taux) / 100);
    parGroupe.set(ligne.groupe, existant);
  });

  return [...parGroupe.values()].sort((a, b) => a.groupe.localeCompare(b.groupe));
}

/**
 * Groupe de taxation d'une vente d'or artisanale, déduit du taux appliqué.
 * Le rattachement définitif viendra de la table de référence de la DGI.
 */
export function groupePourTaux(taux: number): GroupeTaxation {
  if (taux >= 18) return 'B';
  if (taux >= 10) return 'C';
  return 'A';
}

const TYPE_OR_LIBELLE: Record<string, string> = {
  poudre: 'Or en poudre',
  lingot: 'Or en lingot',
  pepites: 'Or en pépites',
  bijoux: 'Or travaillé (bijoux)',
  autre: 'Or — forme non répertoriée',
};

/** Valeurs de démonstration du bloc DGI, figées et identifiées comme telles. */
export const CERTIFICATION_DEMO: Omit<Certification, 'contenuQr'> = {
  effective: false,
  codeSecef: 'SPECIMEN-NON-CERTIFIE',
  nimMcf: 'MCF non raccordé',
  isf: 'ISF non attribué',
  compteur: '— / —',
  dateCertification: 'Non certifiée',
};

/**
 * Contenu du QR code.
 *
 * Il n'imite pas une charge utile de certification : il annonce en clair que la
 * pièce est un spécimen. Un lecteur qui le scanne doit comprendre immédiatement
 * qu'il n'a pas affaire à une facture certifiée.
 */
export function contenuQrSpecimen(facture: Pick<Facture, 'numero' | 'numeroVente' | 'date' | 'netAPayer'>): string {
  return [
    'SPECIMEN - FACTURE NON CERTIFIEE',
    'Aucune valeur fiscale ni comptable.',
    `Facture : ${facture.numero}`,
    `Vente : ${facture.numeroVente}`,
    `Date : ${facture.date}`,
    `Net a payer : ${Math.round(facture.netAPayer)} FCFA`,
    'Certification DGI (code SECeF, NIM MCF, ISF) non raccordee.',
    'SONASP - Systeme National de Collecte et de Suivi de la Tracabilite de l Or',
  ].join('\n');
}

/** Numéro de facture dérivé du numéro de vente : `VE-OR-2026-00007` → `FA-2026-00007`. */
export function numeroFacture(numeroVente: string): string {
  const correspondance = /^VE-OR-(\d{4})-(\d{5})$/.exec(numeroVente || '');
  return correspondance ? `FA-${correspondance[1]}-${correspondance[2]}` : 'FA-—';
}

export interface ContexteFacture {
  vendeur: PartieFacture;
  client: PartieFacture;
  echeance?: string | null;
  modeReglement?: string;
  acompte?: number;
}

/**
 * Compose la facture d'une vente d'or.
 *
 * Chaque composante du net à payer apparaît sur la pièce : la facture de
 * référence fournie affichait un total TTC de 78 994 pour un net à payer de
 * 82 294, sans qu'aucune ligne n'explique les 3 300 d'écart.
 */
export function composerFacture(vente: ArtisanGoldSale, contexte: ContexteFacture): Facture {
  const montantHt = arrondi(vente.montant_brut_fcfa);
  const groupe = groupePourTaux(Number(vente.tva_taux || 0));

  const lignes: LigneFacture[] = [
    {
      reference: vente.numero_recu || '—',
      designation: `${TYPE_OR_LIBELLE[vente.type_or] || 'Or'} — ${vente.purete_karat} carats`,
      quantite: Number(vente.quantite_grammes || 0),
      unite: 'g',
      prixUnitaire: arrondi(Number(vente.prix_kg_fcfa || 0) / 1000),
      remise: 0,
      montantHt,
      groupe,
    },
  ];

  const recapGroupes = recapitulerGroupes(lignes);
  const totalTva = arrondi(recapGroupes.reduce((total, ligne) => total + ligne.montantTva, 0));

  const autresTaxes: AutreTaxe[] = [];
  const taxeDev = arrondi(vente.taxe_dev_comm_montant_fcfa);
  if (taxeDev > 0 || Number(vente.taxe_dev_comm_taux || 0) > 0) {
    autresTaxes.push({
      libelle: `Taxe de développement communal (${vente.taxe_dev_comm_taux || 0} %)`,
      base: montantHt,
      taux: Number(vente.taxe_dev_comm_taux || 0),
      montant: taxeDev,
    });
  }

  const totalAutresTaxes = arrondi(autresTaxes.reduce((total, taxe) => total + taxe.montant, 0));
  const totalTtc = arrondi(montantHt + totalTva + totalAutresTaxes);
  const acompte = arrondi(contexte.acompte || 0);
  const netAPayer = arrondi(totalTtc - acompte);

  const numero = numeroFacture(vente.numero_recu || '');
  const base = {
    numero,
    numeroVente: vente.numero_recu || '—',
    date: vente.date_vente,
    netAPayer,
  };

  return {
    ...base,
    echeance: contexte.echeance ?? null,
    vendeur: contexte.vendeur,
    client: contexte.client,
    objet: 'Achat d’or auprès d’un artisan minier',
    lignes,
    recapGroupes,
    autresTaxes,
    totalHt: montantHt,
    totalTva,
    totalAutresTaxes,
    totalTtc,
    acompte,
    montantEnLettres: montantEnLettres(netAPayer),
    modeReglement: contexte.modeReglement || 'Virement bancaire',
    certification: { ...CERTIFICATION_DEMO, contenuQr: contenuQrSpecimen(base) },
    specimen: true,
  };
}
