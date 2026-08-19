import { describe, expect, it } from 'vitest';
import { DEMO_ARTISANAL_SITES } from '@/data/artisanalSitesData';
import type { ArtisanMinier } from './artisanMinierService';
import type { CarteProfessionnelle } from './carteProfessionnelleService';
import {
  buildAdministrativeState,
  buildRegionStats,
  buildRegistrationTrend,
  buildSiteRows,
  buildTypeShares,
  latestCardByArtisan,
} from './artisanTerritoryInsights';

const artisan = (id: string, overrides: Partial<ArtisanMinier> = {}): ArtisanMinier => ({
  id,
  numero_carte: `CP-${id}`,
  type_personne: 'physique',
  type_artisan: 'exploitant',
  telephone: '+226 70 00 00 00',
  region: 'Nord',
  commune: 'Kalsaka',
  created_at: '2026-03-04T10:00:00.000Z',
  ...overrides,
});

const card = (
  artisanId: string,
  statut: CarteProfessionnelle['statut'],
  overrides: Partial<CarteProfessionnelle> = {}
): CarteProfessionnelle => ({
  id: `carte-${artisanId}-${statut}`,
  artisan_id: artisanId,
  numero_carte: `CP-${artisanId}`,
  statut,
  date_delivrance: '2026-02-01',
  date_expiration: '2027-02-01',
  ...overrides,
});

const artisans = [
  artisan('a1'),
  artisan('a2'),
  artisan('a3', { commune: 'Poura', region: 'Boucle du Mouhoun', type_artisan: 'collecteur' }),
  artisan('a4', { commune: 'Gaoua', region: 'Sud-Ouest', type_artisan: 'fournisseur' }),
];

const cards = [
  card('a1', 'validee'),
  card('a2', 'en_cours'),
  card('a3', 'en_exploitation'),
  card('a4', 'expiree'),
  card('a1', 'suspendue', { date_delivrance: '2025-01-01' }),
];

describe('artisanTerritoryInsights', () => {
  it('retient la carte la plus récente de chaque artisan', () => {
    const latest = latestCardByArtisan(cards);

    expect(latest.size).toBe(4);
    expect(latest.get('a1')?.statut).toBe('validee');
  });

  it('agrège les artisans et les sites actifs par région', () => {
    const stats = buildRegionStats(artisans, DEMO_ARTISANAL_SITES);
    const nord = stats.find((stat) => stat.region === 'Nord');

    expect(nord?.artisans).toBe(2);
    expect(nord?.sites).toBe(1);
    expect(stats.find((stat) => stat.region === 'Sahel')?.sites).toBeUndefined();
  });

  it('rattache les artisans aux sites par la localité et note l’état du site', () => {
    const rows = buildSiteRows(DEMO_ARTISANAL_SITES, artisans, latestCardByArtisan(cards));
    const kalsaka = rows.find((row) => row.site.id === 'site-kalsaka');
    const gorom = rows.find((row) => row.site.id === 'site-gorom');
    const gaoua = rows.find((row) => row.site.id === 'site-gaoua');

    expect(kalsaka?.artisans).toBe(2);
    expect(kalsaka?.validCards).toBe(1);
    expect(kalsaka?.pending).toBe(1);
    expect(kalsaka?.health).toBe('watch');
    expect(gaoua?.health).toBe('watch');
    expect(gorom?.health).toBe('control');
  });

  it('calcule la répartition par type d’artisan', () => {
    const shares = buildTypeShares(artisans);

    expect(shares[0].label).toBe('Exploitants');
    expect(shares[0].share).toBe(50);
    expect(shares.reduce((sum, share) => sum + share.value, 0)).toBe(4);
  });

  it('calcule l’état administratif des cartes', () => {
    const state = buildAdministrativeState(cards);

    expect(state.find((row) => row.key === 'valides')?.value).toBe(2);
    expect(state.find((row) => row.key === 'attente')?.value).toBe(1);
    expect(state.find((row) => row.key === 'expirees')?.value).toBe(1);
    expect(state.find((row) => row.key === 'suspendues')?.value).toBe(1);
  });

  it('construit la série mensuelle des enregistrements', () => {
    const trend = buildRegistrationTrend(artisans, cards, 2026);

    expect(trend).toHaveLength(12);
    expect(trend[2].nouveaux).toBe(4);
    expect(trend[1].validees).toBe(2);
  });
});
