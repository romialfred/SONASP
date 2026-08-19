import { Beaker, Boxes } from 'lucide-react';
import { RoleDashboardShell } from './RoleDashboardShell';
import { loadRefineryDashboard } from './roleDashboardData';

export function RefineryDashboard() {
  return (
    <RoleDashboardShell
      icon={Beaker}
      title="Tableau de bord raffinerie"
      subtitle="Lots reçus à traiter, titre constaté et stock affiné disponible."
      load={loadRefineryDashboard}
      serieTitle="Or fin reçu sur douze mois"
      serieDescription="Volume d’or fin porté par les lots réceptionnés."
      serieUnite="oz"
      tableIcon={Boxes}
      tableTitle="Derniers lots"
      tableDescription="Doré reçu et or fin correspondant, par lot."
      colonnes={{ reference: 'Lot', libelle: 'Doré reçu', valeur: 'Or fin' }}
      action={{ label: 'Ouvrir l’affinage', to: '/refining' }}
      emptyLabel="Aucun lot reçu"
    />
  );
}
