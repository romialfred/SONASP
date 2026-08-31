import { supabase } from '@/lib/supabase';

export interface SilverBearingInventoryRow {
  id: string;
  entry_date: string;
  certificate_number: string | null;
  processing_location: string | null;
  weight_after_melting_grams: number;
  final_fine_oz: number;
  silver_percentage: number;
  quantity_available_oz: number;
  quantity_allocated_oz: number;
  quantity_sold_oz: number;
}

export interface SilverPositionRow extends SilverBearingInventoryRow {
  silver_grams: number;
  available_silver_grams: number;
  allocated_silver_grams: number;
  sold_silver_grams: number;
}

const nonNegative = (value: number | null | undefined) => Math.max(0, Number(value || 0));

export function deriveSilverPosition(row: SilverBearingInventoryRow): SilverPositionRow {
  const silverGrams = nonNegative(row.weight_after_melting_grams)
    * Math.min(100, nonNegative(row.silver_percentage)) / 100;
  const fineGoldOz = nonNegative(row.final_fine_oz);
  const ratio = (quantity: number) => fineGoldOz > 0
    ? Math.min(1, nonNegative(quantity) / fineGoldOz)
    : 0;

  return {
    ...row,
    silver_grams: silverGrams,
    available_silver_grams: silverGrams * ratio(row.quantity_available_oz),
    allocated_silver_grams: silverGrams * ratio(row.quantity_allocated_oz),
    sold_silver_grams: silverGrams * ratio(row.quantity_sold_oz),
  };
}

export async function loadSilverInventoryPosition(): Promise<SilverPositionRow[]> {
  const { data, error } = await supabase
    .from('gold_inventory')
    .select('id, entry_date, certificate_number, processing_location, weight_after_melting_grams, final_fine_oz, silver_percentage, quantity_available_oz, quantity_allocated_oz, quantity_sold_oz')
    .gt('silver_percentage', 0)
    .order('entry_date', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => deriveSilverPosition({
    id: row.id,
    entry_date: row.entry_date,
    certificate_number: row.certificate_number,
    processing_location: row.processing_location,
    weight_after_melting_grams: Number(row.weight_after_melting_grams || 0),
    final_fine_oz: Number(row.final_fine_oz || 0),
    silver_percentage: Number(row.silver_percentage || 0),
    quantity_available_oz: Number(row.quantity_available_oz || 0),
    quantity_allocated_oz: Number(row.quantity_allocated_oz || 0),
    quantity_sold_oz: Number(row.quantity_sold_oz || 0),
  }));
}
