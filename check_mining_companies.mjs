import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkMiningCompanies() {
  console.log('\n=== LISTE DE TOUTES LES MINING COMPANIES ===\n');

  const { data: companies, error } = await supabase
    .from('mining_companies')
    .select('*');

  if (error) {
    console.error('❌ Erreur:', error);
    return;
  }

  if (!companies || companies.length === 0) {
    console.log('❌ Aucune mining company trouvée');
    return;
  }

  console.log(`✅ ${companies.length} mining companies trouvées:\n`);
  companies.forEach((company, index) => {
    console.log(`${index + 1}. ${company.name} (ID: ${company.id})`);
    console.log(`   Abbreviation: ${company.abbreviation || 'N/A'}`);
    console.log(`   Country: ${company.country || 'N/A'}`);
    console.log('');
  });

  // Now check stock for each company
  for (const company of companies) {
    console.log(`\n📦 Stock de ${company.name}:`);

    const { data: productions } = await supabase
      .from('daily_production')
      .select('*')
      .eq('mining_company_id', company.id)
      .eq('status', 'in_safe');

    const totalStock = productions?.reduce((sum, p) => sum + (p.quantity_grams || 0), 0) || 0;
    console.log(`   Total en stock (in_safe): ${totalStock.toFixed(2)}g (${(totalStock / 31.1035).toFixed(2)} oz)`);

    const { data: sales } = await supabase
      .from('sales')
      .select('*')
      .eq('seller_id', company.id);

    if (sales && sales.length > 0) {
      const totalSold = sales.reduce((sum, s) => sum + ((s.quantity_oz || 0) * 31.1035), 0);
      console.log(`   Total vendu: ${totalSold.toFixed(2)}g (${(totalSold / 31.1035).toFixed(2)} oz)`);
      console.log(`   Nombre de ventes: ${sales.length}`);

      if (totalSold > totalStock) {
        console.log(`   ❌ SURVENTE: ${(totalSold - totalStock).toFixed(2)}g de plus que le stock!`);
      }
    }
  }
}

checkMiningCompanies().catch(console.error);
