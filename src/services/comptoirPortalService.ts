import { supabase } from '@/lib/supabase';

export interface ComptoirPurchase {
  id: string;
  reference: string;
  date: string;
  artisanName: string;
  quantityGrams: number;
  amountFcfa: number;
  status: string;
}

export interface ComptoirStockMovement {
  id: string;
  date: string;
  direction: 'in' | 'out';
  quantityGrams: number;
  type: string;
  reference: string;
}

export interface ComptoirSonaspSale {
  id: string;
  reference: string;
  date: string;
  quantityGrams: number;
  unitPriceFcfa: number;
  totalFcfa: number;
  status: 'submitted' | 'accepted' | 'rejected' | 'paid' | 'cancelled';
}

export interface ComptoirTrendPoint {
  key: string;
  label: string;
  purchasesGrams: number;
  taxesFcfa: number;
  salesGrams: number;
}

export interface ComptoirDashboardData {
  assignedMiners: number;
  purchasesCount: number;
  purchasedGrams: number;
  pendingDgiInvoices: number;
  certifiedDgiInvoices: number;
  pendingPayments: number;
  taxesCollectedFcfa: number;
  taxesToRemitFcfa: number;
  stockGrams: number;
  salesToSonaspGrams: number;
  recentPurchases: ComptoirPurchase[];
  trend: ComptoirTrendPoint[];
}

const client = supabase as any;
const numberValue = (value: unknown) => Number(value || 0);

function artisanName(artisan: any): string {
  return artisan?.raison_sociale
    || [artisan?.nom, artisan?.prenoms].filter(Boolean).join(' ')
    || 'Orpailleur';
}

function monthKey(value: string): string {
  return String(value || '').slice(0, 7);
}

function trendFrame(): ComptoirTrendPoint[] {
  const formatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    return {
      key: date.toISOString().slice(0, 7),
      label: formatter.format(date).replace('.', ''),
      purchasesGrams: 0,
      taxesFcfa: 0,
      salesGrams: 0,
    };
  });
}

async function requiredRows(query: PromiseLike<{ data: any[] | null; error: any }>): Promise<any[]> {
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export const comptoirPortalService = {
  async getDashboard(organizationId: string): Promise<ComptoirDashboardData> {
    const [assignments, purchases, invoices, payments, taxes, ledger, sonaspSales] = await Promise.all([
      requiredRows(
        client.from('snp_collector_artisan_assignments')
          .select('artisan_id')
          .eq('comptoir_organization_id', organizationId)
          .is('valid_until', null),
      ),
      requiredRows(
        client.from('snp_artisan_ventes_or')
          .select('id, numero_recu, date_vente, artisan_id, quantite_grammes, montant_total_fcfa, statut, artisan:snp_artisans_miniers(nom, prenoms, raison_sociale)')
          .eq('comptoir_organization_id', organizationId)
          .order('date_vente', { ascending: false }),
      ),
      requiredRows(
        client.from('snp_artisan_factures_definitives')
          .select('id, certification_dgi_status')
          .eq('comptoir_organization_id', organizationId),
      ),
      requiredRows(
        client.from('snp_artisan_paiements')
          .select('id, statut')
          .eq('comptoir_organization_id', organizationId),
      ),
      requiredRows(
        client.from('snp_artisan_taxes_retenues')
          .select('montant_taxe, statut_reversement, created_at')
          .eq('comptoir_organization_id', organizationId),
      ),
      requiredRows(
        client.from('snp_artisanal_stock_ledger')
          .select('id, direction, quantity_grams, movement_type, business_reference, created_at')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false }),
      ),
      requiredRows(
        client.from('snp_comptoir_ventes_sonasp')
          .select('id, reference_vente, date_vente, quantity_grams, unit_price_fcfa, total_fcfa, status')
          .eq('comptoir_organization_id', organizationId)
          .order('date_vente', { ascending: false }),
      ),
    ]);

    const trend = trendFrame();
    const trendByMonth = new Map(trend.map((point) => [point.key, point]));
    purchases.forEach((row) => {
      const point = trendByMonth.get(monthKey(row.date_vente));
      if (point && row.statut !== 'annulee') point.purchasesGrams += numberValue(row.quantite_grammes);
    });
    taxes.forEach((row) => {
      const point = trendByMonth.get(monthKey(row.created_at));
      if (point) point.taxesFcfa += numberValue(row.montant_taxe);
    });
    sonaspSales.forEach((row) => {
      const point = trendByMonth.get(monthKey(row.date_vente));
      if (point && !['rejected', 'cancelled'].includes(row.status)) point.salesGrams += numberValue(row.quantity_grams);
    });

    const recentPurchases: ComptoirPurchase[] = purchases.slice(0, 6).map((row) => ({
      id: row.id,
      reference: row.numero_recu || `ACH-${String(row.id).slice(0, 8)}`,
      date: row.date_vente,
      artisanName: artisanName(Array.isArray(row.artisan) ? row.artisan[0] : row.artisan),
      quantityGrams: numberValue(row.quantite_grammes),
      amountFcfa: numberValue(row.montant_total_fcfa),
      status: row.statut || 'en_attente',
    }));

    return {
      assignedMiners: new Set(assignments.map((row) => row.artisan_id)).size,
      purchasesCount: purchases.filter((row) => row.statut !== 'annulee').length,
      purchasedGrams: purchases
        .filter((row) => row.statut !== 'annulee')
        .reduce((sum, row) => sum + numberValue(row.quantite_grammes), 0),
      pendingDgiInvoices: invoices.filter((row) => row.certification_dgi_status !== 'certified').length,
      certifiedDgiInvoices: invoices.filter((row) => row.certification_dgi_status === 'certified').length,
      pendingPayments: payments.filter((row) => !['complete', 'annule', 'echec'].includes(row.statut)).length,
      taxesCollectedFcfa: taxes.reduce((sum, row) => sum + numberValue(row.montant_taxe), 0),
      taxesToRemitFcfa: taxes
        .filter((row) => ['a_reverser', 'en_cours'].includes(row.statut_reversement))
        .reduce((sum, row) => sum + numberValue(row.montant_taxe), 0),
      stockGrams: ledger.reduce(
        (sum, row) => sum + (row.direction === 'in' ? 1 : -1) * numberValue(row.quantity_grams),
        0,
      ),
      salesToSonaspGrams: sonaspSales
        .filter((row) => ['accepted', 'paid'].includes(row.status))
        .reduce((sum, row) => sum + numberValue(row.quantity_grams), 0),
      recentPurchases,
      trend,
    };
  },

  async getStock(organizationId: string): Promise<ComptoirStockMovement[]> {
    const rows = await requiredRows(
      client.from('snp_artisanal_stock_ledger')
        .select('id, direction, quantity_grams, movement_type, business_reference, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false }),
    );
    return rows.map((row) => ({
      id: row.id,
      date: row.created_at,
      direction: row.direction,
      quantityGrams: numberValue(row.quantity_grams),
      type: row.movement_type,
      reference: row.business_reference,
    }));
  },

  async getSalesToSonasp(organizationId: string): Promise<ComptoirSonaspSale[]> {
    const rows = await requiredRows(
      client.from('snp_comptoir_ventes_sonasp')
        .select('id, reference_vente, date_vente, quantity_grams, unit_price_fcfa, total_fcfa, status')
        .eq('comptoir_organization_id', organizationId)
        .order('date_vente', { ascending: false }),
    );
    return rows.map((row) => ({
      id: row.id,
      reference: row.reference_vente,
      date: row.date_vente,
      quantityGrams: numberValue(row.quantity_grams),
      unitPriceFcfa: numberValue(row.unit_price_fcfa),
      totalFcfa: numberValue(row.total_fcfa),
      status: row.status,
    }));
  },

  async submitSaleToSonasp(input: { quantityGrams: number; unitPriceFcfa: number; notes?: string }) {
    const { data, error } = await client.rpc('snp_submit_comptoir_sale_to_sonasp', {
      p_quantity_grams: input.quantityGrams,
      p_unit_price_fcfa: input.unitPriceFcfa,
      p_notes: input.notes?.trim() || null,
    });
    if (error) throw error;
    return data as string;
  },
};
