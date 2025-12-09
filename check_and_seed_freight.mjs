import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function main() {
  console.log('=== VERIFICATION FREIGHT_SHIPMENTS ===\n');

  // Vérifier les données existantes
  const { data: existing, error, count } = await supabase
    .from('freight_shipments')
    .select('*', { count: 'exact' });

  if (error) {
    console.error('Erreur lors de la lecture:', error);
    return;
  }

  console.log(`Total d'enregistrements: ${count}\n`);

  if (existing && existing.length > 0) {
    console.log('Données trouvées:');
    existing.forEach((shipment, index) => {
      console.log(`\n${index + 1}. ${shipment.reference_number}`);
      console.log(`   Status: ${shipment.status}`);
      console.log(`   Or pur: ${shipment.total_pure_gold_oz} oz (${shipment.total_pure_gold_grams} g)`);
      console.log(`   Valeur: $${shipment.total_value_usd?.toLocaleString()}`);
      console.log(`   Créé: ${new Date(shipment.created_at).toLocaleString()}`);
    });

    // Afficher les statuts
    console.log('\n=== STATUTS DISPONIBLES ===');
    const statuses = [...new Set(existing.map(s => s.status))];
    statuses.forEach(status => {
      const count = existing.filter(s => s.status === status).length;
      console.log(`- ${status}: ${count}`);
    });
  } else {
    console.log('Aucune donnée trouvée dans freight_shipments.\n');
    console.log('Pour créer des données de test, vous devez:');
    console.log('1. Créer une production journalière dans Daily Production');
    console.log('2. L\'approuver pour expédition');
    console.log('3. Créer une expédition freight dans le module Freight');
    console.log('4. L\'approuver pour qu\'elle apparaisse dans Refining Process');
  }

  console.log('\n=== FIN ===');
}

main().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
