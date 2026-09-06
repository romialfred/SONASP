import { validateSiteAea } from '@/lib/siteFormalization';
import { secureRandomId } from '@/lib/secureRandom';
import { siteAeaDocumentService } from '@/services/siteAeaDocumentService';
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

export const SITE_DATA_CHANGED = 'sonasp:artisanal-site-changed';

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
    exploitationType: 'artisanale',
    formalization: (row.formalization as ArtisanalSite['formalization']) || null,
    aea: row.aea_number ? {
      number: String(row.aea_number), issuedOn: String(row.aea_issued_on || ''),
      durationMonths: Number(row.aea_duration_months || 0),
      documentPath: String(row.aea_document_path || ''), documentName: String(row.aea_document_name || ''),
    } : null,
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

const saveSite = async (input: ArtisanalSiteInput, aeaFile?: File | null): Promise<ArtisanalSite> => {
  if (!input.formalization) throw new Error('Choisissez la catégorie du site.');
  if (input.formalization === 'formalized') {
    const error = validateSiteAea(input.aea, Boolean(aeaFile));
    if (error) throw new Error(error);
  }
  const siteId = input.id || secureRandomId();
  let uploadedPath: string | null = null;
  let aea = input.formalization === 'formalized' ? input.aea : null;
  try {
    if (aea && aeaFile) {
      const uploaded = await siteAeaDocumentService.upload(siteId, aeaFile);
      uploadedPath = uploaded.documentPath;
      aea = { ...aea, ...uploaded };
    }
    const payload = {
      id: siteId, code: input.code, name: input.name, status: input.status,
      region: input.region, province: input.province, locality: input.locality,
      area_hectares: input.areaHectares, exploitation_type: 'artisanale',
      formalization: input.formalization,
      aea_number: aea?.number.trim() || null, aea_issued_on: aea?.issuedOn || null,
      aea_duration_months: aea?.durationMonths || null,
      aea_document_path: aea?.documentPath || null, aea_document_name: aea?.documentName || null,
      authorized_miners: input.authorizedMiners, active_miners: input.activeMiners,
      average_hole_depth_m: input.averageHoleDepthMeters, authorized_chemicals: input.authorizedChemicals,
      latitude: input.latitude, longitude: input.longitude, photos: input.photos || [], notes: input.notes || null,
    };
    const assignments = [
      { ...input.manager, role: 'site_manager' },
      { ...input.collectionOfficer, role: 'collection_officer' },
    ].map(({ fullName, userId, ...contact }) => ({
      role: contact.role, full_name: fullName, phone: contact.phone, email: contact.email || null, user_id: userId || null,
    }));
    const { data, error } = await supabase.rpc('snp_save_artisanal_site', {
      p_site: payload, p_assignments: assignments,
    });
    if (error) throw error;
    const result = data as unknown as { site: SiteRow; assignments: SiteRow[] };
    if (!result?.site || result.site.id !== siteId || !Array.isArray(result.assignments)) {
      throw new Error('La confirmation d’enregistrement est invalide. Actualisez la liste avant de réessayer.');
    }
    const saved = mapSiteRow(result.site, result.assignments);
    window.dispatchEvent(new Event(SITE_DATA_CHANGED));
    return saved;
  } catch (reason) {
    if (uploadedPath) {
      // La base refuse la suppression d'un justificatif déjà rattaché : même en cas
      // de réponse réseau perdue, le document d'un enregistrement réussi est conservé.
      await siteAeaDocumentService.remove(uploadedPath).catch(() => undefined);
    }
    throw reason;
  }
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
