import { supabase } from '@/lib/supabase';
import { carteProfessionnelleService } from '@/services/carteProfessionnelleService';
import { TROY_OZ_GRAMS } from '@/constants/goldConstants';

export type TransactionStatus = 'validated' | 'control' | 'pending';

export interface DashboardTransaction {
  reference: string;
  actor: string;
  type: string;
  quantity: number;
  amount: number;
  status: TransactionStatus;
  date: string;
}

export interface MonthlyMetric {
  month: string;
  volume: number;
  value: number;
}

export type OriginShare = {
  name: string;
  value: number;
  ounces: number;
  color: string;
};

export interface NationalDashboardData {
  collectedGold: number;
  salesValue: number;
  availableStock: number;
  royalties: number;
  transactionsCount: number;
  pendingCount: number;
  monthlyMetrics: MonthlyMetric[];
  transactions: DashboardTransaction[];
  origins: OriginShare[];
  /** Variations par rapport à la période précédente de même durée, `null` si non calculables. */
  collectedGoldTrend: number | null;
  salesValueTrend: number | null;
  /** Part du stock disponible dans la collecte de la période, `null` si la collecte est nulle. */
  stockShare: number | null;
  /** Taux de redevance effectivement constaté sur les ventes, `null` si aucune vente. */
  royaltyRate: number | null;
  expiringCards: number;
  /** Artisans miniers enregistres et part encore active. */
  artisansTotal: number;
  artisansActifs: number;
  /** Sources qui n'ont pas répondu ; l'écran l'annonce au lieu d'inventer des chiffres. */
  unavailable: string[];
}

export interface RawSale {
  sale_number?: string | null;
  quantity_oz?: number | null;
  total_amount?: number | null;
  gross_proceeds?: number | null;
  royalty_amount?: number | null;
  sale_date?: string | null;
  created_at?: string | null;
  status?: string | null;
  seller_type?: string | null;
  customers?: { name?: string | null } | Array<{ name?: string | null }> | null;
}

export interface RawProduction {
  production_date?: string | null;
  estimated_oz?: number | null;
  pure_gold_grams?: number | null;
}

export interface RawInventory {
  quantity_available_oz?: number | null;
}

export const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
export const PENDING_STATUSES = new Set(['draft', 'pending', 'pending_approval', 'submitted', 'under_review']);

const ORIGIN_LABELS: Array<{ key: string; name: string; color: string }> = [
  { key: 'mining_company', name: 'Mines industrielles', color: '#dda000' },
  { key: 'stakeholder', name: 'Comptoirs', color: '#10976b' },
  { key: 'artisan', name: 'Artisans miniers', color: '#3975d6' },
];

export const EMPTY_DASHBOARD: NationalDashboardData = {
  collectedGold: 0,
  salesValue: 0,
  availableStock: 0,
  royalties: 0,
  transactionsCount: 0,
  pendingCount: 0,
  monthlyMetrics: [],
  transactions: [],
  origins: [],
  collectedGoldTrend: null,
  salesValueTrend: null,
  stockShare: null,
  royaltyRate: null,
  expiringCards: 0,
  artisansTotal: 0,
  artisansActifs: 0,
  unavailable: [],
};

/** Onces d'une ligne de production, déduites des grammes d'or fin à défaut d'estimation. */
export function productionOunces(production: RawProduction): number {
  return Number(production.estimated_oz ?? 0) || Number(production.pure_gold_grams ?? 0) / TROY_OZ_GRAMS;
}

export function saleAmount(sale: RawSale): number {
  return Number(sale.total_amount ?? sale.gross_proceeds ?? 0);
}

export function normalizeStatus(status?: string | null): TransactionStatus {
  if (!status || PENDING_STATUSES.has(status)) return 'pending';
  return ['processing', 'in_review', 'under_control'].includes(status) ? 'control' : 'validated';
}

export function customerName(customers: RawSale['customers']): string {
  return (Array.isArray(customers) ? customers[0]?.name : customers?.name) || 'SONASP';
}

export function formatTransactionDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace(',', '');
}

export function monthKey(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function createEmptyMonths(referenceDate: Date): MonthlyMetric[] {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (11 - index), 1);
    return { month: `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`, volume: 0, value: 0 };
  });
}

/**
 * Variation en pourcentage entre deux périodes.
 * `null` quand la période de référence est vide : afficher « +100 % » face à zéro
 * n'aurait aucun sens pour un indicateur national.
 */
export function variation(courant: number, precedent: number): number | null {
  if (!precedent) return null;
  return ((courant - precedent) / precedent) * 100;
}

/** Période de même durée précédant immédiatement celle retenue. */
export function previousWindow(debut: string, fin: string): { debut: string; fin: string } {
  const start = new Date(`${debut}T00:00:00`);
  const end = new Date(`${fin}T00:00:00`);
  const duree = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  const finPrecedente = new Date(start.getTime() - 86_400_000);
  const debutPrecedent = new Date(finPrecedente.getTime() - duree * 86_400_000);
  return {
    debut: debutPrecedent.toISOString().slice(0, 10),
    fin: finPrecedente.toISOString().slice(0, 10),
  };
}

/**
 * Répartition de la collecte par origine, calculée sur les ventes réelles.
 * L'écran affichait auparavant une répartition figée (62 / 24 / 14 %) sans lien
 * avec les données.
 */
export function originShares(sales: RawSale[]): OriginShare[] {
  const parOrigine = new Map<string, number>();
  sales.forEach((sale) => {
    const cle = ORIGIN_LABELS.some((origin) => origin.key === sale.seller_type)
      ? (sale.seller_type as string)
      : 'stakeholder';
    parOrigine.set(cle, (parOrigine.get(cle) || 0) + Number(sale.quantity_oz || 0));
  });

  const total = Array.from(parOrigine.values()).reduce((somme, valeur) => somme + valeur, 0);
  if (total <= 0) return [];

  return ORIGIN_LABELS.map((origin) => {
    const ounces = parOrigine.get(origin.key) || 0;
    return {
      name: origin.name,
      color: origin.color,
      ounces,
      value: Math.round((ounces / total) * 1000) / 10,
    };
  }).filter((origin) => origin.ounces > 0);
}

export function buildTransactions(sales: RawSale[], limit = 6): DashboardTransaction[] {
  return sales.slice(0, limit).map((sale, index) => ({
    reference: sale.sale_number || `VTE-${String(index + 1).padStart(4, '0')}`,
    actor: customerName(sale.customers),
    type: sale.seller_type === 'artisan' ? 'Collecte' : 'Vente locale',
    quantity: Number(sale.quantity_oz || 0),
    amount: saleAmount(sale),
    status: normalizeStatus(sale.status),
    date: formatTransactionDate(sale.sale_date || sale.created_at),
  }));
}

const SALE_COLUMNS =
  'sale_number, quantity_oz, total_amount, gross_proceeds, royalty_amount, sale_date, created_at, status, seller_type, customers(name)';

/**
 * Charge le tableau de bord national.
 * Aucune valeur n'est inventée : une source indisponible est signalée dans `unavailable`
 * et son indicateur reste à zéro, au lieu du jeu de démonstration codé en dur que
 * l'écran affichait comme s'il s'agissait de statistiques nationales réelles.
 */
export async function loadNationalDashboard(debut: string, fin: string): Promise<NationalDashboardData> {
  const debutGraphique = new Date(`${fin}T00:00:00`);
  debutGraphique.setMonth(debutGraphique.getMonth() - 11, 1);
  const precedente = previousWindow(debut, fin);

  const [ventes, productions, stock, ventesPrecedentes, productionsPrecedentes, cartes, artisans] =
    await Promise.allSettled([
    supabase.from('sales').select(SALE_COLUMNS).gte('sale_date', debut).lte('sale_date', fin).order('sale_date', { ascending: false }),
    supabase
      .from('daily_production')
      .select('production_date, estimated_oz, pure_gold_grams')
      .gte('production_date', debutGraphique.toISOString().slice(0, 10))
      .lte('production_date', fin)
      .order('production_date', { ascending: true }),
    supabase.from('gold_inventory').select('quantity_available_oz').gt('quantity_available_oz', 0),
    supabase.from('sales').select('total_amount, gross_proceeds').gte('sale_date', precedente.debut).lte('sale_date', precedente.fin),
    supabase
      .from('daily_production')
      .select('estimated_oz, pure_gold_grams')
      .gte('production_date', precedente.debut)
      .lte('production_date', precedente.fin),
    carteProfessionnelleService.getCartesExpirant(30),
    supabase.from('snp_artisans_miniers').select('actif'),
  ]);

  const lire = <T,>(resultat: PromiseSettledResult<{ data: unknown; error: unknown } | unknown>): T[] | null => {
    if (resultat.status !== 'fulfilled') return null;
    const valeur = resultat.value as { data?: unknown; error?: unknown };
    if (valeur && typeof valeur === 'object' && 'error' in valeur) {
      if (valeur.error || !Array.isArray(valeur.data)) return null;
      return valeur.data as T[];
    }
    return Array.isArray(valeur) ? (valeur as T[]) : null;
  };

  const lignesVentes = lire<RawSale>(ventes);
  const lignesProduction = lire<RawProduction>(productions);
  const lignesStock = lire<RawInventory>(stock);
  const lignesVentesPrecedentes = lire<RawSale>(ventesPrecedentes);
  const lignesProductionPrecedente = lire<RawProduction>(productionsPrecedentes);
  const lignesCartes = lire<unknown>(cartes);
  const lignesArtisans = lire<{ actif?: boolean | null }>(artisans);

  const unavailable: string[] = [];
  if (lignesVentes === null) unavailable.push('les ventes');
  if (lignesProduction === null) unavailable.push('la production');
  if (lignesStock === null) unavailable.push('le stock');
  if (lignesArtisans === null) unavailable.push('les artisans miniers');

  const ventesRetenues = lignesVentes || [];
  const productionsRetenues = lignesProduction || [];

  // Seules les productions comprises dans la période retenue alimentent l'indicateur ;
  // la requête remonte douze mois pour le graphique d'évolution.
  const productionsPeriode = productionsRetenues.filter(
    (production) => (production.production_date || '') >= debut && (production.production_date || '') <= fin
  );

  const mois = createEmptyMonths(new Date(`${fin}T00:00:00`));
  const indexMois = new Map(mois.map((metrique) => [metrique.month, metrique]));
  ventesRetenues.forEach((vente) => {
    const metrique = indexMois.get(monthKey(vente.sale_date || vente.created_at) || '');
    if (metrique) metrique.value += saleAmount(vente) / 1_000_000;
  });
  productionsRetenues.forEach((production) => {
    const metrique = indexMois.get(monthKey(production.production_date) || '');
    if (metrique) metrique.volume += productionOunces(production);
  });

  const collectedGold = productionsPeriode.reduce((somme, production) => somme + productionOunces(production), 0);
  const salesValue = ventesRetenues.reduce((somme, vente) => somme + saleAmount(vente), 0);
  const availableStock = (lignesStock || []).reduce(
    (somme, ligne) => somme + Number(ligne.quantity_available_oz || 0),
    0
  );
  const royalties = ventesRetenues.reduce((somme, vente) => somme + Number(vente.royalty_amount || 0), 0);

  const collecteePrecedente = (lignesProductionPrecedente || []).reduce(
    (somme, production) => somme + productionOunces(production),
    0
  );
  const ventesValeurPrecedente = (lignesVentesPrecedentes || []).reduce((somme, vente) => somme + saleAmount(vente), 0);

  return {
    collectedGold,
    salesValue,
    availableStock,
    royalties,
    transactionsCount: ventesRetenues.length,
    pendingCount: ventesRetenues.filter((vente) => PENDING_STATUSES.has(vente.status || '')).length,
    monthlyMetrics: mois,
    transactions: buildTransactions(ventesRetenues),
    origins: originShares(ventesRetenues),
    collectedGoldTrend: lignesProductionPrecedente === null ? null : variation(collectedGold, collecteePrecedente),
    salesValueTrend: lignesVentesPrecedentes === null ? null : variation(salesValue, ventesValeurPrecedente),
    stockShare: collectedGold > 0 ? (availableStock / collectedGold) * 100 : null,
    royaltyRate: salesValue > 0 ? (royalties / salesValue) * 100 : null,
    expiringCards: lignesCartes?.length || 0,
    artisansTotal: lignesArtisans?.length || 0,
    // `actif` absent vaut actif : la colonne a ete ajoutee apres les premiers enregistrements.
    artisansActifs: (lignesArtisans || []).filter((artisan) => artisan.actif !== false).length,
    unavailable,
  };
}
