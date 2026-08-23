import { describe, expect, it } from 'vitest';
import { DEMO_ARTISANAL_SITES, DEMO_SITE_PRODUCTIONS } from '@/test/fixtures/artisanalSites';
import type { ArtisanMinier } from '@/services/artisanMinierService';
import type { ArtisanGoldSale } from '@/services/artisanGoldSalesService';
import {
  buildMonthlyProduction,
  buildProductionFromArtisanSales,
  buildSiteInsights,
  computeGlobalCompliance,
  computeRegionContributions,
  computeSiteCompliance,
  computeVigilance,
  deriveSiteStatus,
} from './artisanalSiteInsights';

const REFERENCE = new Date('2026-08-17T09:00:00.000Z');
const insights = buildSiteInsights(DEMO_ARTISANAL_SITES, DEMO_SITE_PRODUCTIONS, REFERENCE);
const bySite = (id: string) => insights.find((insight) => insight.site.id === id)!;

describe('production reconstituée depuis les ventes des artisans', () => {
  const artisans = [
    { id: 'a1', numero_carte: 'CP-1', type_personne: 'physique', type_artisan: 'exploitant', telephone: '+226 70 00 00 01', region: 'Nord', commune: 'Kalsaka' },
    { id: 'a2', numero_carte: 'CP-2', type_personne: 'physique', type_artisan: 'collecteur', telephone: '+226 70 00 00 02', region: 'Nord', commune: 'Kalsaka' },
    { id: 'a3', numero_carte: 'CP-3', type_personne: 'physique', type_artisan: 'exploitant', telephone: '+226 70 00 00 03', region: 'Centre', commune: 'Ouagadougou' },
  ] as ArtisanMinier[];

  const sale = (overrides: Partial<ArtisanGoldSale>): ArtisanGoldSale => ({
    id: 's1',
    artisan_id: 'a1',
    date_vente: '2026-08-10',
    quantite_grammes: 1_200,
    type_or: 'poudre',
    purete_karat: 22,
    prix_kg_fcfa: 40_000_000,
    montant_brut_fcfa: 48_000_000,
    tva_taux: 18,
    tva_montant_fcfa: 8_640_000,
    taxe_dev_comm_taux: 3,
    taxe_dev_comm_montant_fcfa: 1_440_000,
    montant_total_fcfa: 58_080_000,
    statut: 'validee',
    ...overrides,
  });

  it('rattache chaque vente au site dont la localité correspond à la commune de l’artisan', () => {
    const productions = buildProductionFromArtisanSales(DEMO_ARTISANAL_SITES, artisans, [
      sale({}),
      sale({ id: 's2', artisan_id: 'a2', quantite_grammes: 800, date_vente: '2026-08-12' }),
    ]);

    expect(productions).toHaveLength(2);
    expect(productions.every((item) => item.siteId === 'site-kalsaka')).toBe(true);
    expect(productions[0].productionDate).toBe('2026-08-12');
    expect(productions[1].goldWeightGrams).toBe(1_200);
    expect(productions[1].revenueFcfa).toBe(48_000_000);
    expect(productions[1].taxesFcfa).toBe(10_080_000);
  });

  it('ignore les ventes annulées et les artisans hors site', () => {
    const productions = buildProductionFromArtisanSales(DEMO_ARTISANAL_SITES, artisans, [
      sale({ id: 's3', statut: 'annulee' }),
      sale({ id: 's4', artisan_id: 'a3' }),
    ]);

    expect(productions).toHaveLength(0);
  });

  it('alimente les agrégats du tableau de bord', () => {
    const productions = buildProductionFromArtisanSales(DEMO_ARTISANAL_SITES, artisans, [sale({})]);
    const insights = buildSiteInsights(DEMO_ARTISANAL_SITES, productions, REFERENCE);
    const kalsaka = insights.find((item) => item.site.id === 'site-kalsaka');

    expect(kalsaka?.productionKg).toBeCloseTo(1.2, 3);
    expect(kalsaka?.lastDeclaration).toBe('2026-08-10');
  });
});

describe('artisanalSiteInsights', () => {
  it('consolide production, recettes et dernière déclaration par site', () => {
    const poura = bySite('site-poura');

    expect(poura.productionKg).toBeCloseTo(50.6, 1);
    expect(poura.revenueFcfa).toBe(2_266_000_000);
    expect(poura.lastDeclaration).toBe('2026-08-02');
  });

  it('ne note pas les sites planifiés et sanctionne la suspension', () => {
    const hounde = bySite('site-hounde');
    const gorom = bySite('site-gorom');

    expect(hounde.compliance).toBeNull();
    expect(hounde.status).toBe('planned');
    expect(gorom.compliance).toBeLessThan(50);
    expect(gorom.status).toBe('suspended');
  });

  it('bascule un site actif « sous surveillance » sous le seuil de conformité', () => {
    const site = DEMO_ARTISANAL_SITES[0];
    const late = computeSiteCompliance(site, '2026-01-10', REFERENCE);

    expect(late).not.toBeNull();
    expect(late as number).toBeLessThan(80);
    expect(deriveSiteStatus(site, late)).toBe('watch');
    expect(deriveSiteStatus(site, 92)).toBe('active');
  });

  it('pénalise le dépassement de capacité autorisée', () => {
    const site = { ...DEMO_ARTISANAL_SITES[0], activeMiners: 200, authorizedMiners: 180 };

    expect(computeSiteCompliance(site, '2026-08-10', REFERENCE)).toBeLessThan(
      computeSiteCompliance(DEMO_ARTISANAL_SITES[0], '2026-08-10', REFERENCE) as number
    );
  });

  it('compte les alertes de vigilance opérationnelle', () => {
    const vigilance = computeVigilance(insights, REFERENCE);

    expect(vigilance.suspendedSites).toBe(1);
    expect(vigilance.capacityOverruns).toBe(0);
    expect(vigilance.missingDeclarations).toBe(0);
  });

  it('calcule un indice global pondéré par les artisans actifs', () => {
    const global = computeGlobalCompliance(insights);

    expect(global).toBeGreaterThan(0);
    expect(global).toBeLessThanOrEqual(100);
  });

  it('produit 12 points mensuels avec un objectif constant', () => {
    const monthly = buildMonthlyProduction(DEMO_SITE_PRODUCTIONS, 2026, 4_500);

    expect(monthly).toHaveLength(12);
    expect(monthly[7].production).toBeCloseTo(80.3, 1);
    expect(monthly.every((point) => point.objective === 375)).toBe(true);
  });

  it('répartit la contribution régionale et regroupe la traîne dans « Autres »', () => {
    const contributions = computeRegionContributions(insights);
    const total = contributions.reduce((sum, row) => sum + row.share, 0);

    expect(contributions[0].region).toBe('Boucle du Mouhoun');
    expect(contributions.some((row) => row.region === 'Autres')).toBe(true);
    expect(total).toBeGreaterThanOrEqual(99);
    expect(total).toBeLessThanOrEqual(101);
  });
});
