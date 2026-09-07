import { BURKINA_PROVINCES } from '@/data/burkinaProvinces';
import type { ArtisanMinier } from '@/services/artisanMinierService';
import type { CarteProfessionnelle } from '@/services/carteProfessionnelleService';
import type { ArtisanalSite } from '@/types/artisanalSite';

export type CarteStatut = CarteProfessionnelle['statut'];

/** Statuts de carte considérés comme valides pour exercer. */
export const VALID_CARD_STATUSES: CarteStatut[] = ['validee', 'en_exploitation'];

/** Nombre total de régions administratives du Burkina Faso. */
export const TOTAL_REGIONS = 13;

export type SiteHealth = 'active' | 'planned' | 'watch' | 'control';

export const SITE_HEALTH_LABELS: Record<SiteHealth, string> = {
  active: 'Actif',
  planned: 'Planifié',
  watch: 'Surveillance',
  control: 'Contrôle requis',
};

export interface ArtisanSiteRow {
  site: ArtisanalSite;
  artisans: number;
  validCards: number;
  pending: number;
  health: SiteHealth;
  updatedAt: string;
}

export interface RegionStat {
  region: string;
  artisans: number;
  sites: number;
}

const normalize = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLocaleLowerCase('fr');

/** L'aide exploite le site de son exploitant ; aucune commune ne vaut rattachement. */
export function siteIdOfArtisan(
  artisan: ArtisanMinier,
  artisansById: ReadonlyMap<string, ArtisanMinier>,
): string | null {
  if (artisan.type_artisan !== 'aide_exploitant') return artisan.artisanal_site_id || null;
  const exploitant = artisan.exploitant_id ? artisansById.get(artisan.exploitant_id) : undefined;
  return exploitant?.type_artisan === 'exploitant' ? exploitant.artisanal_site_id || null : null;
}

/** Rattachement explicite, limité aux relations présentes dans le périmètre de lecture. */
export function artisansOfSite(
  site: ArtisanalSite,
  artisans: ArtisanMinier[],
  artisansById: ReadonlyMap<string, ArtisanMinier> = new Map(artisans.map((artisan) => [artisan.id, artisan])),
): ArtisanMinier[] {
  return artisans.filter((artisan) => siteIdOfArtisan(artisan, artisansById) === site.id);
}

/**
 * Province d'un artisan, déduite de sa commune.
 * `snp_artisans_miniers` ne porte pas de colonne province : on rattache la commune au
 * chef-lieu correspondant, sinon à la province unique de la région le cas échéant.
 */
export function provinceOfArtisan(artisan: ArtisanMinier): string | null {
  const commune = normalize(artisan.commune);
  if (commune) {
    const byCapital = BURKINA_PROVINCES.find((province) => normalize(province.capital) === commune);
    if (byCapital) return byCapital.name;
    const byName = BURKINA_PROVINCES.find((province) => normalize(province.name) === commune);
    if (byName) return byName.name;
  }

  const regionProvinces = BURKINA_PROVINCES.filter(
    (province) => normalize(province.region) === normalize(artisan.region)
  );
  return regionProvinces.length === 1 ? regionProvinces[0].name : null;
}

/** Dernière carte connue de chaque artisan, indexée par `artisan_id`. */
export function latestCardByArtisan(cards: CarteProfessionnelle[]): Map<string, CarteProfessionnelle> {
  const latest = new Map<string, CarteProfessionnelle>();
  cards.forEach((card) => {
    const current = latest.get(card.artisan_id);
    if (!current || (card.date_delivrance || '') > (current.date_delivrance || '')) {
      latest.set(card.artisan_id, card);
    }
  });
  return latest;
}

export function isValidCard(card?: CarteProfessionnelle | null): boolean {
  return Boolean(card && VALID_CARD_STATUSES.includes(card.statut));
}

/** Répartition des artisans et des sites par région (clé de la choroplèthe). */
export function buildRegionStats(artisans: ArtisanMinier[], sites: ArtisanalSite[]): RegionStat[] {
  const byRegion = new Map<string, RegionStat>();

  const ensure = (region: string) => {
    const current = byRegion.get(region) || { region, artisans: 0, sites: 0 };
    byRegion.set(region, current);
    return current;
  };

  artisans.forEach((artisan) => {
    if (!artisan.region) return;
    ensure(artisan.region).artisans += 1;
  });
  sites.forEach((site) => {
    if (site.status !== 'active') return;
    ensure(site.region).sites += 1;
  });

  return [...byRegion.values()].sort((a, b) => b.artisans - a.artisans);
}

/** Lignes du tableau « État des sites miniers ». */
export function buildSiteRows(
  sites: ArtisanalSite[],
  artisans: ArtisanMinier[],
  cards: Map<string, CarteProfessionnelle>,
  artisansById: ReadonlyMap<string, ArtisanMinier> = new Map(artisans.map((artisan) => [artisan.id, artisan])),
): ArtisanSiteRow[] {
  return sites
    .map((site) => {
      const attached = artisansOfSite(site, artisans, artisansById);
      const validCards = attached.filter((artisan) => isValidCard(cards.get(artisan.id))).length;
      const pending = attached.filter((artisan) => cards.get(artisan.id)?.statut === 'en_cours').length;
      const validRatio = attached.length > 0 ? validCards / attached.length : 1;

      let health: SiteHealth = 'active';
      if (site.status === 'suspended') health = 'control';
      else if (site.status === 'planned') health = 'planned';
      else if (validRatio < 0.75) health = 'watch';

      return { site, artisans: attached.length, validCards, pending, health, updatedAt: site.updatedAt };
    })
    .sort((a, b) => b.artisans - a.artisans);
}

/** Alias de type (et non interface) : Recharts exige un `Record<string, unknown>` compatible. */
export type TypeShare = {
  type: string;
  label: string;
  value: number;
  share: number;
  color: string;
};

const TYPE_LABELS: Record<string, string> = {
  exploitant: 'Exploitants',
  collecteur: 'Collecteurs',
  fournisseur: 'Fournisseurs',
  intermediaire: 'Intermédiaires',
  aide_exploitant: 'Aides exploitants',
};

const TYPE_COLORS: Record<string, string> = {
  exploitant: '#0f7a56',
  collecteur: '#2fae7c',
  fournisseur: '#e2a000',
  intermediaire: '#94a3b8',
  aide_exploitant: '#4884a2',
};

/** Répartition des artisans par type (anneau du bas de page). */
export function buildTypeShares(artisans: ArtisanMinier[]): TypeShare[] {
  const counters = new Map<string, number>();
  artisans.forEach((artisan) => {
    const type = artisan.type_artisan || 'exploitant';
    counters.set(type, (counters.get(type) || 0) + 1);
  });

  const total = artisans.length || 1;
  return [...counters.entries()]
    .map(([type, value]) => ({
      type,
      label: TYPE_LABELS[type] || type,
      value,
      share: Math.round((value / total) * 100),
      color: TYPE_COLORS[type] || '#94a3b8',
    }))
    .sort((a, b) => b.value - a.value);
}

export interface AdministrativeState {
  key: string;
  label: string;
  value: number;
  share: number;
  color: string;
}

/** État administratif des cartes : valides, en attente, expirées, suspendues. */
export function buildAdministrativeState(cards: CarteProfessionnelle[]): AdministrativeState[] {
  const total = cards.length || 1;
  const count = (predicate: (card: CarteProfessionnelle) => boolean) => cards.filter(predicate).length;

  const rows = [
    { key: 'valides', label: 'Cartes valides', value: count(isValidCard), color: '#0f7a56' },
    { key: 'attente', label: 'En attente', value: count((card) => card.statut === 'en_cours'), color: '#e2a000' },
    { key: 'expirees', label: 'Expirées', value: count((card) => card.statut === 'expiree'), color: '#94a3b8' },
    { key: 'suspendues', label: 'Suspendues', value: count((card) => card.statut === 'suspendue'), color: '#e4453d' },
  ];

  return rows.map((row) => ({ ...row, share: Math.round((row.value / total) * 100) }));
}

export interface RegistrationPoint {
  month: string;
  nouveaux: number;
  validees: number;
}

const MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

/** Évolution mensuelle : nouveaux artisans enregistrés vs cartes validées. */
export function buildRegistrationTrend(
  artisans: ArtisanMinier[],
  cards: CarteProfessionnelle[],
  year: number
): RegistrationPoint[] {
  const series = MONTHS.map((month) => ({ month, nouveaux: 0, validees: 0 }));

  const bump = (date: string | undefined | null, key: 'nouveaux' | 'validees') => {
    if (!date) return;
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== year) return;
    series[parsed.getMonth()][key] += 1;
  };

  artisans.forEach((artisan) => bump(artisan.created_at, 'nouveaux'));
  cards.forEach((card) => {
    if (isValidCard(card)) bump(card.validee_le || card.date_delivrance, 'validees');
  });

  return series;
}
