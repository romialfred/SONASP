import { downloadExcelWorkbook } from '@/lib/excelExport';
import { FreightShipmentStatus } from './freightShipmentService';
import { AVAILABLE_COLUMNS } from '@/components/refining/ColumnSelectorModal';

interface FreightShipment {
  id: string;
  reference_number: string;
  status: FreightShipmentStatus;
  shipment_date: string;
  total_pure_gold_grams: number;
  total_pure_gold_oz: number;
  total_bullion_grams: number;
  total_pure_silver_grams: number;
  total_value_usd: number;
  total_value_local: number;
  gold_price_usd_per_oz: number;
  exchange_rate: number;
  local_currency: string;
  number_of_boxes: number;
  box_type: string;
  production_count: number;
  notes?: string;
  refining_notes?: string;
  created_at: string;
  approved_at?: string | null;
  shipped_at?: string | null;
  received_at?: string | null;
  processing_started_at?: string | null;
  processed_at?: string | null;
  stocked_at?: string | null;
  destination_refinery?: {
    id: string;
    name: string;
  };
  mining_company?: {
    id: string;
    name: string;
  };
  productions?: Array<{
    bar_reference: string;
    bullion_grams: number;
    pure_gold_grams: number;
    depositor?: {
      name: string;
    };
  }>;
}

const STATUS_LABELS: Record<FreightShipmentStatus, string> = {
  pending: 'En Attente',
  approved: 'Approuvé',
  shipped_to_refinery: 'Expédié à la Raffinerie',
  received_at_refinery: 'Reçu à la Raffinerie',
  processing: 'En Cours de Raffinage',
  processed: 'Raffiné',
  in_stock: 'En Stock'
};

function formatDate(date: string | null | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatNumber(value: number | undefined | null, decimals: number = 2): string {
  if (value === null || value === undefined) return '';
  return value.toFixed(decimals);
}

function getColumnValue(shipment: FreightShipment, columnId: string): any {
  switch (columnId) {
    case 'reference_number':
      return shipment.reference_number;

    case 'status':
      return STATUS_LABELS[shipment.status] || shipment.status;

    case 'shipment_date':
      return formatDate(shipment.shipment_date);

    case 'mining_company':
      return shipment.mining_company?.name || '';

    case 'destination_refinery':
      return shipment.destination_refinery?.name || '';

    case 'total_pure_gold_grams':
      return formatNumber(shipment.total_pure_gold_grams, 3);

    case 'total_pure_gold_oz':
      return formatNumber(shipment.total_pure_gold_oz, 6);

    case 'total_bullion_grams':
      return formatNumber(shipment.total_bullion_grams, 3);

    case 'total_pure_silver_grams':
      return formatNumber(shipment.total_pure_silver_grams, 3);

    case 'total_value_usd':
      return formatNumber(shipment.total_value_usd, 2);

    case 'total_value_local':
      return formatNumber(shipment.total_value_local, 2);

    case 'gold_price_usd_per_oz':
      return formatNumber(shipment.gold_price_usd_per_oz, 2);

    case 'exchange_rate':
      return formatNumber(shipment.exchange_rate, 4);

    case 'local_currency':
      return shipment.local_currency;

    case 'number_of_boxes':
      return shipment.number_of_boxes;

    case 'box_type':
      return shipment.box_type;

    case 'production_count':
      return shipment.production_count;

    case 'notes':
      return shipment.notes || '';

    case 'refining_notes':
      return shipment.refining_notes || '';

    case 'approved_at':
      return formatDate(shipment.approved_at);

    case 'shipped_at':
      return formatDate(shipment.shipped_at);

    case 'received_at':
      return formatDate(shipment.received_at);

    case 'processing_started_at':
      return formatDate(shipment.processing_started_at);

    case 'processed_at':
      return formatDate(shipment.processed_at);

    case 'stocked_at':
      return formatDate(shipment.stocked_at);

    case 'created_at':
      return formatDate(shipment.created_at);

    default:
      return '';
  }
}

export async function exportToExcel(
  shipments: FreightShipment[],
  selectedColumns: string[],
  filename: string = 'refining_process_export'
) {
  // Créer les en-têtes
  const headers = selectedColumns.map(colId => {
    const col = AVAILABLE_COLUMNS.find(c => c.id === colId);
    return col?.label || colId;
  });

  // Créer les données
  const data = shipments.map(shipment =>
    selectedColumns.map(colId => getColumnValue(shipment, colId))
  );

  const colWidths = selectedColumns.map(colId => {
    const col = AVAILABLE_COLUMNS.find(c => c.id === colId);
    const label = col?.label || '';
    return Math.max(label.length + 2, 15);
  });

  // Ajouter une feuille de synthèse
  const summaryData = [
    ['Rapport d\'Export - Processus de Raffinage'],
    [''],
    ['Date d\'export:', new Date().toLocaleString('fr-FR')],
    ['Nombre d\'expéditions:', shipments.length],
    [''],
    ['Synthèse par Statut:'],
    ...Object.entries(
      shipments.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).map(([status, count]) => [STATUS_LABELS[status as FreightShipmentStatus] || status, count]),
    [''],
    ['Totaux:'],
    ['Or Total (oz):', formatNumber(shipments.reduce((sum, s) => sum + s.total_pure_gold_oz, 0), 6)],
    ['Valeur Totale (USD):', formatNumber(shipments.reduce((sum, s) => sum + s.total_value_usd, 0), 2)]
  ];

  const timestamp = new Date().toISOString().split('T')[0];
  await downloadExcelWorkbook([
    { name: 'Raffinage', matrix: [headers, ...data], widths: colWidths },
    { name: 'Synthèse', matrix: summaryData, widths: [30, 20] },
  ], `${filename}_${timestamp}.xlsx`);
}

export function exportToCSV(
  shipments: FreightShipment[],
  selectedColumns: string[],
  filename: string = 'refining_process_export'
) {
  // Créer les en-têtes
  const headers = selectedColumns.map(colId => {
    const col = AVAILABLE_COLUMNS.find(c => c.id === colId);
    return col?.label || colId;
  });

  // Créer les lignes
  const rows = shipments.map(shipment =>
    selectedColumns.map(colId => {
      const value = getColumnValue(shipment, colId);
      // Échapper les virgules et guillemets
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    })
  );

  // Construire le CSV
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Télécharger
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().split('T')[0];

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${timestamp}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
