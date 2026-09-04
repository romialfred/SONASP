import { DgiFiscalDashboard } from './DgiFiscalDashboard';
import { DgmgRegulatoryDashboard } from './DgmgRegulatoryDashboard';

type InstitutionalPortal = 'dgmg' | 'dgi';

/**
 * Point d'entrée institutionnel commun. Chaque charte reste portée par un
 * composant explicitement borné à son portail afin qu'aucune règle visuelle ou
 * agrégation métier ne traverse les frontières DGI/DGMG.
 */
export function InstitutionalPortalPage({ portal }: { portal: InstitutionalPortal }) {
  if (portal === 'dgi') return <DgiFiscalDashboard />;
  return <DgmgRegulatoryDashboard />;
}

export default InstitutionalPortalPage;
