import { supabase } from '@/lib/supabase';
import { STATUTS_ENGAGEANTS, type StatutAchat } from './achatMineService';
import { STATUTS_VENTE_ENGAGEANTS } from './stockSonaspService';

export interface MineExportableStock {
  productionOz: number;
  purchasedBySonaspOz: number;
  soldByMineOz: number;
  availableOz: number;
  availableGrams: number;
  overAllocated: boolean;
}

const TROY_OUNCE_GRAMS = 31.1034768;
const round = (value: number) => Math.round(value * 1000) / 1000;

export function calculateMineExportableStock(
  productions: Array<{ estimated_oz: number | null; status: string | null }>,
  purchases: Array<{ quantite_oz: number | null; statut: StatutAchat }>,
  sales: Array<{ quantity_oz: number | null; status: string | null }>
): MineExportableStock {
  const productionOz = productions
    .filter((item) => item.status !== 'cancelled')
    .reduce((total, item) => total + Number(item.estimated_oz || 0), 0);
  const purchasedBySonaspOz = purchases
    .filter((item) => STATUTS_ENGAGEANTS.includes(item.statut))
    .reduce((total, item) => total + Number(item.quantite_oz || 0), 0);
  const soldByMineOz = sales
    .filter((item) => STATUTS_VENTE_ENGAGEANTS.includes(item.status || ''))
    .reduce((total, item) => total + Number(item.quantity_oz || 0), 0);
  const balance = productionOz - purchasedBySonaspOz - soldByMineOz;

  return {
    productionOz: round(productionOz),
    purchasedBySonaspOz: round(purchasedBySonaspOz),
    soldByMineOz: round(soldByMineOz),
    availableOz: round(Math.max(0, balance)),
    availableGrams: round(Math.max(0, balance) * TROY_OUNCE_GRAMS),
    overAllocated: balance < -1e-6,
  };
}

export const mineStockService = {
  async stock(_companyId?: string): Promise<MineExportableStock> {
    const { data, error } = await supabase.rpc('snp_stock_exportable_mine');
    if (error) throw error;
    const stock = data?.[0];
    if (!stock) throw new Error('Le stock exportable de la mine est indisponible.');
    return {
      productionOz: Number(stock.production_oz || 0),
      purchasedBySonaspOz: Number(stock.rachete_sonasp_oz || 0),
      soldByMineOz: Number(stock.vendu_mine_oz || 0),
      availableOz: Number(stock.disponible_oz || 0),
      availableGrams: Number(stock.disponible_grammes || 0),
      overAllocated: Boolean(stock.suralloue),
    };
  },
};
