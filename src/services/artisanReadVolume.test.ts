import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { artisanMinierService } from './artisanMinierService';
import { artisanGoldSalesService } from './artisanGoldSalesService';
import { artisanalSiteService } from './artisanalSiteService';
import { carteProfessionnelleService } from './carteProfessionnelleService';

const api = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: api.from } }));

type Row = Record<string, unknown> & { id: string };
type Request = { table: string; columns?: string; exact: boolean; filters: [string, unknown][]; orders: [string, boolean][]; from: number; to?: number; single: boolean };
type Reply = { data: Row[] | Row | null; error: Error | null; count: number | null };
let tables: Record<string, Row[]>;
let requests: Request[];
let cap: number;
let alter: ((request: Request, reply: Reply) => Reply) | undefined;
const rows = (size: number, prefix = 'row'): Row[] => Array.from({ length: size }, (_, index) => ({
  id: `${prefix}-${String(index).padStart(5, '0')}`, created_at: '2026-09-07', date_vente: '2026-09-07', name: 'Même nom',
}));

beforeEach(() => {
  cap = 1000; requests = []; alter = undefined;
  tables = { snp_artisans_miniers: [], snp_artisan_ventes_or: [], artisanal_sites: [], artisanal_site_assignments: [], snp_cartes_professionnelles: [] };
  api.from.mockImplementation((table: string) => {
    const request: Request = { table, filters: [], orders: [], from: 0, exact: false, single: false };
    const execute = () => {
      requests.push(structuredClone(request));
      const visible = (tables[table] ?? []).filter(row => request.filters.every(([key, value]) => row[key] === value));
      visible.sort((left, right) => {
        for (const [key, ascending] of request.orders) {
          const comparison = String(left[key] ?? '').localeCompare(String(right[key] ?? ''));
          if (comparison) return ascending ? comparison : -comparison;
        }
        return 0;
      });
      const reply: Reply = { data: request.single ? visible[0] ?? null : visible.slice(request.from, request.from + Math.min(cap, request.to === undefined ? cap : request.to - request.from + 1)), error: null, count: request.exact ? visible.length : null };
      return alter ? alter(request, reply) : reply;
    };
    const query = {
      select(columns: string, options?: { count: string }) { request.columns = columns; request.exact = options?.count === 'exact'; return query; },
      order(key: string, options?: { ascending?: boolean }) { request.orders.push([key, options?.ascending !== false]); return query; },
      eq(key: string, value: unknown) { request.filters.push([key, value]); return query; },
      range(from: number, to: number) { request.from = from; request.to = to; return query; },
      maybeSingle() { request.single = true; return query; },
      then(resolve: (value: Reply) => unknown, reject: (reason: unknown) => unknown) { return Promise.resolve().then(execute).then(resolve, reject); },
    };
    return query;
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const readers = [
  { label: 'artisans', table: 'snp_artisans_miniers', read: () => artisanMinierService.getAll() },
  { label: 'ventes nationales', table: 'snp_artisan_ventes_or', read: () => artisanGoldSalesService.getAll() },
  { label: 'ventes par artisan', table: 'snp_artisan_ventes_or', read: () => artisanGoldSalesService.getByArtisan('artisan-cible') },
  { label: 'sites', table: 'artisanal_sites', read: () => artisanalSiteService.listSites() },
  { label: 'cartes professionnelles', table: 'snp_cartes_professionnelles', read: () => carteProfessionnelleService.getAllCartes() },
];

describe.each(readers)('LECT-VOL-006 — $label', ({ table, read }) => {
  it.each([0, 1, 499, 500, 501, 999, 1000, 1001, 1500])('restitue les %i lignes visibles sans troncature', async size => {
    tables[table] = rows(size).map(row => ({ ...row, artisan_id: 'artisan-cible' })).reverse();
    const result = await read();
    expect(result).toHaveLength(size);
    expect(new Set(result!.map(row => row.id)).size).toBe(size);
    expect(result!.map(row => row.id)).toEqual(rows(size).map(row => row.id));
    for (const request of requests.filter(request => request.table === table)) {
      expect(request.orders.at(-1)).toEqual(['id', true]);
      expect(request.exact).toBe(true);
    }
  });
  it('supporte un plafond REST inférieur à la tranche demandée', async () => {
    cap = 73; tables[table] = rows(601).map(row => ({ ...row, artisan_id: 'artisan-cible' }));
    expect(await read()).toHaveLength(601);
    expect(requests.filter(request => request.table === table).map(request => request.from)).toEqual([0, 73, 146, 219, 292, 365, 438, 511, 584]);
  });
  it('propage une erreur sur une page ultérieure sans retourner le début de liste', async () => {
    tables[table] = rows(1001).map(row => ({ ...row, artisan_id: 'artisan-cible' }));
    const failure = new Error('Lecture refusée');
    alter = (request, reply) => request.table === table && request.from > 0 ? { ...reply, error: failure, data: null } : reply;
    await expect(read()).rejects.toBe(failure);
  });
  it.each(['null', 'total absent', 'page vide', 'total changé', 'doublon'])('refuse une réponse incomplète : %s', async failure => {
    tables[table] = rows(1001).map(row => ({ ...row, artisan_id: 'artisan-cible' }));
    alter = (request, reply) => {
      if (request.table !== table) return reply;
      if (failure === 'null') return { ...reply, data: null };
      if (failure === 'total absent') return { ...reply, count: null };
      if (request.from === 0) return reply;
      if (failure === 'page vide') return { ...reply, data: [] };
      if (failure === 'total changé') return { ...reply, count: 1002 };
      return { ...reply, data: [tables[table][0]] };
    };
    await expect(read()).rejects.toThrow();
  });
});

describe('Relations et lectures unitaires', () => {
  it('applique les filtres historiques de cartes après lecture de toutes les tranches visibles', async () => {
    tables.snp_cartes_professionnelles = rows(1003).map((row, i) => ({
      ...row, statut: i === 1002 ? 'annulee' : 'validee',
      artisan: { type_artisan: i < 1000 ? 'collecteur' : 'exploitant', mining_company_id: 'mine-cible' },
    }));
    const cards = await carteProfessionnelleService.getAllCartes({ statut: 'validee', type_artisan: 'exploitant', mining_company_id: 'mine-cible' });
    expect(cards.map(card => card.id)).toEqual(['row-01000', 'row-01001']);
    for (const request of requests) {
      expect(request.filters).toEqual([['statut', 'validee']]);
      expect(request.columns).toContain('artisan:snp_artisans_miniers(*)');
    }
  });
  it('conserve le filtre artisan et la relation historique sur toutes les pages', async () => {
    cap = 2;
    tables.snp_artisan_ventes_or = rows(7).map((row, i) => ({ ...row, artisan_id: i === 0 ? 'autre' : 'artisan-cible', attribution_site: i === 6 ? null : { site_id: i === 5 ? null : 'site-original' } }));
    const sales = await artisanGoldSalesService.getByArtisan('artisan-cible');
    expect(sales).toHaveLength(6);
    expect(sales.map(sale => sale.attribution_site_id)).toEqual(['site-original', 'site-original', 'site-original', 'site-original', null, undefined]);
    expect(sales.every(sale => sale.tva_montant_fcfa === 0 && sale.statut === 'en_attente')).toBe(true);
    for (const request of requests) {
      expect(request.filters).toEqual([['artisan_id', 'artisan-cible']]);
      expect(request.columns).toBe('*, attribution_site:snp_artisan_vente_site_origins(site_id)');
    }
  });
  it('conserve les tris métier avant le départage par identifiant', async () => {
    tables.snp_artisans_miniers = [
      { id: 'a', created_at: '2026-01-01' }, { id: 'z', created_at: '2026-09-07' },
    ];
    tables.snp_artisan_ventes_or = [
      { id: 'a', date_vente: '2026-01-01' }, { id: 'z', date_vente: '2026-09-07' },
    ];
    tables.artisanal_sites = [{ id: 'a', name: 'Ziga' }, { id: 'z', name: 'Bobo' }];
    expect((await artisanMinierService.getAll()).map(row => row.id)).toEqual(['z', 'a']);
    expect((await artisanGoldSalesService.getAll()).map(row => row.id)).toEqual(['z', 'a']);
    expect((await artisanalSiteService.listSites()).map(row => row.id)).toEqual(['z', 'a']);
  });
  it('récupère aussi les affectations après le plafond REST', async () => {
    tables.artisanal_sites = [{ id: 'site-cible', name: 'Nom véritable' }];
    tables.artisanal_site_assignments = [...rows(1001, 'affectation').map(row => ({ ...row, site_id: 'autre', role: 'site_manager' })), { id: 'zzz', site_id: 'site-cible', role: 'site_manager', full_name: 'Responsable cible' }];
    expect((await artisanalSiteService.listSites())[0].manager.fullName).toBe('Responsable cible');
  });
  it('rejette la liste entière si une page des affectations échoue', async () => {
    tables.artisanal_sites = [{ id: 'site-cible' }];
    tables.artisanal_site_assignments = rows(1001);
    alter = (request, reply) => request.table === 'artisanal_site_assignments' && request.from > 0 ? { ...reply, error: new Error('Affectations indisponibles') } : reply;
    await expect(artisanalSiteService.listSites()).rejects.toThrow('Affectations indisponibles');
  });
  it('retrouve directement un site au-delà de la première tranche et filtre ses affectations', async () => {
    tables.artisanal_sites = [...rows(1100), { id: 'zzz-cible', name: 'Site cible' }];
    tables.artisanal_site_assignments = [{ id: 'a', site_id: 'autre', role: 'site_manager', full_name: 'Autre' }, { id: 'b', site_id: 'zzz-cible', role: 'site_manager', full_name: 'Responsable' }];
    const site = await artisanalSiteService.getSite('zzz-cible');
    expect(site?.name).toBe('Site cible');
    expect(site?.manager.fullName).toBe('Responsable');
    expect(requests.filter(request => request.table === 'artisanal_sites')).toEqual([expect.objectContaining({ filters: [['id', 'zzz-cible']], single: true })]);
    expect(requests.filter(request => request.table === 'artisanal_site_assignments').every(request => request.filters.some(([key, value]) => key === 'site_id' && value === 'zzz-cible'))).toBe(true);
  });
  it('ne déclare absent que le site réellement absent ou non visible au lecteur', async () => {
    expect(await artisanalSiteService.getSite('absent')).toBeNull();
    expect(requests).toHaveLength(1);
  });
  it('pagine les affectations du détail sans perdre le filtre du site', async () => {
    cap = 1;
    tables.artisanal_sites = [{ id: 'site-cible' }];
    tables.artisanal_site_assignments = [
      { id: 'a', site_id: 'site-cible', role: 'site_manager', full_name: 'Responsable' },
      { id: 'b', site_id: 'site-cible', role: 'collection_officer', full_name: 'Agent de collecte' },
      { id: 'c', site_id: 'autre', role: 'collection_officer', full_name: 'Autre agent' },
    ];
    const site = await artisanalSiteService.getSite('site-cible');
    expect(site?.manager.fullName).toBe('Responsable');
    expect(site?.collectionOfficer.fullName).toBe('Agent de collecte');
    const assignmentsRequests = requests.filter(request => request.table === 'artisanal_site_assignments');
    expect(assignmentsRequests).toHaveLength(2);
    expect(assignmentsRequests.every(request => request.filters.some(([key, value]) => key === 'site_id' && value === 'site-cible'))).toBe(true);
  });
  it.each(['artisanal_sites', 'artisanal_site_assignments'])('propage un échec du détail (%s) au lieu de retourner null', async table => {
    tables.artisanal_sites = [{ id: 'site-cible' }];
    alter = (request, reply) => request.table === table ? { ...reply, error: new Error('Lecture inaccessible'), data: null } : reply;
    await expect(artisanalSiteService.getSite('site-cible')).rejects.toThrow('Lecture inaccessible');
  });
  it('ne publie aucun agrégat du pipeline si une page de ventes échoue', async () => {
    tables.snp_artisan_ventes_or = rows(1001);
    alter = (request, reply) => request.table === 'snp_artisan_ventes_or' && request.from > 0 ? { ...reply, error: new Error('Ventes indisponibles') } : reply;
    await expect(artisanalSiteService.loadSiteData()).rejects.toThrow('Ventes indisponibles');
  });
});
