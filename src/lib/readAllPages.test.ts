import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { readAllPages } from './readAllPages';

describe('readAllPages — contrat de lecture exhaustive', () => {
  it('ne confond pas une dernière tranche pleine avec une liste incomplète', async () => {
    const data = Array.from({ length: 500 }, (_, id) => ({ id: String(id) }));
    const query = vi.fn().mockResolvedValue({ data, count: 500, error: null });
    expect(await readAllPages(query)).toEqual(data);
    expect(query).toHaveBeenCalledExactlyOnceWith(0, 499);
  });
  it.each([null, undefined, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('refuse un total non exact : %s', async count => {
    const query = vi.fn().mockResolvedValue({ data: [], count, error: null });
    await expect(readAllPages(query)).rejects.toThrow('La lecture complète');
    expect(query).toHaveBeenCalledOnce();
  });
  it.each([
    { data: [{ id: 'a' }], count: 0 },
    { data: [], count: 1 },
    { data: Array.from({ length: 501 }, (_, id) => ({ id: String(id) })), count: 501 },
  ])('refuse une tranche incompatible avec le total ou la plage', async reply => {
    await expect(readAllPages(vi.fn().mockResolvedValue({ ...reply, error: null }))).rejects.toThrow('incomplète');
  });
  it.each([[{ id: 'a' }, { id: 'a' }], [{ id: '' }], [{}], [null]].map(data => ({ data })))('refuse les identifiants absents ou répétés', async ({ data }) => {
    await expect(readAllPages(vi.fn().mockResolvedValue({ data, count: data.length, error: null }))).rejects.toThrow('incohérente');
  });
  it('propage le rejet réseau et ne renvoie aucune tranche intermédiaire', async () => {
    const failure = new Error('Réseau indisponible');
    const query = vi.fn().mockResolvedValueOnce({ data: [{ id: 'a' }], count: 2, error: null }).mockRejectedValueOnce(failure);
    await expect(readAllPages(query)).rejects.toBe(failure);
  });
  it('conserve le tri, le filtre et le total avec le véritable client PostgREST sur un transport local simulé', async () => {
    const calls: URL[] = [];
    const headers: Headers[] = [];
    // Reserved .invalid domain; fetch is entirely replaced, so no network runs.
    const client = createClient('https://lecture-volume.invalid', 'cle-fictive-locale', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: async (input, init) => {
        const url = new URL(String(input)); calls.push(url); headers.push(new Headers(init?.headers));
        const offset = Number(url.searchParams.get('offset') ?? 0);
        const data = [{ id: String(offset), artisan_id: 'artisan-visible' }];
        return new Response(JSON.stringify(data), { status: 206, headers: { 'content-type': 'application/json', 'content-range': `${offset}-${offset}/3` } });
      } },
    });
    const data = await readAllPages((from, to) => client.from('snp_artisan_ventes_or')
      .select('id,artisan_id', { count: 'exact' }).eq('artisan_id', 'artisan-visible')
      .order('date_vente', { ascending: false }).order('id').range(from, to));
    expect(data.map(row => row.id)).toEqual(['0', '1', '2']);
    expect(calls.map(url => url.searchParams.get('offset'))).toEqual(['0', '1', '2']);
    for (const url of calls) {
      expect(url.searchParams.get('limit')).toBe('500');
      expect(url.searchParams.get('order')).toBe('date_vente.desc,id.asc');
      expect(url.searchParams.get('artisan_id')).toBe('eq.artisan-visible');
    }
    expect(headers.every(header => header.get('prefer') === 'count=exact')).toBe(true);
  });
});
