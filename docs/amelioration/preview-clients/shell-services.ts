export const MODULE_CATALOG_UPDATED_EVENT = 'preview-clients-no-modules';
export const modulesService = { getNavigationAvailability: async () => null };
export const notificationsService = { lister: async () => [], resume: async () => ({ non_lues: 0, urgentes: 0, hautes: 0 }), marquerLues: async () => { throw new Error('Notifications indisponibles dans cet aperçu.'); } };
export const ageRelatif = () => '';
export const formaterBadge = (n: number) => String(n);
export const useCoursOr = () => ({ cours: null, tauxUsdXof: null, prixGrammeFcfa: null, chargement: false, erreur: 'Cours non chargé dans cet aperçu isolé', actualiser: () => undefined });
export const fetchGoldPriceHistory = async () => [];
export const formatGoldPrice = (n: number) => String(n);
