import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkStockIssue() {
  console.log('\n=== ANALYSE DU PROBLÈME DE STOCK KGM ===\n');

  // 1. Trouver KGM (Kouroussa)
  const { data: companies } = await supabase
    .from('mining_companies')
    .select('*')
    .ilike('name', '%kgm%');

  const kgm = companies && companies[0];

  if (!kgm) {
    console.log('❌ KGM non trouvé, essayons Kouroussa');
    const { data: kouroussa } = await supabase
      .from('mining_companies')
      .select('*')
      .ilike('name', '%kouroussa%');

    if (!kouroussa || kouroussa.length === 0) {
      console.log('❌ Aucune mining company trouvée');
      return;
    }
  }

  const miningCompany = kgm || companies?.[0];
  console.log(`✅ Mining Company trouvée: ${miningCompany.name} (ID: ${miningCompany.id})`);

  // 2. Vérifier le stock dans daily_production
  const { data: productions } = await supabase
    .from('daily_production')
    .select('*')
    .eq('mining_company_id', miningCompany.id)
    .eq('status', 'in_safe');

  console.log(`\n📦 Productions en stock (status=in_safe): ${productions?.length || 0}`);

  const totalStock = productions?.reduce((sum, p) => sum + (p.quantity_grams || 0), 0) || 0;
  console.log(`   Total Stock Disponible: ${totalStock.toFixed(2)} grammes`);

  // 3. Vérifier les ventes
  const { data: sales } = await supabase
    .from('sales')
    .select('*, customers(name)')
    .eq('seller_id', miningCompany.id)
    .order('created_at', { ascending: false });

  console.log(`\n💰 Ventes de ${miningCompany.name}: ${sales?.length || 0}`);

  if (sales && sales.length > 0) {
    let totalSold = 0;
    sales.forEach(sale => {
      const qtyGrams = (sale.quantity_oz || 0) * 31.1035;
      totalSold += qtyGrams;
      console.log(`   - ${sale.sale_number}: ${qtyGrams.toFixed(2)}g (${sale.quantity_oz} oz) - ${sale.customers?.name || 'N/A'} - Status: ${sale.status}`);
    });
    console.log(`\n   📊 Total Vendu: ${totalSold.toFixed(2)} grammes`);
    console.log(`   📦 Stock Disponible: ${totalStock.toFixed(2)} grammes`);
    console.log(`   ➖ Différence: ${(totalStock - totalSold).toFixed(2)} grammes`);

    if (totalSold > totalStock) {
      console.log(`\n   ❌ SURVENTE DÉTECTÉE!`);
      console.log(`   ❌ Vous avez vendu ${(totalSold - totalStock).toFixed(2)}g DE PLUS que votre stock!`);
      console.log(`   ❌ C'est ${((totalSold / totalStock - 1) * 100).toFixed(1)}% de survente!`);
    } else {
      console.log(`\n   ✅ Stock suffisant`);
    }
  }

  // 4. Vérifier la structure des sales
  console.log('\n🔍 Vérification de la structure de validation...');
  const { data: sampleSale } = await supabase
    .from('sales')
    .select('*')
    .limit(1)
    .single();

  if (sampleSale) {
    console.log('   Colonnes dans sales:', Object.keys(sampleSale).join(', '));
  }
}

checkStockIssue().catch(console.error);
