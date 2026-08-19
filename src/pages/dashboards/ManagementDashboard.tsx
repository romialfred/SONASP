import { Building2, Receipt } from 'lucide-react';
import { RoleDashboardShell } from './RoleDashboardShell';
import { loadManagementDashboard } from './roleDashboardData';

export function ManagementDashboard() {
  return (
    <RoleDashboardShell
      icon={Building2}
      title="Tableau de bord direction"
      subtitle="Chiffre d’affaires, production, portefeuille clients et dossiers à valider."
      load={loadManagementDashboard}
      serieTitle="Chiffre d’affaires sur douze mois"
      serieDescription="Valeur des ventes déclarées, en millions de FCFA."
      serieUnite="M FCFA"
      tableIcon={Receipt}
      tableTitle="Dernières ventes"
      tableDescription="Transactions les plus récentes, tous clients confondus."
      colonnes={{ reference: 'N° de vente', libelle: 'Client', valeur: 'Montant' }}
      action={{ label: 'Ouvrir les ventes', to: '/sales' }}
      emptyLabel="Aucune vente enregistrée"
    />
  );
}
