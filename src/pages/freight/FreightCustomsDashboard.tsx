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
  return <LogisticsRegister title="Customs & consignment" subtitle="Follow customs clearance, supporting documents and dispatch to the refinery."
    loadRows={loadRows} createPath="/freight-customs/create" createLabel="New customs operation"
    canCreate={hasFreightCapability(user, FREIGHT_CAPABILITIES.PREPARE)} pendingStatus="customs_pending" readyStatus="shipped_to_refinery"
    statuses={{ customs_pending: 'Awaiting customs approval', customs_approved: 'Customs approved', ready_for_transport: 'Ready for transport', ready_for_expedition: 'Ready for shipment', shipped_to_refinery: 'Dispatched to refinery' }} />;
}
