import { Factory, PackageCheck } from 'lucide-react';
import { RoleDashboardShell } from './RoleDashboardShell';
import { loadFactoryDashboard } from './roleDashboardData';

export function FactoryDashboard() {
  return (
    <RoleDashboardShell
      icon={Factory}
      title="Tableau de bord usine"
      subtitle="Production journalière déclarée et préparations d’expédition en cours."
      load={loadFactoryDashboard}
      serieTitle="Production des douze derniers mois"
      serieDescription="Or fin estimé à partir des déclarations journalières."
      serieUnite="oz"
      tableIcon={PackageCheck}
      tableTitle="Dernières préparations d’expédition"
      tableDescription="Lots constitués en attente de départ ou déjà expédiés."
      colonnes={{ reference: 'Référence', libelle: 'Conditionnement', valeur: 'Poids' }}
      action={{ label: 'Ouvrir les expéditions', to: '/shipping/preparation' }}
      emptyLabel="Aucune préparation d’expédition"
    />
  );
}
