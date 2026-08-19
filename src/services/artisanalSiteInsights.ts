import type { TerritoryStatus } from '@/components/artisanal-sites/BurkinaTerritoryMap';
import type { ArtisanMinier } from '@/services/artisanMinierService';
import type { ArtisanGoldSale } from '@/services/artisanGoldSalesService';
import type { ArtisanalSite, SiteProduction } from '@/types/artisanalSite';

/** Seuil d'indice de conformité en dessous duquel un site actif passe « sous surveillance ». */
export const COMPLIANCE_WATCH_THRESHOLD = 80;

/** Nombre de jours au-delà duquel une déclaration de production est considérée en retard. */
export const DECLARATION_GRACE_DAYS = 30;

/** Objectif national annuel de production artisanale déclarée (kg). */
export const ANNUAL_PRODUCTION_TARGET_KG = 4_500;

export interface SiteInsight {
  site: ArtisanalSite;
  productionKg: number;
  revenueFcfa: number;
  taxesFcfa: number;
  lastDeclaration: string | null;
  /** Indice de conformité 0-100 ; `null` pour un site planifié (pas encore exploité). */
  compliance: number | null;
  status: TerritoryStatus;
  occupancy: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const daysSince = (date: string | null, reference: Date) => {
  if (!date) return Number.POSITIVE_INFINITY;
  const parsed = new Date(date).getTime();
  if (Number.isNaN(parsed)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (reference.getTime() - parsed) / DAY_MS);
};

/**
 * Indice de conformité d'un site (0-100).
 * Pénalise le dépassement de capacité autorisée, la sous-activité, le retard de
 * déclaration et la suspension administrative. Un site planifié n'est pas noté.
 */
export function computeSiteCompliance(
  site: ArtisanalSite,
  lastDeclaration: string | null,
  reference: Date
): number | null {
  if (site.status === 'planned') return null;

  let score = 100;
  const occupancy = site.authorizedMiners > 0 ? site.activeMiners / site.authorizedMiners : 0;

  if (occupancy > 1) score -= Math.min(25, (occupancy - 1) * 100);
  else if (occupancy < 0.5) score -= 8;

  const delay = daysSince(lastDeclaration, reference);
  if (delay > DECLARATION_GRACE_DAYS) {
    score -= Math.min(30, (delay - DECLARATION_GRACE_DAYS) / 3);
  }

  if (site.status === 'suspended') score -= 45;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Statut cartographique dérivé du statut administratif et de l'indice de conformité. */
export function deriveSiteStatus(site: ArtisanalSite, compliance: number | null): TerritoryStatus {
  if (site.status === 'suspended') return 'suspended';
  if (site.status === 'planned') return 'planned';
  return compliance !== null && compliance < COMPLIANCE_WATCH_THRESHOLD ? 'watch' : 'active';
}

/** Consolide, pour chaque site, sa production, ses recettes et sa conformité. */
export function buildSiteInsights(
  sites: ArtisanalSite[],
  productions: SiteProduction[],
  reference: Date = new Date()
): SiteInsight[] {
  return sites.map((site) => {
    const siteProductions = productions.filter((production) => production.siteId === site.id);
    const lastDeclaration = siteProductions.reduce<string | null>((latest, production) => {
      if (!latest) return production.productionDate;
      return production.productionDate > latest ? production.productionDate : latest;
    }, null);
    const compliance = computeSiteCompliance(site, lastDeclaration, reference);

    return {
      site,
      productionKg:
        siteProductions.reduce((total, production) => total + production.goldWeightGrams, 0) / 1000,
      revenueFcfa: siteProductions.reduce((total, production) => total + production.revenueFcfa, 0),
      taxesFcfa: siteProductions.reduce((total, production) => total + production.taxesFcfa, 0),
      lastDeclaration,
      compliance,
      status: deriveSiteStatus(site, compliance),
      occupancy: site.authorizedMiners > 0 ? site.activeMiners / site.authorizedMiners : 0,
    };
  });
}

const normalizeLocality = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLocaleLowerCase('fr');

/**
 * La production d'un site n'est jamais saisie : c'est la somme des ventes d'or
 * déclarées par les artisans qui y sont rattachés (commune de l'artisan = localité
 * du site, seule clé de jointure disponible aujourd'hui).
 *
 * Chaque vente devient une ligne de production du site, ce qui permet de conserver
 * l'historique daté et les agrégats existants.
 */
export function buildProductionFromArtisanSales(
  sites: ArtisanalSite[],
  artisans: ArtisanMinier[],
  sales: ArtisanGoldSale[]
): SiteProduction[] {
  const siteByLocality = new Map(sites.map((site) => [normalizeLocality(site.locality), site]));
  const siteByArtisan = new Map<string, ArtisanalSite>();
  artisans.forEach((artisan) => {
    const site = siteByLocality.get(normalizeLocality(artisan.commune));
    if (site) siteByArtisan.set(artisan.id, site);
  });

  return sales
    .filter((sale) => sale.statut !== 'annulee' && siteByArtisan.has(sale.artisan_id))
    .map((sale) => {
      const site = siteByArtisan.get(sale.artisan_id)!;
      const taxes =
        Number(sale.tva_montant_fcfa || 0) + Number(sale.taxe_dev_comm_montant_fcfa || 0);
      return {
        id: `sale-${sale.id}`,
        siteId: site.id,
        productionDate: (sale.date_vente || sale.created_at || '').slice(0, 10),
        goldWeightGrams: Number(sale.quantite_grammes || 0),
        revenueFcfa: Number(sale.montant_brut_fcfa || sale.montant_total_fcfa || 0),
        taxesFcfa: taxes,
        artisanCount: 1,
        notes: sale.numero_recu ? `Reçu ${sale.numero_recu}` : undefined,
        createdAt: sale.created_at || sale.date_vente || '',
      };
    })
    .sort((a, b) => b.productionDate.localeCompare(a.productionDate));
}

export interface VigilanceCounters {
  permitsToRenew: number;
  missingDeclarations: number;
  capacityOverruns: number;
  suspendedSites: number;
}

/**
 * Compteurs du bloc « Vigilance opérationnelle ».
 * `permitsToRenew` : fiches de site non actualisées depuis plus de 12 mois.
 */
export function computeVigilance(
  insights: SiteInsight[],
  reference: Date = new Date()
): VigilanceCounters {
  return {
    permitsToRenew: insights.filter((insight) => daysSince(insight.site.updatedAt, reference) > 365)
      .length,
    missingDeclarations: insights.filter(
      (insight) =>
        insight.site.status === 'active' &&
        daysSince(insight.lastDeclaration, reference) > DECLARATION_GRACE_DAYS
    ).length,
    capacityOverruns: insights.filter((insight) => insight.occupancy > 1).length,
    suspendedSites: insights.filter((insight) => insight.site.status === 'suspended').length,
  };
}

/** Indice de conformité global : moyenne des sites notés, pondérée par les artisans actifs. */
export function computeGlobalCompliance(insights: SiteInsight[]): number {
  const scored = insights.filter((insight) => insight.compliance !== null);
  if (scored.length === 0) return 0;

  const totalWeight = scored.reduce(
    (total, insight) => total + Math.max(1, insight.site.activeMiners),
    0
  );
  const weighted = scored.reduce(
    (total, insight) => total + (insight.compliance || 0) * Math.max(1, insight.site.activeMiners),
    0
  );
  return Math.round(weighted / totalWeight);
}

export interface MonthlyProductionPoint {
  month: string;
  production: number;
  objective: number;
}

const MONTH_LABELS = ['Jan.', 'Fév.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

/** Série mensuelle production déclarée vs objectif, sur l'année civile de référence. */
export function buildMonthlyProduction(
  productions: SiteProduction[],
  year: number,
  annualTargetKg: number = ANNUAL_PRODUCTION_TARGET_KG
): MonthlyProductionPoint[] {
  const monthly = MONTH_LABELS.map((month) => ({
    month,
    production: 0,
    objective: Math.round((annualTargetKg / 12) * 10) / 10,
  }));

  productions.forEach((production) => {
    const date = new Date(production.productionDate);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year) return;
    monthly[date.getMonth()].production += production.goldWeightGrams / 1000;
  });

  return monthly.map((point) => ({
    ...point,
    production: Math.round(point.production * 10) / 10,
  }));
}

export interface RegionContribution {
  region: string;
  share: number;
  revenueFcfa: number;
  artisans: number;
  sites: number;
}

/** Contribution de chaque région au chiffre d'affaires, top `limit` puis « Autres ». */
export function computeRegionContributions(insights: SiteInsight[], limit = 4): RegionContribution[] {
  const byRegion = new Map<string, RegionContribution>();

  insights.forEach((insight) => {
    const current = byRegion.get(insight.site.region) || {
      region: insight.site.region,
      share: 0,
      revenueFcfa: 0,
      artisans: 0,
      sites: 0,
    };
    current.revenueFcfa += insight.revenueFcfa;
    current.artisans += insight.site.activeMiners;
    current.sites += 1;
    byRegion.set(insight.site.region, current);
  });

  const rows = [...byRegion.values()].sort((a, b) => b.revenueFcfa - a.revenueFcfa);
  const total = rows.reduce((sum, row) => sum + row.revenueFcfa, 0);
  const head = rows.slice(0, limit);
  const tail = rows.slice(limit);

  const withShare = head.map((row) => ({
    ...row,
    share: total > 0 ? Math.round((row.revenueFcfa / total) * 100) : 0,
  }));

  if (tail.length > 0) {
    const revenueFcfa = tail.reduce((sum, row) => sum + row.revenueFcfa, 0);
    withShare.push({
      region: 'Autres',
      revenueFcfa,
      artisans: tail.reduce((sum, row) => sum + row.artisans, 0),
      sites: tail.reduce((sum, row) => sum + row.sites, 0),
      share: total > 0 ? Math.round((revenueFcfa / total) * 100) : 0,
    });
  }

  return withShare;
}
