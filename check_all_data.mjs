import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkAll() {
  console.log('\n=== ANALYSE STOCK ET VENTES ===\n');

  // 1. Mining companies
  const { data: companies } = await supabase.from('mining_companies').select('*');
  console.log(`Mining Companies: ${companies ? companies.length : 0}`);
  const companyMap = {};
  if (companies) {
    companies.forEach(c => {
      companyMap[c.id] = c;
      console.log(`  - ${c.name} (${c.abbreviation}) - ${c.id}`);
    });
  }

  // 2. All sales
  console.log('\n\nVENTES:');
  const { data: sales } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
  console.log(`Total ventes: ${sales ? sales.length : 0}\n`);

  if (sales && sales.length > 0) {
    const bySeller = {};
    sales.forEach(s => {
      const sellerId = s.seller_id || 'unknown';
      if (!bySeller[sellerId]) {
        bySeller[sellerId] = { count: 0, totalOz: 0, sales: [] };
      }
      bySeller[sellerId].count++;
      bySeller[sellerId].totalOz += (s.quantity_oz || 0);
      bySeller[sellerId].sales.push(s);
    });

    Object.keys(bySeller).forEach(sellerId => {
      const company = companyMap[sellerId];
      const data = bySeller[sellerId];
      console.log(`${company ? company.name : sellerId}:`);
      console.log(`  Total: ${data.totalOz.toFixed(2)} oz (${(data.totalOz * 31.1035).toFixed(2)}g)`);
      console.log(`  Ventes (${data.count}):`);
      data.sales.forEach(s => {
        const grams = (s.quantity_oz || 0) * 31.1035;
        console.log(`    - ${s.sale_number}: ${s.quantity_oz} oz (${grams.toFixed(2)}g) - ${s.status}`);
      });
      console.log('');
    });
  }

  // 3. All productions with quantities
  console.log('\n\nPRODUCTIONS:');
  const { data: prods } = await supabase.from('daily_production').select('*').order('production_date', { ascending: false });
  console.log(`Total productions: ${prods ? prods.length : 0}\n`);

  if (prods && prods.length > 0) {
    const byCompany = {};
    prods.forEach(p => {
      const companyId = p.mining_company_id || 'unknown';
      if (!byCompany[companyId]) {
        byCompany[companyId] = { totalGrams: 0, count: 0, byStatus: {} };
      }
      const grams = p.quantity_grams || 0;
      if (grams > 0) {
        byCompany[companyId].totalGrams += grams;
        byCompany[companyId].count++;
        const status = p.status || 'null';
        if (!byCompany[companyId].byStatus[status]) {
          byCompany[companyId].byStatus[status] = { count: 0, grams: 0 };
        }
        byCompany[companyId].byStatus[status].count++;
        byCompany[companyId].byStatus[status].grams += grams;
      }
    });

    Object.keys(byCompany).forEach(companyId => {
      const company = companyMap[companyId];
      const data = byCompany[companyId];
      if (data.totalGrams > 0) {
        console.log(`${company ? company.name : companyId}:`);
        console.log(`  Total stock: ${data.totalGrams.toFixed(2)}g (${(data.totalGrams / 31.1035).toFixed(2)} oz)`);
        console.log(`  Batches: ${data.count}`);
        console.log(`  Par statut:`);
        Object.keys(data.byStatus).forEach(status => {
          const s = data.byStatus[status];
          console.log(`    - ${status}: ${s.grams.toFixed(2)}g (${s.count} batches)`);
        });
        console.log('');
      }
    });
  }

  // 4. Compare
  console.log('\n\n=== COMPARAISON ===\n');
  Object.keys(companyMap).forEach(companyId => {
    const company = companyMap[companyId];

    const salesData = sales ? sales.filter(s => s.seller_id === companyId) : [];
    const totalSoldOz = salesData.reduce((sum, s) => sum + (s.quantity_oz || 0), 0);
    const totalSoldGrams = totalSoldOz * 31.1035;

    const prodData = prods ? prods.filter(p => p.mining_company_id === companyId) : [];
    const totalStockGrams = prodData.reduce((sum, p) => sum + (p.quantity_grams || 0), 0);

    if (totalStockGrams > 0 || totalSoldGrams > 0) {
      console.log(`${company.name} (${company.abbreviation}):`);
      console.log(`  Stock total: ${totalStockGrams.toFixed(2)}g`);
      console.log(`  Total vendu: ${totalSoldGrams.toFixed(2)}g`);
      console.log(`  Différence: ${(totalStockGrams - totalSoldGrams).toFixed(2)}g`);

      if (totalSoldGrams > totalStockGrams) {
        console.log(`  ❌ SURVENTE: ${(totalSoldGrams - totalStockGrams).toFixed(2)}g`);
      } else {
        console.log(`  ✅ OK`);
      }
      console.log('');
    }
  });
}

checkAll().catch(console.error);
