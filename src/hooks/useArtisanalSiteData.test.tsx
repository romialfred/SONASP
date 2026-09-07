import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useArtisanalSiteData } from './useArtisanalSiteData';

const mocks = vi.hoisted(() => ({ load: vi.fn(), key: 'first' }));
vi.mock('react-router-dom', () => ({ useLocation: () => ({ key: mocks.key }) }));
vi.mock('@/services/artisanalSiteService', () => ({
  SITE_DATA_CHANGED: 'sonasp:artisanal-site-changed', artisanalSiteService: { loadSiteData: mocks.load },
}));
describe('Actualisation des sites', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.key = 'first'; mocks.load.mockResolvedValue({ sites: [], productions: [] }); });
  it('recharge après création, retour de navigation et actualisation explicite', async () => {
    const { result, rerender } = renderHook(useArtisanalSiteData);
    await waitFor(() => expect(result.current.loading).toBe(false));
    mocks.load.mockResolvedValue({ sites: [{ id: 'new-site' }], productions: [] });
    act(() => window.dispatchEvent(new Event('sonasp:artisanal-site-changed')));
    await waitFor(() => expect(result.current.sites[0]?.id).toBe('new-site'));
    mocks.key = 'return'; rerender();
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(3));
    act(() => result.current.refresh());
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(4));
  });
  it('conserve les données sans loader ni requête lors des retours répétés dans l’onglet', async () => {
    const confirmed = { sites: [{ id: 'site-visible' }], productions: [{ id: 'production-visible' }] };
    mocks.load.mockResolvedValue(confirmed);
    const { result } = renderHook(useArtisanalSiteData);
    await waitFor(() => expect(result.current.loading).toBe(false));
    // Toute lecture supplémentaire resterait suspendue : un retour au sablier
    // ne peut donc pas être masqué par une réponse instantanée du double.
    mocks.load.mockImplementation(() => new Promise(() => undefined));
    for (let index = 0; index < 3; index += 1) {
      act(() => {
        window.dispatchEvent(new Event('blur'));
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('focus'));
        window.dispatchEvent(new Event('pageshow'));
      });
      expect(result.current.loading).toBe(false);
      expect(result.current.sites).toBe(confirmed.sites);
      expect(result.current.productions).toBe(confirmed.productions);
      expect(result.current.error).toBeNull();
    }
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });
  it('ignore une réponse ancienne arrivée après une actualisation', async () => {
    let resolveOld!: (value: unknown) => void;
    mocks.load.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
    const { result } = renderHook(useArtisanalSiteData);
    mocks.load.mockResolvedValue({ sites: [{ id: 'current' }], productions: [] });
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.sites[0]?.id).toBe('current'));
    await act(async () => resolveOld({ sites: [{ id: 'old' }], productions: [] }));
    expect(result.current.sites[0]?.id).toBe('current');
  });
});
