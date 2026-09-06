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
  it('recharge après création, retour de navigation et retour dans la fenêtre', async () => {
    const { result, rerender } = renderHook(useArtisanalSiteData);
    await waitFor(() => expect(result.current.loading).toBe(false));
    mocks.load.mockResolvedValue({ sites: [{ id: 'new-site' }], productions: [] });
    act(() => window.dispatchEvent(new Event('sonasp:artisanal-site-changed')));
    await waitFor(() => expect(result.current.sites[0]?.id).toBe('new-site'));
    mocks.key = 'return'; rerender();
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(3));
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(4));
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
