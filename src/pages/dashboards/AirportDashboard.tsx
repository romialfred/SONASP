import { Plane, Truck } from 'lucide-react';
import { RoleDashboardShell } from './RoleDashboardShell';
import { loadAirportDashboard } from './roleDashboardData';

export function AirportDashboard() {
  return (
    <RoleDashboardShell
      icon={Plane}
      title="Tableau de bord aéroportuaire"
      subtitle="Expéditions de fret au départ et réceptions à confirmer."
      load={loadAirportDashboard}
      serieTitle="Or expédié sur douze mois"
      serieDescription="Or fin embarqué, par mois d’expédition."
      serieUnite="oz"
      tableIcon={Truck}
      tableTitle="Dernières expéditions"
      tableDescription="Dossiers de fret et leur état d’avancement."
      colonnes={{ reference: 'Référence', libelle: 'Conditionnement', valeur: 'Or fin' }}
      action={{ label: 'Ouvrir le fret', to: '/freight' }}
      emptyLabel="Aucune expédition enregistrée"
    />
  );
}
