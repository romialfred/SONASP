import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkProductionStatuses() {
  console.log('\n=== ANALYSE DES STATUTS DE PRODUCTION ===\n');

  // Find Kourousa (KGM)
  const { data: kgm } = await supabase
    .from('mining_companies')
    .select('*')
    .eq('abbreviation', 'KGM')
    .single();

  if (!kgm) {
    console.log('❌ KGM non trouvé');
    return;
  }

  console.log(`✅ Trouvé: ${kgm.name} (${kgm.abbreviation})\n`);

  // Get all productions for KGM grouped by status
  const { data: allProductions } = await supabase
    .from('daily_production')
    .select('*')
    .eq('mining_company_id', kgm.id);

  console.log(`📊 Total productions pour KGM: ${allProductions?.length || 0}\n`);

  // Group by status
  const byStatus = {};
  let totalGrams = 0;

  if (allProductions) {
    allProductions.forEach(prod => {
      const status = prod.status || 'null';
      if (!byStatus[status]) {
        byStatus[status] = {
          count: 0,
          totalGrams: 0,
          items: []
        };
      }
      byStatus[status].count++;
      byStatus[status].totalGrams += (prod.quantity_grams || 0);
      byStatus[status].items.push(prod);
      totalGrams += (prod.quantity_grams || 0);
    });
  }

  console.log('📦 Stock par statut:\n');
  Object.keys(byStatus).sort().forEach(status => {
    const data = byStatus[status];
    console.log(`   ${status}:`);
    console.log(`      - Nombre: ${data.count}`);
    console.log(`      - Total: ${data.totalGrams.toFixed(2)}g (${(data.totalGrams / 31.1035).toFixed(2)} oz)`);
  });

  console.log(`\n   TOTAL TOUTES STATUTS: ${totalGrams.toFixed(2)}g (${(totalGrams / 31.1035).toFixed(2)} oz)`);

  // Now check sales
  console.log('\n💰 Ventes de KGM:\n');

  const { data: sales } = await supabase
    .from('sales')
    .select('*, customers(name)')
    .eq('seller_id', kgm.id)
    .order('created_at', { ascending: false });

  if (sales && sales.length > 0) {
    let totalSoldGrams = 0;
    let totalSoldOz = 0;

    sales.forEach((sale, index) => {
      const ozToGrams = (sale.quantity_oz || 0) * 31.1035;
      totalSoldGrams += ozToGrams;
      totalSoldOz += (sale.quantity_oz || 0);
      console.log(`   ${index + 1}. ${sale.sale_number}:`);
      console.log(`      - Quantité: ${sale.quantity_oz} oz (${ozToGrams.toFixed(2)}g)`);
      console.log(`      - Client: ${sale.customers?.name || 'N/A'}`);
      console.log(`      - Statut: ${sale.status}`);
      console.log(`      - Date: ${new Date(sale.created_at).toLocaleDateString()}`);
    });

    console.log(`\n   📊 TOTAL VENDU:`);
    console.log(`      - ${totalSoldOz.toFixed(2)} oz`);
    console.log(`      - ${totalSoldGrams.toFixed(2)}g\n`);

    console.log('\n🔍 ANALYSE:\n');
    console.log(`   Stock total disponible: ${totalGrams.toFixed(2)}g`);
    console.log(`   Total vendu: ${totalSoldGrams.toFixed(2)}g`);
    console.log(`   Différence: ${(totalGrams - totalSoldGrams).toFixed(2)}g`);

    if (totalSoldGrams > totalGrams) {
      console.log(`\n   ❌ SURVENTE DÉTECTÉE!`);
      console.log(`   ❌ Vous avez vendu ${(totalSoldGrams - totalGrams).toFixed(2)}g DE PLUS que votre stock total!`);
    } else {
      console.log(`\n   ✅ Pas de survente (mais vérifier le statut du stock)`);
    }
  } else {
    console.log('   Aucune vente trouvée');
  }
}

checkProductionStatuses().catch(console.error);
