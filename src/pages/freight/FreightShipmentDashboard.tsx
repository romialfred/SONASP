import { LogisticsRegister, type LogisticsRow } from '@/components/shipping/LogisticsRegister';
import { freightShipmentService } from '@/services/freightShipmentService';

async function loadRows(): Promise<LogisticsRow[]> {
  return (await freightShipmentService.listShipments()).map(row => ({
    id: row.id, reference: row.reference_number, company: row.source_mining_companies?.map(company => company.name).join(', '),
    date: row.shipment_date, grams: row.total_pure_gold_grams, boxes: row.number_of_boxes,
    tracking: row.expedition_number, status: row.status, href: `/freight/shipments/${row.id}`,
  }));
}
export default function FreightShipmentDashboard() {
  return <LogisticsRegister title="Freight shipments" subtitle="Track international consignments from approval through refining and stock entry."
    loadRows={loadRows} createPath="/freight/shipments/create" createLabel="New freight shipment" pendingStatus="pending" readyStatus="shipped_to_refinery"
    statuses={{ pending: 'Pending', approved: 'Approved', shipped_to_refinery: 'Dispatched to refinery', received_at_refinery: 'Received at refinery', processing: 'Refining', processed: 'Refined', in_stock: 'In stock' }} />;
}
