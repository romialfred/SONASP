import { supabase } from '@/lib/supabase';
import { TROY_OZ_GRAMS } from '@/constants/goldConstants';

/**
 * Socle de données des tableaux de bord métier.
 *
 * Ces cinq écrans affichaient des maquettes : indicateurs, activités et graphiques
 * étaient des littéraux (numéros de lots inventés, sites en Guinée et au Mali,
 * montants en dollars). Tout est désormais lu en base, et une source indisponible
 * est annoncée plutôt que remplacée par une estimation.
 */

export interface DashboardIndicator {
  label: string;
  value: string;
  hint?: string;
}

export interface DashboardRow {
  id: string;
  reference: string;
  libelle: string;
  valeur: string;
  statut: string;
  date: string;
}

export interface SerieMensuelle {
  periode: string;
  valeur: number;
}

export interface RoleDashboardData {
  indicators: DashboardIndicator[];
  rows: DashboardRow[];
  serie: SerieMensuelle[];
  unavailable: string[];
}

export const EMPTY_ROLE_DASHBOARD: RoleDashboardData = {
  indicators: [],
  rows: [],
  serie: [],
  unavailable: [],
};

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export const nombre = (valeur: number, decimales = 2) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(valeur);

export const entier = (valeur: number) => new Intl.NumberFormat('fr-FR').format(Math.round(valeur));

/** Montant abrégé sans décimale superflue : « 4 M FCFA », pas « 4,0 M FCFA ». */
const abrege = (valeur: number, decimales: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimales }).format(valeur);

export const fcfa = (valeur: number) => {
  if (valeur >= 1_000_000_000) return `${abrege(valeur / 1_000_000_000, 2)} Mds FCFA`;
  if (valeur >= 1_000_000) return `${abrege(valeur / 1_000_000, 1)} M FCFA`;
  return `${entier(valeur)} FCFA`;
};

export const dateCourte = (valeur?: string | null) => {
  if (!valeur) return '—';
  const date = new Date(valeur);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

/** Douze derniers mois, valeurs à zéro, prêts à être alimentés. */
export function douzeMois(reference = new Date()): SerieMensuelle[] {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(reference.getFullYear(), reference.getMonth() - (11 - index), 1);
    return { periode: `${MOIS[date.getMonth()]} ${date.getFullYear()}`, valeur: 0 };
  });
}

export function clefMois(valeur?: string | null): string | null {
  if (!valeur) return null;
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? null : `${MOIS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Cumule une valeur dans la série mensuelle si le mois y figure. */
export function cumulerDansSerie(serie: SerieMensuelle[], date: string | null | undefined, valeur: number) {
  const clef = clefMois(date);
  const point = serie.find((item) => item.periode === clef);
  if (point) point.valeur += valeur;
}

/** Onces d'une ligne de production, à partir de l'estimation ou de l'or fin. */
export const oncesProduction = (ligne: { estimated_oz?: number | null; pure_gold_grams?: number | null }) =>
  Number(ligne.estimated_oz ?? 0) || Number(ligne.pure_gold_grams ?? 0) / TROY_OZ_GRAMS;

type Resultat = { data: unknown; error: unknown };

/** Lignes d'une requête, ou `null` si la source n'a pas répondu. */
export function lignes<T>(resultat: PromiseSettledResult<Resultat>): T[] | null {
  if (resultat.status !== 'fulfilled') return null;
  if (resultat.value?.error || !Array.isArray(resultat.value?.data)) return null;
  return resultat.value.data as T[];
}

const STATUTS_FR: Record<string, string> = {
  draft: 'Brouillon',
  pending: 'En attente',
  pending_approval: 'À approuver',
  submitted: 'Soumis',
  under_review: 'En revue',
  in_progress: 'En cours',
  in_transit: 'En transit',
  prepared: 'Préparé',
  shipped: 'Expédié',
  received: 'Reçu',
  completed: 'Terminé',
  approved: 'Approuvé',
  validated: 'Validé',
  rejected: 'Rejeté',
  cancelled: 'Annulé',
  paid: 'Payé',
};

export const statutFr = (statut?: string | null) => (statut ? STATUTS_FR[statut] || statut : '—');

/* ------------------------------------------------------------------ Usine */

export async function loadFactoryDashboard(): Promise<RoleDashboardData> {
  const debutSerie = new Date();
  debutSerie.setMonth(debutSerie.getMonth() - 11, 1);
  const depuis = debutSerie.toISOString().slice(0, 10);

  const [productions, preparations] = await Promise.allSettled([
    supabase
      .from('daily_production')
      .select('id, production_date, estimated_oz, pure_gold_grams, bullion_grams, status')
      .gte('production_date', depuis)
      .order('production_date', { ascending: false }),
    supabase
      .from('shipping_preparations')
      .select('id, reference_number, expedition_number, shipment_date, status, total_weight_oz, total_boxes')
      .order('shipment_date', { ascending: false })
      .limit(8),
  ]);

  const lignesProduction = lignes<{
    id: string;
    production_date: string;
    estimated_oz: number | null;
    pure_gold_grams: number | null;
    bullion_grams: number | null;
    status: string | null;
  }>(productions);
  const lignesPreparation = lignes<{
    id: string;
    reference_number: string | null;
    expedition_number: string | null;
    shipment_date: string | null;
    status: string | null;
    total_weight_oz: number | null;
    total_boxes: number | null;
  }>(preparations);

  const unavailable: string[] = [];
  if (lignesProduction === null) unavailable.push('la production journalière');
  if (lignesPreparation === null) unavailable.push('les préparations d’expédition');

  const production = lignesProduction || [];
  const prep = lignesPreparation || [];

  const serie = douzeMois();
  production.forEach((ligne) => cumulerDansSerie(serie, ligne.production_date, oncesProduction(ligne)));

  const debutMois = new Date();
  debutMois.setDate(1);
  const productionDuMois = production.filter(
    (ligne) => (ligne.production_date || '') >= debutMois.toISOString().slice(0, 10)
  );
  const oncesDuMois = productionDuMois.reduce((somme, ligne) => somme + oncesProduction(ligne), 0);
  const enAttente = prep.filter((ligne) => ['draft', 'prepared', 'pending'].includes(ligne.status || ''));

  return {
    unavailable,
    serie,
    indicators: [
      { label: 'Productions du mois', value: entier(productionDuMois.length), hint: 'Journées déclarées' },
      { label: 'Or produit ce mois', value: `${nombre(oncesDuMois)} oz`, hint: 'Or fin estimé' },
      { label: 'Expéditions à préparer', value: entier(enAttente.length), hint: 'Préparations non expédiées' },
      {
        label: 'Poids en préparation',
        value: `${nombre(prep.reduce((somme, ligne) => somme + Number(ligne.total_weight_oz || 0), 0))} oz`,
        hint: `${prep.reduce((somme, ligne) => somme + Number(ligne.total_boxes || 0), 0)} caisse(s)`,
      },
    ],
    rows: prep.map((ligne) => ({
      id: ligne.id,
      reference: ligne.reference_number || ligne.expedition_number || '—',
      libelle: `${entier(Number(ligne.total_boxes || 0))} caisse(s)`,
      valeur: `${nombre(Number(ligne.total_weight_oz || 0))} oz`,
      statut: statutFr(ligne.status),
      date: dateCourte(ligne.shipment_date),
    })),
  };
}

/* ------------------------------------------------------------------ Aéroport / expéditions */

export async function loadAirportDashboard(): Promise<RoleDashboardData> {
  const debutSerie = new Date();
  debutSerie.setMonth(debutSerie.getMonth() - 11, 1);

  const [expeditions] = await Promise.allSettled([
    supabase
      .from('freight_shipments')
      .select('id, reference_number, status, shipment_date, number_of_boxes, total_pure_gold_oz, total_value_local')
      .gte('shipment_date', debutSerie.toISOString().slice(0, 10))
      .order('shipment_date', { ascending: false }),
  ]);

  const lignesExpedition = lignes<{
    id: string;
    reference_number: string | null;
    status: string | null;
    shipment_date: string | null;
    number_of_boxes: number | null;
    total_pure_gold_oz: number | null;
    total_value_local: number | null;
  }>(expeditions);

  const unavailable = lignesExpedition === null ? ['les expéditions'] : [];
  const expeditionsRetenues = lignesExpedition || [];

  const serie = douzeMois();
  expeditionsRetenues.forEach((ligne) =>
    cumulerDansSerie(serie, ligne.shipment_date, Number(ligne.total_pure_gold_oz || 0))
  );

  const enTransit = expeditionsRetenues.filter((ligne) => ['in_transit', 'shipped'].includes(ligne.status || ''));
  const aTraiter = expeditionsRetenues.filter((ligne) =>
    ['draft', 'pending', 'pending_approval'].includes(ligne.status || '')
  );
  const receptionnees = expeditionsRetenues.filter((ligne) => ['received', 'completed'].includes(ligne.status || ''));

  return {
    unavailable,
    serie,
    indicators: [
      { label: 'Expéditions en transit', value: entier(enTransit.length), hint: 'Vers la raffinerie' },
      { label: 'En attente de traitement', value: entier(aTraiter.length), hint: 'Dossiers à instruire' },
      { label: 'Réceptionnées', value: entier(receptionnees.length), hint: 'Sur les douze derniers mois' },
      {
        label: 'Or expédié',
        value: `${nombre(expeditionsRetenues.reduce((somme, ligne) => somme + Number(ligne.total_pure_gold_oz || 0), 0))} oz`,
        hint: `${expeditionsRetenues.reduce((somme, ligne) => somme + Number(ligne.number_of_boxes || 0), 0)} caisse(s)`,
      },
    ],
    rows: expeditionsRetenues.slice(0, 8).map((ligne) => ({
      id: ligne.id,
      reference: ligne.reference_number || '—',
      libelle: `${entier(Number(ligne.number_of_boxes || 0))} caisse(s)`,
      valeur: `${nombre(Number(ligne.total_pure_gold_oz || 0))} oz`,
      statut: statutFr(ligne.status),
      date: dateCourte(ligne.shipment_date),
    })),
  };
}

/* ------------------------------------------------------------------ Raffinerie */

export async function loadRefineryDashboard(): Promise<RoleDashboardData> {
  const debutSerie = new Date();
  debutSerie.setMonth(debutSerie.getMonth() - 11, 1);

  const [expeditions, stock] = await Promise.allSettled([
    supabase
      .from('freight_shipments')
      .select('id, reference_number, status, shipment_date, total_bullion_grams, total_pure_gold_grams, total_pure_gold_oz')
      .gte('shipment_date', debutSerie.toISOString().slice(0, 10))
      .order('shipment_date', { ascending: false }),
    supabase.from('gold_inventory').select('quantity_available_oz').gt('quantity_available_oz', 0),
  ]);

  const lignesExpedition = lignes<{
    id: string;
    reference_number: string | null;
    status: string | null;
    shipment_date: string | null;
    total_bullion_grams: number | null;
    total_pure_gold_grams: number | null;
    total_pure_gold_oz: number | null;
  }>(expeditions);
  const lignesStock = lignes<{ quantity_available_oz: number | null }>(stock);

  const unavailable: string[] = [];
  if (lignesExpedition === null) unavailable.push('les lots reçus');
  if (lignesStock === null) unavailable.push('le stock affiné');

  const lots = lignesExpedition || [];
  const serie = douzeMois();
  lots.forEach((ligne) => cumulerDansSerie(serie, ligne.shipment_date, Number(ligne.total_pure_gold_oz || 0)));

  const aTraiter = lots.filter((ligne) => ['received', 'in_transit', 'shipped'].includes(ligne.status || ''));
  const traites = lots.filter((ligne) => ['completed', 'approved'].includes(ligne.status || ''));
  const bullionTotal = lots.reduce((somme, ligne) => somme + Number(ligne.total_bullion_grams || 0), 0);
  const orFinTotal = lots.reduce((somme, ligne) => somme + Number(ligne.total_pure_gold_grams || 0), 0);

  return {
    unavailable,
    serie,
    indicators: [
      { label: 'Lots à traiter', value: entier(aTraiter.length), hint: 'Reçus ou en transit' },
      { label: 'Lots traités', value: entier(traites.length), hint: 'Sur les douze derniers mois' },
      {
        // Le rendement moyen était annoncé à 95,2 % sans aucun calcul derrière.
        label: 'Teneur moyenne constatée',
        value: bullionTotal > 0 ? `${nombre((orFinTotal / bullionTotal) * 100)} %` : '—',
        hint: bullionTotal > 0 ? 'Or fin rapporté au doré' : 'Aucun lot pesé',
      },
      {
        label: 'Stock affiné disponible',
        value: `${nombre((lignesStock || []).reduce((somme, ligne) => somme + Number(ligne.quantity_available_oz || 0), 0))} oz`,
      },
    ],
    rows: lots.slice(0, 8).map((ligne) => ({
      id: ligne.id,
      reference: ligne.reference_number || '—',
      libelle: `${nombre(Number(ligne.total_bullion_grams || 0))} g doré`,
      valeur: `${nombre(Number(ligne.total_pure_gold_grams || 0))} g fin`,
      statut: statutFr(ligne.status),
      date: dateCourte(ligne.shipment_date),
    })),
  };
}

/* ------------------------------------------------------------------ Client */

export async function loadCustomerDashboard(): Promise<RoleDashboardData> {
  const debutSerie = new Date();
  debutSerie.setMonth(debutSerie.getMonth() - 11, 1);

  const [ventes] = await Promise.allSettled([
    supabase
      .from('sales')
      .select('id, sale_number, sale_date, status, quantity_oz, total_amount, gross_proceeds, customers(name)')
      .gte('sale_date', debutSerie.toISOString().slice(0, 10))
      .order('sale_date', { ascending: false }),
  ]);

  const lignesVente = lignes<{
    id: string;
    sale_number: string | null;
    sale_date: string | null;
    status: string | null;
    quantity_oz: number | null;
    total_amount: number | null;
    gross_proceeds: number | null;
    customers?: { name?: string | null } | Array<{ name?: string | null }> | null;
  }>(ventes);

  const unavailable = lignesVente === null ? ['les commandes'] : [];
  const commandes = lignesVente || [];
  const montant = (ligne: { total_amount: number | null; gross_proceeds: number | null }) =>
    Number(ligne.total_amount ?? ligne.gross_proceeds ?? 0);

  const serie = douzeMois();
  commandes.forEach((ligne) => cumulerDansSerie(serie, ligne.sale_date, montant(ligne) / 1_000_000));

  const enAttente = commandes.filter((ligne) =>
    ['draft', 'pending', 'pending_approval', 'submitted'].includes(ligne.status || '')
  );
  const livrees = commandes.filter((ligne) => ['completed', 'paid', 'approved'].includes(ligne.status || ''));

  return {
    unavailable,
    serie,
    indicators: [
      { label: 'Commandes', value: entier(commandes.length), hint: 'Sur les douze derniers mois' },
      { label: 'En attente de validation', value: entier(enAttente.length) },
      { label: 'Finalisées', value: entier(livrees.length) },
      {
        label: 'Montant total',
        value: fcfa(commandes.reduce((somme, ligne) => somme + montant(ligne), 0)),
        hint: `${nombre(commandes.reduce((somme, ligne) => somme + Number(ligne.quantity_oz || 0), 0))} oz`,
      },
    ],
    rows: commandes.slice(0, 8).map((ligne) => ({
      id: ligne.id,
      reference: ligne.sale_number || '—',
      libelle:
        (Array.isArray(ligne.customers) ? ligne.customers[0]?.name : ligne.customers?.name) || 'Client non renseigné',
      valeur: fcfa(montant(ligne)),
      statut: statutFr(ligne.status),
      date: dateCourte(ligne.sale_date),
    })),
  };
}

/* ------------------------------------------------------------------ Direction */

export async function loadManagementDashboard(): Promise<RoleDashboardData> {
  const debutSerie = new Date();
  debutSerie.setMonth(debutSerie.getMonth() - 11, 1);
  const depuis = debutSerie.toISOString().slice(0, 10);

  const [ventes, productions, clients, stock] = await Promise.allSettled([
    supabase
      .from('sales')
      .select('id, sale_number, sale_date, status, quantity_oz, total_amount, gross_proceeds, customers(name)')
      .gte('sale_date', depuis)
      .order('sale_date', { ascending: false }),
    supabase
      .from('daily_production')
      .select('production_date, estimated_oz, pure_gold_grams')
      .gte('production_date', depuis),
    supabase.from('customers').select('id, is_active'),
    supabase.from('gold_inventory').select('quantity_available_oz').gt('quantity_available_oz', 0),
  ]);

  const lignesVente = lignes<{
    id: string;
    sale_number: string | null;
    sale_date: string | null;
    status: string | null;
    quantity_oz: number | null;
    total_amount: number | null;
    gross_proceeds: number | null;
    customers?: { name?: string | null } | Array<{ name?: string | null }> | null;
  }>(ventes);
  const lignesProduction = lignes<{ production_date: string; estimated_oz: number | null; pure_gold_grams: number | null }>(
    productions
  );
  const lignesClient = lignes<{ id: string; is_active: boolean | null }>(clients);
  const lignesStock = lignes<{ quantity_available_oz: number | null }>(stock);

  const unavailable: string[] = [];
  if (lignesVente === null) unavailable.push('les ventes');
  if (lignesProduction === null) unavailable.push('la production');
  if (lignesClient === null) unavailable.push('les clients');
  if (lignesStock === null) unavailable.push('le stock');

  const commandes = lignesVente || [];
  const montant = (ligne: { total_amount: number | null; gross_proceeds: number | null }) =>
    Number(ligne.total_amount ?? ligne.gross_proceeds ?? 0);

  const serie = douzeMois();
  commandes.forEach((ligne) => cumulerDansSerie(serie, ligne.sale_date, montant(ligne) / 1_000_000));

  const debutMois = new Date();
  debutMois.setDate(1);
  const cleMois = debutMois.toISOString().slice(0, 10);
  const ventesDuMois = commandes.filter((ligne) => (ligne.sale_date || '') >= cleMois);
  const aValider = commandes.filter((ligne) =>
    ['draft', 'pending', 'pending_approval', 'submitted', 'under_review'].includes(ligne.status || '')
  );

  return {
    unavailable,
    serie,
    indicators: [
      {
        label: 'Chiffre d’affaires du mois',
        value: fcfa(ventesDuMois.reduce((somme, ligne) => somme + montant(ligne), 0)),
        hint: `${ventesDuMois.length} vente(s)`,
      },
      {
        label: 'Or produit (12 mois)',
        value: `${nombre((lignesProduction || []).reduce((somme, ligne) => somme + oncesProduction(ligne), 0))} oz`,
      },
      {
        label: 'Clients actifs',
        value: entier((lignesClient || []).filter((client) => client.is_active !== false).length),
        hint: `${(lignesClient || []).length} client(s) enregistré(s)`,
      },
      {
        label: 'Dossiers à valider',
        value: entier(aValider.length),
        hint: `Stock disponible ${nombre((lignesStock || []).reduce((somme, ligne) => somme + Number(ligne.quantity_available_oz || 0), 0))} oz`,
      },
    ],
    rows: commandes.slice(0, 8).map((ligne) => ({
      id: ligne.id,
      reference: ligne.sale_number || '—',
      libelle:
        (Array.isArray(ligne.customers) ? ligne.customers[0]?.name : ligne.customers?.name) || 'Client non renseigné',
      valeur: fcfa(montant(ligne)),
      statut: statutFr(ligne.status),
      date: dateCourte(ligne.sale_date),
    })),
  };
}
