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
  return <LogisticsRegister title="Expéditions de fret" subtitle="Suivez les envois internationaux, de leur approbation jusqu’au raffinage et à l’entrée en stock."
    loadRows={loadRows} createPath="/freight/shipments/create" createLabel="Nouvelle expédition de fret" pendingStatus="pending" readyStatus="shipped_to_refinery"
    statuses={{ pending: 'En attente', approved: 'Approuvée', shipped_to_refinery: 'Expédiée vers la raffinerie', received_at_refinery: 'Reçue à la raffinerie', processing: 'En cours de raffinage', processed: 'Raffinée', in_stock: 'En stock' }} />;
}
