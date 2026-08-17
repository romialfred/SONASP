export type ArtisanalSiteStatus = 'active' | 'suspended' | 'planned';

export type ExploitationType = 'artisanale' | 'semi_mecanisee' | 'mixte';

export type SiteAssignmentRole = 'site_manager' | 'collection_officer';

export interface SiteContact {
  id?: string;
  role: SiteAssignmentRole;
  fullName: string;
  phone: string;
  email?: string;
  userId?: string;
}

export interface ArtisanalSite {
  id: string;
  code: string;
  name: string;
  status: ArtisanalSiteStatus;
  region: string;
  province: string;
  locality: string;
  areaHectares: number;
  exploitationType: ExploitationType;
  authorizedMiners: number;
  activeMiners: number;
  averageHoleDepthMeters: number;
  authorizedChemicals: string[];
  latitude: number;
  longitude: number;
  manager: SiteContact;
  collectionOfficer: SiteContact;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArtisanalSiteInput {
  id?: string;
  code: string;
  name: string;
  status: ArtisanalSiteStatus;
  region: string;
  province: string;
  locality: string;
  areaHectares: number;
  exploitationType: ExploitationType;
  authorizedMiners: number;
  activeMiners: number;
  averageHoleDepthMeters: number;
  authorizedChemicals: string[];
  latitude: number;
  longitude: number;
  manager: Omit<SiteContact, 'role'>;
  collectionOfficer: Omit<SiteContact, 'role'>;
  notes?: string;
}

export interface SiteProduction {
  id: string;
  siteId: string;
  productionDate: string;
  goldWeightGrams: number;
  revenueFcfa: number;
  taxesFcfa: number;
  artisanCount: number;
  notes?: string;
  createdAt: string;
}

export interface SiteProductionInput {
  siteId: string;
  productionDate: string;
  goldWeightGrams: number;
  revenueFcfa: number;
  taxesFcfa: number;
  artisanCount: number;
  notes?: string;
}

export interface ArtisanalSiteMetrics {
  siteCount: number;
  activeSiteCount: number;
  activeMinerCount: number;
  productionKilograms: number;
  revenueFcfa: number;
  taxesFcfa: number;
}

export interface SiteProductionSummary {
  siteId: string;
  siteName: string;
  productionKilograms: number;
  revenueFcfa: number;
  taxesFcfa: number;
  artisanCount: number;
}
