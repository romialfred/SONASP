import { supabase } from '@/lib/supabase';
import { artisanMinierService, type ArtisanMinier } from '@/services/artisanMinierService';
import { artisanGoldSalesService } from '@/services/artisanGoldSalesService';
import { buildProductionFromArtisanSales } from '@/services/artisanalSiteInsights';
import type {
  ArtisanalSite,
  ArtisanalSiteInput,
  ArtisanalSiteMetrics,
  SiteContact,
  SiteProduction,
  SiteProductionSummary,
} from '@/types/artisanalSite';

type SiteRow = Record<string, unknown>;

const assignmentFor = (
  assignments: SiteRow[],
  role: SiteContact['role']
): SiteContact => {
  const assignment = assignments.find((item) => item.role === role);
  return {
    id: assignment?.id as string | undefined,
    role,
    fullName: (assignment?.full_name as string) || '',
    phone: (assignment?.phone as string) || '',
    email: (assignment?.email as string) || undefined,
    userId: (assignment?.user_id as string) || undefined,
  };
};

const mapSiteRow = (row: SiteRow, assignments: SiteRow[] = []): ArtisanalSite => {
  const siteAssignments = assignments.filter((item) => item.site_id === row.id);
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    status: row.status as ArtisanalSite['status'],
    region: row.region as string,
    province: row.province as string,
    locality: row.locality as string,
    areaHectares: Number(row.area_hectares || 0),
    exploitationType: row.exploitation_type as ArtisanalSite['exploitationType'],
    authorizedMiners: Number(row.authorized_miners || 0),
    activeMiners: Number(row.active_miners || 0),
    averageHoleDepthMeters: Number(row.average_hole_depth_m || 0),
    authorizedChemicals: Array.isArray(row.authorized_chemicals)
      ? (row.authorized_chemicals as string[])
      : [],
    latitude: Number(row.latitude || 0),
    longitude: Number(row.longitude || 0),
    photos: Array.isArray(row.photos) ? (row.photos as string[]) : [],
    manager: assignmentFor(siteAssignments, 'site_manager'),
    collectionOfficer: assignmentFor(siteAssignments, 'collection_officer'),
    notes: (row.notes as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
};

export const calculateSiteMetrics = (
  sites: ArtisanalSite[],
  productions: SiteProduction[]
): ArtisanalSiteMetrics => ({
  siteCount: sites.length,
  activeSiteCount: sites.filter((site) => site.status === 'active').length,
  activeMinerCount: sites.reduce((total, site) => total + site.activeMiners, 0),
  productionKilograms:
    productions.reduce((total, item) => total + item.goldWeightGrams, 0) / 1000,
  revenueFcfa: productions.reduce((total, item) => total + item.revenueFcfa, 0),
  taxesFcfa: productions.reduce((total, item) => total + item.taxesFcfa, 0),
});

export const summarizeSiteProduction = (
  sites: ArtisanalSite[],
  productions: SiteProduction[]
): SiteProductionSummary[] =>
  sites
    .map((site) => {
      const siteProductions = productions.filter((item) => item.siteId === site.id);
      return {
        siteId: site.id,
        siteName: site.name,
        productionKilograms:
          siteProductions.reduce((total, item) => total + item.goldWeightGrams, 0) / 1000,
        revenueFcfa: siteProductions.reduce((total, item) => total + item.revenueFcfa, 0),
        taxesFcfa: siteProductions.reduce((total, item) => total + item.taxesFcfa, 0),
        artisanCount: site.activeMiners,
      };
    })
    .sort((a, b) => b.productionKilograms - a.productionKilograms);

const listSites = async (): Promise<ArtisanalSite[]> => {
  const [{ data: sites, error: sitesError }, { data: assignments, error: assignmentsError }] =
    await Promise.all([
      supabase.from('artisanal_sites').select('*').order('name'),
      supabase.from('artisanal_site_assignments').select('*'),
    ]);

  if (sitesError) throw sitesError;
  if (assignmentsError) throw assignmentsError;
  return (sites || []).map((row) => mapSiteRow(row as SiteRow, (assignments || []) as SiteRow[]));
};

/**
 * Charge les sites et leur production.
 *
 * La production n'est pas saisie site par site : elle est **reconstituée** à partir
 * des ventes d'or déclarées par les artisans rattachés à chaque site. Une panne de
 * données remonte explicitement à l'interface ; aucun jeu fictif ne lui est substitué.
 */
const loadSiteData = async (): Promise<{ sites: ArtisanalSite[]; productions: SiteProduction[] }> => {
  const sites = await listSites();
  const [artisans, sales] = await Promise.all([
    artisanMinierService.getAll(),
    artisanGoldSalesService.getAll(),
  ]);
  const productions = buildProductionFromArtisanSales(
    sites,
    (artisans || []) as ArtisanMinier[],
    sales || []
  );
  return { sites, productions };
};

const saveSite = async (input: ArtisanalSiteInput): Promise<ArtisanalSite> => {
  const payload = {
      ...(input.id ? { id: input.id } : {}),
      code: input.code,
      name: input.name,
      status: input.status,
      region: input.region,
      province: input.province,
      locality: input.locality,
      area_hectares: input.areaHectares,
      exploitation_type: input.exploitationType,
      authorized_miners: input.authorizedMiners,
      active_miners: input.activeMiners,
      average_hole_depth_m: input.averageHoleDepthMeters,
      authorized_chemicals: input.authorizedChemicals,
      latitude: input.latitude,
      longitude: input.longitude,
      photos: input.photos || [],
      notes: input.notes || null,
  };
  const { data, error } = await supabase
    .from('artisanal_sites')
    .upsert(payload)
    .select()
    .single();
  if (error) throw error;

    const siteId = data.id as string;
    const { error: deleteError } = await supabase
      .from('artisanal_site_assignments')
      .delete()
      .eq('site_id', siteId);
    if (deleteError) throw deleteError;

    const assignments = [
      { ...input.manager, site_id: siteId, role: 'site_manager' },
      { ...input.collectionOfficer, site_id: siteId, role: 'collection_officer' },
    ].map(({ fullName, userId, ...item }) => ({
      ...item,
      full_name: fullName,
      user_id: userId || null,
      email: item.email || null,
    }));
    const { data: savedAssignments, error: assignmentError } = await supabase
      .from('artisanal_site_assignments')
      .insert(assignments)
      .select();
    if (assignmentError) throw assignmentError;
  return mapSiteRow(data as SiteRow, (savedAssignments || []) as SiteRow[]);
};

export const artisanalSiteService = {
  listSites,
  loadSiteData,
  saveSite,
  async getSite(id: string) {
    const sites = await listSites();
    return sites.find((site) => site.id === id) || null;
  },
  isUsingLocalFallback: () => false,
};
