import { LogisticsRegister, type LogisticsRow } from '@/components/shipping/LogisticsRegister';
import { shippingPreparationService } from '@/services/shippingPreparationService';
import { shippingPreparationDetailsPath } from '@/lib/shippingRoutes';

async function loadRows(): Promise<LogisticsRow[]> {
  return (await shippingPreparationService.getAllPreparations()).map(row => ({
    id: row.id, reference: row.expedition_lot_number || '—', company: row.mining_company_name,
    date: row.shipped_at || row.prepared_at || row.created_at, shippedAt: row.shipped_at,
    grams: row.total_net_weight_grams,
    boxes: row.total_boxes, tracking: row.seal_number, status: row.status, href: shippingPreparationDetailsPath(row.id),
  }));
}
export default function ShippingDashboard() {
  return <LogisticsRegister title="Préparations d’expédition" subtitle="Pilotez les expéditions d’or, de leur préparation jusqu’à leur départ."
    loadRows={loadRows} createPath="/shipping/preparation/new" createLabel="Nouvelle expédition"
    pendingStatus="waiting_for_customs_approval" readyStatus="ready_for_expedition"
    statuses={{ waiting_for_customs_approval: 'En attente d’approbation douanière', approved_by_customs: 'Approuvée par la douane', ready_for_expedition: 'Prête pour l’expédition' }}
    presentation="shipment-preparations" />;
}
