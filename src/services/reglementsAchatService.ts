import { supabase } from '@/lib/supabase';

/**
 * Règlements aux sociétés minières : préparation, cycle de vie, preuves.
 *
 * Ce service prolonge `achatsIndustrielsService`, qui garde la lecture des
 * règlements et l'affectation unitaire. Il porte ce que le paiement a de propre :
 * l'éligibilité des bénéficiaires, les comptes bancaires, le cycle de validation
 * et les pièces justificatives.
 *
 * ══ TROIS RÈGLES QUI GOUVERNENT CE MODULE ══
 *
 * 1. Le compte bénéficiaire vient de la fiche de la société, jamais du
 *    formulaire. Un virement de plusieurs milliards ne se saisit pas à la main
 *    au moment de payer.
 * 2. Un règlement en préparation retient une facture sans l'éteindre. La dette
 *    ne baisse qu'à l'exécution confirmée — attestée par une pièce bancaire.
 * 3. Le préparateur n'est pas le validateur. La base le vérifie ; l'écran ne
 *    fait que le refléter.
 */

/* ------------------------------------------------------------------ Types */

export type StatutReglementCycle =
  | 'brouillon' | 'soumis' | 'valide' | 'en_execution'
  | 'execute' | 'rapproche' | 'rejete' | 'annule';

export const LIBELLES_CYCLE: Record<StatutReglementCycle, string> = {
  brouillon: 'Brouillon',
  soumis: 'Soumis pour validation',
  valide: 'Validé',
  en_execution: 'En attente d’exécution bancaire',
  execute: 'Exécuté',
  rapproche: 'Rapproché',
  rejete: 'Rejeté',
  annule: 'Annulé',
};

/** Les états qui éteignent réellement une dette. */
export const STATUTS_PAYEURS: StatutReglementCycle[] = ['execute', 'rapproche'];

export const TONS_CYCLE: Record<StatutReglementCycle, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  brouillon: 'neutral',
  soumis: 'info',
  valide: 'info',
  en_execution: 'warning',
  execute: 'success',
  rapproche: 'success',
  rejete: 'danger',
  annule: 'danger',
};

export const TYPES_PREUVE = [
  { valeur: 'mt103', libelle: 'Message MT103' },
  { valeur: 'avis_swift', libelle: 'Avis SWIFT' },
  { valeur: 'avis_debit', libelle: 'Avis de débit' },
  { valeur: 'confirmation_virement', libelle: 'Confirmation de virement' },
  { valeur: 'bordereau_bancaire', libelle: 'Bordereau bancaire' },
  { valeur: 'releve_bancaire', libelle: 'Relevé bancaire' },
  { valeur: 'autre', libelle: 'Autre justificatif' },
] as const;

/** Formats acceptés pour une pièce bancaire, et plafond de taille. */
export const MIMES_PREUVE_AUTORISES = ['application/pdf', 'image/png', 'image/jpeg'];
export const TAILLE_PREUVE_MAX_OCTETS = 10 * 1024 * 1024;

export interface SocieteEligible {
  mining_company_id: string;
  societe: string;
  code: string | null;
  devise: string;
  nb_factures_ouvertes: number;
  reste_du: number;
  dette_echue: number;
  plus_ancienne_facture: string | null;
  plus_ancienne_echeance: string | null;
  anciennete_jours: number;
  nb_comptes_actifs: number;
}

export interface FactureEligible {
  facture_id: string;
  numero_facture: string;
  achat_numero: string | null;
  periode_debut: string;
  periode_fin: string;
  date_emission: string;
  date_echeance: string;
  montant_ttc: number;
  montant_paye: number;
  montant_engage: number;
  reste_du: number;
  reste_a_affecter: number;
  anciennete_jours: number;
  tranche: string;
  statut: string;
  statut_certification: string;
}

export interface CompteBancaire {
  id: string;
  account_name: string;
  account_holder: string | null;
  bank_name: string;
  bank_country: string;
  bank_code: string | null;
  branch_name: string | null;
  branch_code: string | null;
  account_number: string;
  rib_key: string | null;
  iban: string | null;
  swift_code: string | null;
  account_currency: string;
  is_primary: boolean | null;
  is_active: boolean | null;
  verification_status: string;
  valid_to: string | null;
}

export interface PreuveReglement {
  id: string;
  reglement_id: string;
  type_document: string;
  fichier_url: string;
  nom_origine: string;
  type_mime: string;
  taille_octets: number;
  reference_document: string | null;
  date_emission: string | null;
  banque_emettrice: string | null;
  commentaire: string | null;
  statut_verification: 'a_verifier' | 'verifiee' | 'rejetee';
  motif_rejet: string | null;
  ajoute_le: string;
}

export interface AffectationSaisie {
  facture_id: string;
  montant: number;
}

/* ------------------------------------------------------------ Formatage */

const formateurEntier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const formateurDecimal = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

/**
 * Montant en francs CFA, séparateurs par espace insécable.
 * Les sommes de ce module atteignent le milliard : un montant mal séparé se lit
 * de travers, et un virement se trompe d'un facteur dix.
 */
export function formaterFcfa(valeur: number | null | undefined, decimales = false): string {
  const formate = formaterMontant(valeur, decimales);
  return formate === '—' ? formate : `${formate} FCFA`;
}

/**
 * Le même montant, sans sa devise.
 *
 * Dans un tableau dont l'en-tête porte déjà « (FCFA) », répéter l'unité à chaque
 * cellule allonge les colonnes et force un défilement horizontal, sans rien
 * apprendre à personne.
 */
export function formaterMontant(valeur: number | null | undefined, decimales = false): string {
  if (valeur === null || valeur === undefined || Number.isNaN(Number(valeur))) return '—';
  const nombre = Number(valeur);
  return decimales ? formateurDecimal.format(nombre) : formateurEntier.format(nombre);
}

const UNITES = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

/**
 * Les dizaines irrégulières du français demandent un traitement à part :
 * soixante-et-onze, quatre-vingts, quatre-vingt-onze. Une règle uniforme
 * produirait « soixante-onze », qui ne se lit pas sur un ordre de virement.
 */
function centaineEnLettres(nombre: number): string {
  if (nombre < 20) return UNITES[nombre];

  if (nombre < 100) {
    const dizaine = Math.floor(nombre / 10);
    const unite = nombre % 10;

    // 70-79 et 90-99 se comptent par vingtaines : soixante-dix, quatre-vingt-dix.
    if (dizaine === 7 || dizaine === 9) {
      const base = dizaine === 7 ? 'soixante' : 'quatre-vingt';
      // « et » ne s'emploie qu'après soixante : quatre-vingt-onze n'en prend pas.
      if (unite === 1 && dizaine === 7) return 'soixante-et-onze';
      return `${base}-${UNITES[10 + unite]}`;
    }

    if (unite === 0) return DIZAINES[dizaine] + (dizaine === 8 ? 's' : '');
    // Quatre-vingt-un ne prend pas de « et » non plus.
    if (unite === 1 && dizaine !== 8) return `${DIZAINES[dizaine]}-et-un`;
    return `${DIZAINES[dizaine]}-${UNITES[unite]}`;
  }

  const centaine = Math.floor(nombre / 100);
  const reste = nombre % 100;
  const tete = centaine === 1 ? 'cent' : `${UNITES[centaine]} cent${reste === 0 ? 's' : ''}`;
  return reste === 0 ? tete : `${tete} ${centaineEnLettres(reste)}`;
}

/**
 * Montant en toutes lettres, pour l'écran de vérification.
 * Un ordre de virement se relit : le montant en lettres est la protection
 * usuelle contre le chiffre mal lu ou mal saisi.
 */
export function montantEnLettres(valeur: number): string {
  const entier = Math.floor(Math.abs(Number(valeur) || 0));
  if (entier === 0) return 'zéro franc CFA';

  const tranches: Array<{ valeur: number; singulier: string; pluriel: string }> = [
    { valeur: 1_000_000_000, singulier: 'milliard', pluriel: 'milliards' },
    { valeur: 1_000_000, singulier: 'million', pluriel: 'millions' },
    { valeur: 1_000, singulier: 'mille', pluriel: 'mille' },
  ];

  let reste = entier;
  const morceaux: string[] = [];

  tranches.forEach((tranche) => {
    const compte = Math.floor(reste / tranche.valeur);
    if (compte === 0) return;
    reste %= tranche.valeur;
    const nom = compte > 1 ? tranche.pluriel : tranche.singulier;
    morceaux.push(
      tranche.valeur === 1_000 && compte === 1 ? 'mille' : `${centaineEnLettres(compte)} ${nom}`
    );
  });

  if (reste > 0) morceaux.push(centaineEnLettres(reste));

  return `${morceaux.join(' ')} franc${entier > 1 ? 's' : ''} CFA`;
}

/** Numéro de compte masqué : seuls les quatre derniers chiffres restent lisibles. */
export function masquerCompte(numero: string | null | undefined): string {
  if (!numero) return '—';
  const propre = numero.replace(/\s/g, '');
  if (propre.length <= 4) return propre;
  return `${'•'.repeat(Math.max(4, propre.length - 4))}${propre.slice(-4)}`;
}

/* --------------------------------------------------------------- Service */

const lancerSiErreur = <T>({ data, error }: { data: T; error: unknown }): T => {
  if (error) throw error;
  return data;
};

export const reglementsAchatService = {
  /** Seules les sociétés portant une dette réellement exigible sont proposées. */
  async societesEligibles(): Promise<SocieteEligible[]> {
    const reponse = await supabase.rpc('snp_societes_eligibles_paiement');
    return (lancerSiErreur(reponse) || []) as SocieteEligible[];
  },

  async facturesEligibles(societeId: string, devise = 'XOF'): Promise<FactureEligible[]> {
    const reponse = await supabase.rpc('snp_factures_eligibles', {
      p_mining_company_id: societeId,
      p_devise: devise,
    });
    return (lancerSiErreur(reponse) || []) as FactureEligible[];
  },

  /**
   * Comptes bancaires actifs de la société, tels que définis sur sa fiche.
   * Le formulaire de paiement ne peut rien créer ici : il lit.
   */
  async comptesBancaires(societeId: string, devise = 'XOF'): Promise<CompteBancaire[]> {
    const reponse = await supabase
      .from('stakeholder_bank_accounts')
      .select('*')
      .eq('stakeholder_type', 'mining_company')
      .eq('stakeholder_id', societeId)
      .eq('is_active', true)
      .eq('account_currency', devise)
      .order('is_primary', { ascending: false })
      .order('bank_name');

    const comptes = (lancerSiErreur(reponse) || []) as CompteBancaire[];
    const aujourdhui = new Date().toISOString().slice(0, 10);
    // Un compte dont la validité est expirée n'est plus un compte utilisable.
    return comptes.filter((compte) => !compte.valid_to || compte.valid_to >= aujourdhui);
  },

  /**
   * Préparation du règlement et de ses affectations, d'un seul bloc.
   * Enchaîner deux appels laisserait, à la moindre coupure, un ordre de virement
   * sans imputation — visible en trésorerie, invisible en comptabilité.
   */
  async preparer(entree: {
    mining_company_id: string;
    compte_bancaire_id: string;
    montant_fcfa: number;
    affectations: AffectationSaisie[];
    date_execution_prevue?: string | null;
    objet?: string | null;
    reference_interne?: string | null;
    observations?: string | null;
  }) {
    const reponse = await supabase.rpc('snp_preparer_reglement', {
      p_mining_company_id: entree.mining_company_id,
      p_compte_bancaire_id: entree.compte_bancaire_id,
      p_montant: entree.montant_fcfa,
      p_affectations: entree.affectations.map((affectation) => ({
        facture_id: affectation.facture_id,
        montant: affectation.montant,
      })),
      p_date_execution_prevue: entree.date_execution_prevue ?? null,
      p_objet: entree.objet ?? null,
      p_reference_interne: entree.reference_interne ?? null,
      p_observations: entree.observations ?? null,
    });
    const lignes = lancerSiErreur(reponse) as Array<{
      r_reglement_id: string; r_reference: string; r_affecte: number; r_non_affecte: number;
    }>;
    return lignes?.[0] ?? null;
  },

  async changerStatut(reglementId: string, statut: StatutReglementCycle, motif?: string) {
    const reponse = await supabase.rpc('snp_changer_statut_reglement', {
      p_reglement_id: reglementId,
      p_statut: statut,
      p_motif: motif,
    });
    const lignes = lancerSiErreur(reponse) as Array<{
      r_reglement_id: string; r_statut: string; r_montant_paye: number;
    }>;
    return lignes?.[0] ?? null;
  },

  async transitionsPossibles(statut: StatutReglementCycle): Promise<StatutReglementCycle[]> {
    const reponse = await supabase.rpc('snp_transitions_reglement', { p_statut: statut });
    return (lancerSiErreur(reponse) || []) as StatutReglementCycle[];
  },

  /* --------------------------------------------------------- Preuves --- */

  async preuves(reglementId: string): Promise<PreuveReglement[]> {
    const reponse = await supabase
      .from('snp_reglements_preuves')
      .select('*')
      .eq('reglement_id', reglementId)
      .order('ajoute_le', { ascending: false });
    return (lancerSiErreur(reponse) || []) as PreuveReglement[];
  },

  /**
   * Contrôle d'une pièce avant envoi. Le type et la taille sont vérifiés ici
   * pour épargner un envoi inutile ; la base les revérifie par contrainte.
   */
  validerPreuve(fichier: { type: string; size: number; name: string }): string | null {
    if (!MIMES_PREUVE_AUTORISES.includes(fichier.type)) {
      return `Format refusé : ${fichier.type || 'inconnu'}. Formats acceptés : PDF, PNG, JPEG.`;
    }
    if (fichier.size > TAILLE_PREUVE_MAX_OCTETS) {
      return `Fichier trop volumineux (${Math.round(fichier.size / 1024 / 1024)} Mo). Maximum : 10 Mo.`;
    }
    if (fichier.size <= 0) return 'Fichier vide.';
    return null;
  },

  /**
   * Nom de stockage sécurisé : ni chemin, ni caractère d'échappement, ni
   * extension trompeuse. Le nom d'origine est conservé à part, pour l'affichage.
   */
  nomSecurise(reglementReference: string, nomOrigine: string): string {
    const extension = (nomOrigine.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const horodatage = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    return `preuves/${reglementReference}/${horodatage}.${extension || 'bin'}`;
  },

  async enregistrerPreuve(entree: {
    reglement_id: string;
    reference_reglement: string;
    type_document: string;
    fichier_url: string;
    nom_origine: string;
    type_mime: string;
    taille_octets: number;
    empreinte_sha256?: string | null;
    reference_document?: string | null;
    date_emission?: string | null;
    banque_emettrice?: string | null;
    commentaire?: string | null;
  }): Promise<PreuveReglement> {
    // Ecriture directe interdite depuis le lot 4b (REVOKE + trigger snp_4b_rpc_only) :
    // on passe par la RPC transactionnelle, seule habilitee a poser une preuve.
    const reponse = await supabase.rpc('snp_ajouter_preuve_reglement', {
      p_reglement_id: entree.reglement_id,
      p_type_document: entree.type_document,
      p_fichier_url: entree.fichier_url,
      p_nom_origine: entree.nom_origine,
      p_type_mime: entree.type_mime,
      p_taille_octets: entree.taille_octets,
      p_empreinte_sha256: entree.empreinte_sha256 ?? null,
      p_reference_document: entree.reference_document ?? null,
      p_date_emission: entree.date_emission ?? null,
      p_banque_emettrice: entree.banque_emettrice ?? null,
      p_commentaire: entree.commentaire ?? null,
    });
    return lancerSiErreur(reponse) as PreuveReglement;
  },

  async verifierPreuve(preuveId: string, verifiee: boolean, motif?: string): Promise<PreuveReglement> {
    // La verification passe par la RPC qui impose la separation des taches
    // (l'ajout et la verification ont des acteurs distincts), la capacite
    // sonasp.finance.reconcile et un motif de rejet d'au moins dix caracteres.
    // L'ancien UPDATE direct fixait verifiee_par = self sans aucun controle.
    const reponse = await supabase.rpc('snp_verifier_preuve_reglement', {
      p_preuve_id: preuveId,
      p_decision: verifiee ? 'verifiee' : 'rejetee',
      p_motif: motif,
    });
    return lancerSiErreur(reponse) as PreuveReglement;
  },
};
