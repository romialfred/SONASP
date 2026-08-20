/**
 * Objectifs de production : budget voté et prévision révisée.
 *
 * L'écran comparait le réalisé à des objectifs **codés en dur** — 850, 2 800 et
 * 5 500 oz — assortis de feux tricolores et d'écarts en pourcentage, comme s'ils
 * venaient d'une source. Or `monthly_budgets` porte le budget mensuel voté par
 * société et `quarterly_forecasts` ses révisions trimestrielles : les objectifs
 * réels existent, ils n'étaient simplement pas lus.
 *
 * Un objectif se cumule au prorata des jours : chaque mois porte un rythme
 * journalier, et une période à cheval sur deux mois additionne les deux rythmes.
 * Un mois sans ligne n'est pas compté pour zéro — il est nommé, faute de quoi un
 * objectif partiel se lirait comme un objectif atteint.
 */

export interface LigneObjectif {
  /** Mois de 1 à 12. */
  month: number;
  /** Année portée par le budget annuel rattaché. */
  year: number;
  /** Rythme journalier en onces. */
  dailyOz: number;
  mining_company_id?: string | null;
  /** Date de révision, pour ne retenir que la plus récente d'un même mois. */
  revision?: string | null;
}

export interface Periode {
  debut: string;
  fin: string;
}

export interface Objectif {
  /** Onces cumulées sur les mois couverts. */
  totalOz: number;
  /** Mois de la période sans aucune ligne d'objectif, au format AAAA-MM. */
  moisManquants: string[];
  /** Vrai quand chaque mois de la période porte un objectif. */
  complet: boolean;
}

const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Semaine, mois et année en cours, arrêtés au jour dit. La semaine commence le lundi. */
export function bornesPeriodes(aujourdhui = new Date()): { semaine: Periode; mois: Periode; annee: Periode } {
  const fin = iso(aujourdhui);

  const debutSemaine = new Date(aujourdhui);
  const jour = (aujourdhui.getDay() + 6) % 7; // lundi = 0
  debutSemaine.setDate(aujourdhui.getDate() - jour);

  return {
    semaine: { debut: iso(debutSemaine), fin },
    mois: { debut: iso(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1)), fin },
    annee: { debut: iso(new Date(aujourdhui.getFullYear(), 0, 1)), fin },
  };
}

/** Nombre de jours de chaque mois couvert par la période, clé AAAA-MM. */
export function joursParMois(periode: Periode): Map<string, number> {
  const compte = new Map<string, number>();
  const debut = new Date(`${periode.debut}T00:00:00`);
  const fin = new Date(`${periode.fin}T00:00:00`);
  if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime()) || fin < debut) return compte;

  for (const jour = new Date(debut); jour <= fin; jour.setDate(jour.getDate() + 1)) {
    const cle = `${jour.getFullYear()}-${String(jour.getMonth() + 1).padStart(2, '0')}`;
    compte.set(cle, (compte.get(cle) || 0) + 1);
  }
  return compte;
}

/**
 * Ne conserve, pour chaque mois et chaque société, que la révision la plus
 * récente : une prévision révisée remplace la précédente, elle ne s'y ajoute pas.
 */
export function dernieresRevisions(lignes: LigneObjectif[]): LigneObjectif[] {
  const retenues = new Map<string, LigneObjectif>();
  lignes.forEach((ligne) => {
    const cle = `${ligne.year}-${ligne.month}-${ligne.mining_company_id || 'toutes'}`;
    const courante = retenues.get(cle);
    if (!courante || (ligne.revision || '') >= (courante.revision || '')) {
      retenues.set(cle, ligne);
    }
  });
  return [...retenues.values()];
}

/**
 * Cumule l'objectif sur une période, au prorata des jours de chaque mois.
 * Les mois sans ligne sont nommés plutôt que comptés pour zéro.
 */
export function cumulerObjectif(lignes: LigneObjectif[], periode: Periode): Objectif {
  const jours = joursParMois(periode);
  const parMois = new Map<string, number>();
  lignes.forEach((ligne) => {
    const cle = `${ligne.year}-${String(ligne.month).padStart(2, '0')}`;
    parMois.set(cle, (parMois.get(cle) || 0) + Number(ligne.dailyOz || 0));
  });

  let totalOz = 0;
  const moisManquants: string[] = [];

  jours.forEach((nombreJours, cle) => {
    const rythme = parMois.get(cle);
    if (rythme === undefined) {
      moisManquants.push(cle);
      return;
    }
    totalOz += rythme * nombreJours;
  });

  return {
    totalOz: Math.round(totalOz * 100) / 100,
    moisManquants: moisManquants.sort(),
    complet: moisManquants.length === 0,
  };
}

/** Onces réalisées sur une période. */
export function realiseSur(
  productions: Array<{ production_date: string; estimated_oz: number | null }>,
  periode: Periode
): number {
  const total = productions
    .filter((ligne) => ligne.production_date >= periode.debut && ligne.production_date <= periode.fin)
    .reduce((somme, ligne) => somme + Number(ligne.estimated_oz || 0), 0);
  return Math.round(total * 100) / 100;
}

export interface Ecart {
  ecartOz: number;
  pourcentage: number;
  /** Vrai quand le réalisé atteint ou dépasse l'objectif. */
  atteint: boolean;
}

/**
 * Écart au but. Renvoie `null` quand l'objectif est inconnu ou nul : un écart
 * calculé sur rien n'a pas de sens et se lirait comme un jugement.
 */
export function ecartAuBut(realiseOz: number, objectif: Objectif): Ecart | null {
  if (!objectif.complet || objectif.totalOz <= 0) return null;
  const ecartOz = Math.round((realiseOz - objectif.totalOz) * 100) / 100;
  return {
    ecartOz,
    pourcentage: Math.round((ecartOz / objectif.totalOz) * 1000) / 10,
    atteint: ecartOz >= 0,
  };
}

export const LIBELLE_MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** « 2026-03 » → « mars 2026 », pour nommer un mois manquant en clair. */
export function libelleMois(cle: string): string {
  const [annee, mois] = cle.split('-');
  const index = Number(mois) - 1;
  return index >= 0 && index < 12 ? `${LIBELLE_MOIS[index]} ${annee}` : cle;
}
