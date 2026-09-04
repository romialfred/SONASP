import { LogisticsRegister, type LogisticsRow } from '@/components/shipping/LogisticsRegister';
import { freightCustomsService } from '@/services/freightCustomsService';
import { useAuth } from '@/contexts/AuthContext';
import { FREIGHT_CAPABILITIES, hasFreightCapability } from '@/lib/freightCustomsAccess';

async function loadRows(): Promise<LogisticsRow[]> {
  return (await freightCustomsService.listOperations()).map(row => ({
    id: row.id, reference: row.reference_number, company: row.shipping_preparation?.mining_companies?.name,
    date: row.created_at, grams: row.shipping_preparation?.total_weight_grams,
    boxes: row.shipping_preparation?.total_boxes, tracking: row.awb_number,
    status: row.status, href: `/freight-customs/${row.id}`,
  }));
}
export default function FreightCustomsDashboard() {
  const { user } = useAuth();
  return <LogisticsRegister title="Douane et consignation" subtitle="Suivez le dédouanement, les pièces justificatives et l’expédition vers la raffinerie."
    loadRows={loadRows} createPath="/freight-customs/create" createLabel="Nouvelle opération douanière"
    canCreate={hasFreightCapability(user, FREIGHT_CAPABILITIES.PREPARE)} pendingStatus="customs_pending" readyStatus="shipped_to_refinery"
    statuses={{ customs_pending: 'En attente d’approbation douanière', customs_approved: 'Approuvée par la douane', ready_for_transport: 'Prête pour le transport', ready_for_expedition: 'Prête pour l’expédition', shipped_to_refinery: 'Expédiée vers la raffinerie' }} />;
}
