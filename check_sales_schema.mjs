import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkSchema() {
  console.log('\nVérification du schéma de la table sales...\n');

  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Erreur:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Colonnes dans sales:');
    Object.keys(data[0]).sort().forEach(col => {
      console.log(`  - ${col}`);
    });
  } else {
    console.log('Aucune vente trouvée, impossible de déterminer les colonnes');
    console.log('Tentative de création d\'une vente de test pour voir les colonnes...');
  }
}

checkSchema().catch(console.error);
