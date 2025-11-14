const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function verifyDatabase() {
  console.log('\n📊 VÉRIFICATION DE LA STRUCTURE DE LA BASE DE DONNÉES\n');
  console.log('='.repeat(60));

  const tablesToCheck = [
    'daily_production',
    'shipping_preparations',
    'freight_customs',
    'refinery_batches',
    'inventory',
    'sales',
    'production_status_history'
  ];

  console.log('\n1️⃣  VÉRIFICATION DES TABLES:\n');

  for (const tableName of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (error) {
        if (error.code === '42P01') {
          console.log(`  ❌ ${tableName}: N'EXISTE PAS`);
        } else {
          console.log(`  ⚠️  ${tableName}: Erreur - ${error.message}`);
        }
      } else {
        console.log(`  ✅ ${tableName}: Existe`);

        // Vérifier la colonne status
        const { data: columns } = await supabase.rpc('get_table_columns', { table_name: tableName }).limit(0);
      }
    } catch (err) {
      console.log(`  ⚠️  ${tableName}: Erreur de vérification`);
    }
  }

  console.log('\n2️⃣  VÉRIFICATION DES COLONNES STATUS:\n');

  // Vérifier daily_production en détail
  try {
    const { data, error } = await supabase
      .from('daily_production')
      .select('id, status, created_at')
      .limit(1);

    if (!error && data && data.length > 0) {
      console.log(`  ✅ daily_production.status existe`);
      console.log(`     Type actuel: ${typeof data[0].status}`);
      console.log(`     Exemple: "${data[0].status}"`);
    } else if (!error) {
      console.log(`  ⚠️  daily_production est vide`);
    }
  } catch (err) {
    console.log(`  ❌ Impossible de lire daily_production.status`);
  }

  console.log('\n3️⃣  STATISTIQUES:\n');

  try {
    const { count: prodCount } = await supabase
      .from('daily_production')
      .select('*', { count: 'exact', head: true });

    console.log(`  • Nombre de productions: ${prodCount || 0}`);
  } catch (err) {
    console.log(`  ⚠️  Impossible de compter les productions`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Vérification terminée\n');
}

verifyDatabase().catch(console.error);
