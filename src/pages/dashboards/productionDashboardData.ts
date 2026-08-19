import { supabase } from '@/lib/supabase';
import { lignes, oncesProduction, type SerieMensuelle } from './roleDashboardData';

export interface MiningCompany {
  id: string;
  name: string;
  abbreviation: string | null;
}

export interface MoisProduction {
  mois: string;
  onces: number;
  grammesDore: number;
  /** Titre moyen pondéré par le nombre de déclarations du mois. */
  titreMoyen: number | null;
  declarations: number;
}

export interface EtatExpedition {
  statut: string;
  libelle: string;
  couleur: string;
  nombre: number;
  onces: number;
  part: number;
}

export interface ProductionDashboardData {
  compagnies: MiningCompany[];
  /** Séries mensuelles par compagnie, plus la clé `all` pour le consolidé. */
  parCompagnie: Record<string, MoisProduction[]>;
  expeditions: EtatExpedition[];
  expeditionsActives: number;
  productionAnnee: number;
  productionMoisPrecedent: number;
  unavailable: string[];
}

export const EMPTY_PRODUCTION_DASHBOARD: ProductionDashboardData = {
  compagnies: [],
  parCompagnie: { all: [] },
  expeditions: [],
  expeditionsActives: 0,
  productionAnnee: 0,
  productionMoisPrecedent: 0,
  unavailable: [],
};

const STATUTS_EXPEDITION: Record<string, { libelle: string; couleur: string }> = {
  prepared: { libelle: 'Préparé', couleur: '#3b82f6' },
  ready_for_customs: { libelle: 'Prêt pour la douane', couleur: '#f59e0b' },
  shipped: { libelle: 'Expédié', couleur: '#0f7a56' },
  in_transit: { libelle: 'En transit', couleur: '#8b5cf6' },
};

export const STATUTS_EXPEDITION_SUIVIS = Object.keys(STATUTS_EXPEDITION);

interface LigneProduction {
  id: string;
  production_date: string;
  bullion_grams: number | null;
  pure_gold_grams: number | null;
  estimated_oz: number | null;
  estimated_fineness_pct: number | null;
  mining_company_id: string | null;
}

/** Clé de mois « AAAA-MM ». */
export const clefAnneeMois = (valeur: string) => {
  const date = new Date(valeur);
  return Number.isNaN(date.getTime())
    ? null
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

/** Squelette de douze mois, du plus ancien au plus récent. */
export function squeletteMois(reference = new Date()): MoisProduction[] {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(reference.getFullYear(), reference.getMonth() - (11 - index), 1);
    return {
      mois: date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
      onces: 0,
      grammesDore: 0,
      titreMoyen: null,
      declarations: 0,
    };
  });
}

/**
 * Agrège les déclarations en séries mensuelles.
 * Le titre moyen est pondéré par le nombre de déclarations et vaut `null` pour un mois
 * sans production : l'ancienne version moyennait sur les douze mois, zéros compris,
 * ce qui tirait mécaniquement le titre vers le bas.
 */
export function agregerParMois(productions: LigneProduction[], reference = new Date()): MoisProduction[] {
  const serie = squeletteMois(reference);
  const index = new Map<string, MoisProduction>();
  serie.forEach((mois, position) => {
    const date = new Date(reference.getFullYear(), reference.getMonth() - (11 - position), 1);
    index.set(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, mois);
  });

  const cumulTitre = new Map<MoisProduction, number>();
  productions.forEach((production) => {
    const mois = index.get(clefAnneeMois(production.production_date) || '');
    if (!mois) return;
    mois.onces += oncesProduction(production);
    mois.grammesDore += Number(production.bullion_grams || 0);
    mois.declarations += 1;
    if (production.estimated_fineness_pct != null) {
      cumulTitre.set(mois, (cumulTitre.get(mois) || 0) + Number(production.estimated_fineness_pct));
    }
  });

  serie.forEach((mois) => {
    const cumul = cumulTitre.get(mois);
    mois.titreMoyen = cumul != null && mois.declarations > 0 ? cumul / mois.declarations : null;
  });

  return serie;
}

/** Titre moyen d'une série, pondéré par les déclarations ; `null` si aucune. */
export function titreMoyenSerie(serie: MoisProduction[]): number | null {
  const declarations = serie.reduce((somme, mois) => somme + mois.declarations, 0);
  if (declarations === 0) return null;
  const cumul = serie.reduce((somme, mois) => somme + (mois.titreMoyen || 0) * mois.declarations, 0);
  return cumul / declarations;
}

export const totalOnces = (serie: MoisProduction[]) => serie.reduce((somme, mois) => somme + mois.onces, 0);

/** Série au format attendu par les graphiques génériques. */
export const versSerie = (serie: MoisProduction[]): SerieMensuelle[] =>
  serie.map((mois) => ({ periode: mois.mois, valeur: mois.onces }));

export async function loadProductionDashboard(reference = new Date()): Promise<ProductionDashboardData> {
  const debut = new Date(reference.getFullYear(), reference.getMonth() - 11, 1);

  const [compagnies, productions, expeditions] = await Promise.allSettled([
    supabase.from('mining_companies').select('id, name, abbreviation').order('name'),
    supabase
      .from('daily_production')
      .select('id, production_date, bullion_grams, pure_gold_grams, estimated_oz, estimated_fineness_pct, mining_company_id')
      .gte('production_date', debut.toISOString().slice(0, 10))
      .lte('production_date', reference.toISOString().slice(0, 10)),
    supabase
      .from('shipping_preparations')
      .select('id, status, total_weight_oz')
      .in('status', STATUTS_EXPEDITION_SUIVIS),
  ]);

  const lignesCompagnie = lignes<MiningCompany>(compagnies);
  const lignesProduction = lignes<LigneProduction>(productions);
  const lignesExpedition = lignes<{ id: string; status: string | null; total_weight_oz: number | null }>(expeditions);

  const unavailable: string[] = [];
  if (lignesCompagnie === null) unavailable.push('les compagnies minières');
  if (lignesProduction === null) unavailable.push('la production journalière');
  if (lignesExpedition === null) unavailable.push('les expéditions');

  const listeCompagnies = lignesCompagnie || [];
  const listeProductions = lignesProduction || [];
  const listeExpeditions = lignesExpedition || [];

  const parCompagnie: Record<string, MoisProduction[]> = {
    all: agregerParMois(listeProductions, reference),
  };
  listeCompagnies.forEach((compagnie) => {
    parCompagnie[compagnie.id] = agregerParMois(
      listeProductions.filter((production) => production.mining_company_id === compagnie.id),
      reference
    );
  });

  const anneeCourante = reference.getFullYear();
  const productionAnnee = listeProductions
    .filter((production) => new Date(production.production_date).getFullYear() === anneeCourante)
    .reduce((somme, production) => somme + oncesProduction(production), 0);

  const moisPrecedent = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  const clefPrecedente = `${moisPrecedent.getFullYear()}-${String(moisPrecedent.getMonth() + 1).padStart(2, '0')}`;
  const productionMoisPrecedent = listeProductions
    .filter((production) => clefAnneeMois(production.production_date) === clefPrecedente)
    .reduce((somme, production) => somme + oncesProduction(production), 0);

  const parStatut = new Map<string, { nombre: number; onces: number }>();
  listeExpeditions.forEach((expedition) => {
    const statut = expedition.status || 'inconnu';
    const courant = parStatut.get(statut) || { nombre: 0, onces: 0 };
    courant.nombre += 1;
    courant.onces += Number(expedition.total_weight_oz || 0);
    parStatut.set(statut, courant);
  });

  const total = listeExpeditions.length;
  const etats: EtatExpedition[] = Array.from(parStatut.entries()).map(([statut, valeurs]) => ({
    statut,
    libelle: STATUTS_EXPEDITION[statut]?.libelle || statut,
    couleur: STATUTS_EXPEDITION[statut]?.couleur || '#6b7280',
    nombre: valeurs.nombre,
    onces: valeurs.onces,
    part: total > 0 ? (valeurs.nombre / total) * 100 : 0,
  }));

  return {
    compagnies: listeCompagnies,
    parCompagnie,
    expeditions: etats.sort((a, b) => b.nombre - a.nombre),
    expeditionsActives: total,
    productionAnnee,
    productionMoisPrecedent,
    unavailable,
  };
}
