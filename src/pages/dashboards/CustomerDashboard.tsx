import { Receipt, ShoppingCart } from 'lucide-react';
import { RoleDashboardShell } from './RoleDashboardShell';
import { loadCustomerDashboard } from './roleDashboardData';

export function CustomerDashboard() {
  return (
    <RoleDashboardShell
      icon={ShoppingCart}
      title="Tableau de bord client"
      subtitle="Commandes passées, validations attendues et montants engagés."
      load={loadCustomerDashboard}
      serieTitle="Montant commandé sur douze mois"
      serieDescription="Valeur des commandes, en millions de FCFA."
      serieUnite="M FCFA"
      tableIcon={Receipt}
      tableTitle="Dernières commandes"
      tableDescription="Ventes rattachées au compte client et leur statut."
      colonnes={{ reference: 'N° de vente', libelle: 'Client', valeur: 'Montant' }}
      action={{ label: 'Ouvrir les ventes', to: '/sales' }}
      emptyLabel="Aucune commande enregistrée"
    />
  );
}
