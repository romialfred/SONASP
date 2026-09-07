import { DEMO_ARTISANAL_SITES } from '@/test/fixtures/artisanalSites';
import type { ArtisanalSiteInput } from '@/types/artisanalSite';
import { signal, simulation } from './transport';
export { calculateSiteMetrics, summarizeSiteProduction } from '../../../../../src/services/artisanalSiteService';
export const SITE_DATA_CHANGED = 'qa-site-changed';
let site = { ...DEMO_ARTISANAL_SITES[0], id: 'qa-site', name: 'Site QA — présentation simulée', formalization: 'non_formalized' as const,
  aea: null, photos: new URLSearchParams(location.search).get('photos') === 'empty' ? [] : ['sites/initial-a.jpg', 'sites/initial-b.jpg'], notes: 'Dossier fictif local. Aucune donnée distante ni base réelle.',
  manager: { ...DEMO_ARTISANAL_SITES[0].manager, fullName: 'Responsable QA', email: 'responsable@example.test' },
  collectionOfficer: { ...DEMO_ARTISANAL_SITES[0].collectionOfficer, fullName: 'Agent QA', email: 'collecte@example.test' } };
export const artisanalSiteService = {
  listSites: async () => [site], getSite: async () => site,
  loadSiteData: async () => {
    const { dataError, dataDelay, emptySites } = simulation;
    if (dataDelay) await new Promise(resolve => setTimeout(resolve, 5000));
    signal(`Lecture dossier simulée : ${dataError ? 'refus' : emptySites ? 'liste vide' : 'réussie'}`);
    if (dataError) throw new Error('Lecture du dossier refusée sur le banc simulé.');
    return { sites: emptySites ? [] : [site], productions: [] };
  },
  saveSite: async (input: ArtisanalSiteInput) => {
    signal(`Sauvegarde simulée : ${simulation.saveError ? 'refus' : 'mémoire seulement'} — ${input.photos.length} référence(s)`);
    if (simulation.saveError) throw new Error('Erreur de sauvegarde simulée. Aucune base réelle connectée.');
    site = { ...site, ...input, id: 'qa-site' } as typeof site;
    window.dispatchEvent(new Event(SITE_DATA_CHANGED)); return site;
  },
};
