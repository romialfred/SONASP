import { beforeEach, describe, expect, it, vi } from 'vitest';
import { artisanalSiteService, SITE_DATA_CHANGED } from './artisanalSiteService';
import { DEMO_ARTISANAL_SITES } from '@/test/fixtures/artisanalSites';
import { emptyAea } from '@/lib/siteFormalization';
import type { ArtisanalSiteInput } from '@/types/artisanalSite';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), remove: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/services/siteAeaDocumentService', () => ({ siteAeaDocumentService: mocks }));
const input: ArtisanalSiteInput = { ...DEMO_ARTISANAL_SITES[0], formalization: 'non_formalized' };
describe('Sauvegarde atomique du site', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockImplementation(async (_name, args) => ({ data: { site: args.p_site, assignments: args.p_assignments.map((contact: object) => ({ ...contact, site_id: args.p_site.id })) }, error: null }));
    mocks.upload.mockResolvedValue({ documentPath: `${input.id}/aea.pdf`, documentName: 'aea.pdf' });
    mocks.remove.mockResolvedValue(undefined);
  });
  it('sauvegarde site et responsables dans un appel, puis notifie les vues ouvertes', async () => {
    const changed = vi.fn(); window.addEventListener(SITE_DATA_CHANGED, changed);
    try {
      const saved = await artisanalSiteService.saveSite(input);
      expect(mocks.rpc).toHaveBeenCalledOnce();
      expect(mocks.rpc).toHaveBeenCalledWith('snp_save_artisanal_site', expect.objectContaining({ p_assignments: expect.arrayContaining([expect.objectContaining({ role: 'site_manager' }), expect.objectContaining({ role: 'collection_officer' })]) }));
      expect(saved.manager.fullName).toBe(input.manager.fullName);
      expect(saved.formalization).toBe('non_formalized');
      expect(changed).toHaveBeenCalledOnce();
    } finally { window.removeEventListener(SITE_DATA_CHANGED, changed); }
  });
  it('refuse une catégorie absente ou un site formalisé sans document avant toute écriture', async () => {
    await expect(artisanalSiteService.saveSite({ ...input, formalization: null })).rejects.toThrow(/catégorie/);
    await expect(artisanalSiteService.saveSite({ ...input, formalization: 'formalized', aea: { ...emptyAea(), number: 'AEA', issuedOn: '2026-01-01' } })).rejects.toThrow(/Joignez/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('dépose le justificatif avant de sauvegarder et retire le dépôt si la transaction échoue', async () => {
    const changed = vi.fn(); window.addEventListener(SITE_DATA_CHANGED, changed);
    mocks.rpc.mockResolvedValue({ error: new Error('transaction refusée'), data: null });
    const aea = { ...emptyAea(), number: 'AEA', issuedOn: '2026-01-01' };
    try {
      await expect(artisanalSiteService.saveSite({ ...input, formalization: 'formalized', aea }, new File(['%PDF'], 'aea.pdf', { type: 'application/pdf' }))).rejects.toThrow('transaction refusée');
      expect(mocks.upload.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);
      expect(mocks.remove).toHaveBeenCalledWith(`${input.id}/aea.pdf`);
      expect(changed).not.toHaveBeenCalled();
    } finally { window.removeEventListener(SITE_DATA_CHANGED, changed); }
  });
  it('conserve le document existant pendant une modification sans nouveau fichier', async () => {
    const aea = { ...emptyAea(), number: 'AEA', issuedOn: '2026-01-01', documentPath: `${input.id}/aea.pdf`, documentName: 'aea.pdf' };
    const saved = await artisanalSiteService.saveSite({ ...input, formalization: 'formalized', aea });
    expect(saved.aea).toEqual(aea);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
