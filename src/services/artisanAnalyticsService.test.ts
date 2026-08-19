import { beforeEach, describe, expect, it, vi } from 'vitest';
import { artisanAnalyticsService } from './artisanAnalyticsService';
import { TROY_OZ_GRAMS } from '@/constants/goldConstants';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  tables: [] as string[],
  selects: [] as string[],
}));

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));

/**
 * Constructeur de requête minimal : chaque appel renvoie `rows` quel que soit
 * l'enchaînement de filtres, et enregistre la table et la projection demandées.
 */
function queryStub(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  ['eq', 'gte', 'lte', 'order', 'in', 'neq'].forEach((method) => {
    builder[method] = vi.fn(chain);
  });
  builder.select = vi.fn((projection?: string) => {
    mocks.selects.push(projection || '*');
    return builder;
  });
  builder.then = (resolve: (value: { data: unknown[]; error: null; count: number }) => unknown) =>
    Promise.resolve({ data: rows, error: null, count: rows.length }).then(resolve);
  return builder;
}

const ventes = [
  {
    id: 'v1',
    artisan_id: 'a1',
    statut: 'validee',
    date_vente: '2026-03-10',
    type_or: 'lingot',
    quantite_grammes: 1000,
    montant_total_fcfa: 47_600_000,
    taxe_dev_comm_montant_fcfa: 400_000,
    artisan: { region: 'Centre', numero_carte: 'CP-1', nom: 'KABORE', prenoms: 'Awa' },
  },
  {
    id: 'v2',
    artisan_id: 'a2',
    statut: 'en_attente',
    date_vente: '2026-03-12',
    type_or: 'poudre',
    quantite_grammes: 500,
    montant_total_fcfa: 22_610_000,
    taxe_dev_comm_montant_fcfa: 190_000,
    artisan: { region: 'Nord', numero_carte: 'CP-2', raison_sociale: 'BURKINA GOLD' },
  },
];

const factures = [
  {
    id: 'f1',
    artisan_id: 'a1',
    statut: 'emise',
    date_emission: '2026-03-15',
    montant_brut: 40_000_000,
    montant_taxe_tva: 7_200_000,
    montant_taxe_retenue_source: 600_000,
    montant_total_taxes: 7_800_000,
    montant_net_a_payer: 32_200_000,
    taux_tva: 18,
    taux_retenue_source: 1.5,
    vente: { taxe_dev_comm_montant_fcfa: 400_000 },
  },
];

describe('artisanAnalyticsService', () => {
  beforeEach(() => {
    mocks.tables = [];
    mocks.selects = [];
    mocks.from.mockImplementation((table: string) => {
      mocks.tables.push(table);
      return queryStub(table.includes('factures') ? factures : ventes);
    });
  });

  it('interroge les tables réellement présentes en base', async () => {
    await artisanAnalyticsService.getIndicateursCles('2026-01-01', '2026-12-31');
    await artisanAnalyticsService.getChiffreAffairesParRegion();
    await artisanAnalyticsService.getChiffreAffairesParArtisan();
    await artisanAnalyticsService.getQuantiteParType();
    await artisanAnalyticsService.getRapportTaxesRoyalties();

    // Les rapports visaient `artisan_ventes_or` / `artisan_factures_definitives`,
    // qui n'existent pas : toutes les requêtes échouaient en base.
    expect(mocks.tables.every((table) => table.startsWith('snp_'))).toBe(true);
    expect(new Set(mocks.tables)).toEqual(
      new Set(['snp_artisan_ventes_or', 'snp_artisan_factures_definitives'])
    );
    // Les jointures imbriquées visent elles aussi les tables préfixées.
    expect(mocks.selects.join(' ')).not.toMatch(/[^_]artisans_miniers/);
    expect(mocks.selects.join(' ')).toMatch(/snp_artisans_miniers/);
    // La colonne d'état civil est `prenoms`, jamais `prenom`.
    expect(mocks.selects.join(' ')).not.toMatch(/\bprenom\b/);
  });

  it('déduit les onces troy du poids en grammes', async () => {
    const indicateurs = await artisanAnalyticsService.getIndicateursCles();

    expect(indicateurs.quantite_totale_grammes).toBe(1000);
    // `quantite_onces` n'est pas stockée : la valeur était systématiquement nulle.
    expect(indicateurs.quantite_totale_onces).toBeCloseTo(1000 / TROY_OZ_GRAMS, 4);
  });

  it('assoit les royalties sur la taxe de développement communal', async () => {
    const indicateurs = await artisanAnalyticsService.getIndicateursCles();

    // L'ancienne version appliquait un forfait inventé de 3 % au total des taxes.
    expect(indicateurs.royalties_total).toBe(400_000);
    expect(indicateurs.taxes_total).toBe(7_800_000);
  });

  it('nomme les personnes morales par leur raison sociale', async () => {
    const parArtisan = await artisanAnalyticsService.getChiffreAffairesParArtisan();

    expect(parArtisan.map((ligne) => ligne.nom_complet)).toEqual(
      expect.arrayContaining(['KABORE Awa', 'BURKINA GOLD'])
    );
  });

  it('rapporte les royalties par période depuis la vente rattachée', async () => {
    const rapport = await artisanAnalyticsService.getRapportTaxesRoyalties('2026-01-01', '2026-12-31', 'mois');

    expect(rapport).toHaveLength(1);
    expect(rapport[0]).toMatchObject({
      periode: '2026-03',
      montant_total_tva: 7_200_000,
      montant_total_retenue_source: 600_000,
      montant_total_royalties: 400_000,
      taux_tva_moyen: 18,
    });
  });
});
