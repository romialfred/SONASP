export const MODULE_CATALOG_UPDATED_EVENT='qa-modules';
export const modulesService={getNavigationAvailability:async()=>null};
export const notificationsService={lister:async()=>[],resume:async()=>({non_lues:0,urgentes:0,hautes:0}),marquerLues:async()=>0};
export const ageRelatif=()=>'';
export const formaterBadge=(n:number)=>String(n);
export const useCoursOr=()=>({cours:null,tauxUsdXof:null,prixGrammeFcfa:null,chargement:false,erreur:'Cours indisponible dans ce contexte de test',actualiser:()=>{}});
export const fetchGoldPriceHistory=async()=>[];
export const formatGoldPrice=(n:number)=>String(n);
