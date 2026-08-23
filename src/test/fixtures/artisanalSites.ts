import type { ArtisanalSite, SiteProduction } from '@/types/artisanalSite';

/**
 * Limite nationale simplifiée issue de geoBoundaries (BFA ADM0, gbOpen).
 * Les coordonnées restent en longitude/latitude afin de permettre une projection SVG légère.
 */
export const BURKINA_FASO_BOUNDARY: ReadonlyArray<readonly [number, number]> = [
  [0.9921, 13.084], [1.2015, 13.3354], [1.0879, 13.4608], [0.6355, 13.6934],
  [0.5304, 13.8407], [0.3988, 14.0279], [0.168, 14.5234], [-0.0367, 14.9976],
  [-0.507, 15.0819], [-1.887, 14.4863], [-3.0065, 13.6676], [-3.2796, 13.7158],
  [-3.2385, 13.3166], [-3.4782, 13.1598], [-3.9124, 13.3791], [-3.9865, 13.4912],
  [-4.2227, 13.2582], [-4.3009, 13.0597], [-4.3342, 12.7047], [-4.4281, 12.6021],
  [-4.421, 12.3143], [-4.5616, 12.1523], [-4.7246, 12.0068], [-4.8876, 12.0008],
  [-5.0826, 11.9798], [-5.193, 11.9041], [-5.2862, 11.8542], [-5.4081, 11.8234],
  [-5.3083, 11.7856], [-5.2991, 11.6193], [-5.1995, 11.4325], [-5.3414, 11.1366],
  [-5.4484, 10.8722], [-5.4829, 10.6234], [-5.5143, 10.4624], [-5.465, 10.3608],
  [-5.3822, 10.2945], [-5.305, 10.3184], [-5.1876, 10.2848], [-5.1209, 10.2497],
  [-5.077, 10.1639], [-5.0589, 10.1048], [-5.0201, 10.0784], [-4.9896, 10.0066],
  [-4.9409, 9.8796], [-4.8133, 9.8424], [-4.7991, 9.7646], [-4.708, 9.688],
  [-4.619, 9.7132], [-4.5524, 9.7455], [-4.4334, 9.6623], [-4.2896, 9.6554],
  [-4.2588, 9.7561], [-4.0356, 9.8306], [-3.9449, 9.8724], [-3.6198, 9.9415],
  [-3.3116, 9.8811], [-3.1943, 9.896], [-3.0173, 9.7433], [-2.7248, 9.451],
  [-2.7916, 9.7223], [-2.7836, 10.0242], [-2.854, 10.3184], [-2.8969, 10.5092],
  [-2.9387, 10.7216], [-2.8397, 10.9505], [-2.255, 10.9884], [-1.5927, 10.9883],
  [-1.1219, 10.9828], [-0.7684, 10.9919], [-0.6574, 10.9579], [-0.5194, 10.9842],
  [-0.3733, 11.0848], [-0.2851, 11.1505], [0.5042, 10.9824], [0.9005, 10.9966],
  [1.0298, 11.0527], [1.0845, 11.1051], [1.1412, 11.1737], [1.142, 11.2703],
  [1.2741, 11.2833], [1.3037, 11.3004], [1.3443, 11.3669], [1.4222, 11.4559],
  [1.5469, 11.4602], [1.6375, 11.4015], [1.7557, 11.4172], [1.8842, 11.438],
  [2.3096, 11.6808], [2.3701, 11.8182], [2.3717, 11.9414], [2.1541, 12.4116],
  [2.2678, 12.4749], [1.4333, 12.7434], [0.9921, 13.084],
];

const now = '2026-08-17T08:00:00.000Z';

export const DEMO_ARTISANAL_SITES: ArtisanalSite[] = [
  {
    id: 'site-kalsaka', code: 'SA-NOR-2026-0001', name: 'Site artisanal de Kalsaka', status: 'active',
    region: 'Nord', province: 'Yatenga', locality: 'Kalsaka', areaHectares: 42.5,
    exploitationType: 'artisanale', authorizedMiners: 180, activeMiners: 146,
    averageHoleDepthMeters: 23, authorizedChemicals: ['Borax', 'Charbon actif'],
    latitude: 13.178, longitude: -1.992, photos: [],
    manager: { role: 'site_manager', fullName: 'Issa Ouédraogo', phone: '+226 70 12 34 56', email: 'issa.ouedraogo@sonasp.bf' },
    collectionOfficer: { role: 'collection_officer', fullName: 'Awa Kaboré', phone: '+226 76 22 18 04', email: 'awa.kabore@sonasp.bf' },
    notes: 'Site pilote pour le suivi numérique des productions.', createdAt: now, updatedAt: now,
  },
  {
    id: 'site-poura', code: 'SA-BOU-2026-0002', name: 'Site artisanal de Poura', status: 'active',
    region: 'Boucle du Mouhoun', province: 'Balé', locality: 'Poura', areaHectares: 61,
    exploitationType: 'semi_mecanisee', authorizedMiners: 240, activeMiners: 211,
    averageHoleDepthMeters: 31, authorizedChemicals: ['Borax'], latitude: 11.586, longitude: -2.753, photos: [],
    manager: { role: 'site_manager', fullName: 'Moussa Traoré', phone: '+226 71 03 19 47', email: 'moussa.traore@sonasp.bf' },
    collectionOfficer: { role: 'collection_officer', fullName: 'Aminata Sanou', phone: '+226 75 14 09 38' },
    createdAt: now, updatedAt: now,
  },
  {
    id: 'site-gaoua', code: 'SA-SUD-2026-0003', name: 'Site artisanal de Gaoua', status: 'active',
    region: 'Sud-Ouest', province: 'Poni', locality: 'Gaoua', areaHectares: 37.8,
    exploitationType: 'mixte', authorizedMiners: 160, activeMiners: 128,
    averageHoleDepthMeters: 18, authorizedChemicals: ['Borax', 'Charbon actif'], latitude: 10.325, longitude: -3.174, photos: [],
    manager: { role: 'site_manager', fullName: 'Jean Kambou', phone: '+226 70 38 15 42' },
    collectionOfficer: { role: 'collection_officer', fullName: 'Fatou Somé', phone: '+226 74 11 60 28', email: 'fatou.some@sonasp.bf' },
    createdAt: now, updatedAt: now,
  },
  {
    id: 'site-kongoussi', code: 'SA-CEN-2026-0004', name: 'Site artisanal de Kongoussi', status: 'active',
    region: 'Centre-Nord', province: 'Bam', locality: 'Kongoussi', areaHectares: 54.2,
    exploitationType: 'artisanale', authorizedMiners: 205, activeMiners: 174,
    averageHoleDepthMeters: 27, authorizedChemicals: ['Borax'], latitude: 13.325, longitude: -1.535, photos: [],
    manager: { role: 'site_manager', fullName: 'Adama Sawadogo', phone: '+226 78 21 07 55' },
    collectionOfficer: { role: 'collection_officer', fullName: 'Salif Ilboudo', phone: '+226 72 44 10 63' },
    createdAt: now, updatedAt: now,
  },
  {
    id: 'site-hounde', code: 'SA-HAU-2026-0005', name: 'Site artisanal de Houndé', status: 'planned',
    region: 'Hauts-Bassins', province: 'Tuy', locality: 'Houndé', areaHectares: 48,
    exploitationType: 'semi_mecanisee', authorizedMiners: 190, activeMiners: 0,
    averageHoleDepthMeters: 25, authorizedChemicals: ['Borax', 'Charbon actif'], latitude: 11.5, longitude: -3.516, photos: [],
    manager: { role: 'site_manager', fullName: 'Clarisse Zongo', phone: '+226 77 04 31 82' },
    collectionOfficer: { role: 'collection_officer', fullName: 'Poste à pourvoir', phone: '' },
    createdAt: now, updatedAt: now,
  },
  {
    id: 'site-gorom', code: 'SA-SAH-2026-0006', name: 'Site artisanal de Gorom-Gorom', status: 'suspended',
    region: 'Sahel', province: 'Oudalan', locality: 'Gorom-Gorom', areaHectares: 32.4,
    exploitationType: 'artisanale', authorizedMiners: 120, activeMiners: 0,
    averageHoleDepthMeters: 20, authorizedChemicals: ['Borax'], latitude: 14.443, longitude: -0.235, photos: [],
    manager: { role: 'site_manager', fullName: 'Oumar Dicko', phone: '+226 70 09 28 64' },
    collectionOfficer: { role: 'collection_officer', fullName: 'Mariam Diallo', phone: '+226 75 33 06 77' },
    createdAt: now, updatedAt: now,
  },
];

export const DEMO_SITE_PRODUCTIONS: SiteProduction[] = [
  { id: 'prod-001', siteId: 'site-kalsaka', productionDate: '2026-08-01', goldWeightGrams: 18420, revenueFcfa: 824500000, taxesFcfa: 24735000, artisanCount: 146, createdAt: now },
  { id: 'prod-002', siteId: 'site-poura', productionDate: '2026-08-02', goldWeightGrams: 26750, revenueFcfa: 1198000000, taxesFcfa: 35940000, artisanCount: 211, createdAt: now },
  { id: 'prod-003', siteId: 'site-gaoua', productionDate: '2026-08-05', goldWeightGrams: 13980, revenueFcfa: 625300000, taxesFcfa: 18759000, artisanCount: 128, createdAt: now },
  { id: 'prod-004', siteId: 'site-kongoussi', productionDate: '2026-08-07', goldWeightGrams: 21100, revenueFcfa: 944700000, taxesFcfa: 28341000, artisanCount: 174, createdAt: now },
  { id: 'prod-005', siteId: 'site-kalsaka', productionDate: '2026-07-11', goldWeightGrams: 16900, revenueFcfa: 756900000, taxesFcfa: 22707000, artisanCount: 139, createdAt: now },
  { id: 'prod-006', siteId: 'site-poura', productionDate: '2026-07-14', goldWeightGrams: 23850, revenueFcfa: 1068000000, taxesFcfa: 32040000, artisanCount: 203, createdAt: now },
];
