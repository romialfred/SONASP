import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkColumns() {
  console.log('=== Vérification des colonnes de fx_rates_monthly_aggregated ===\n');

  // Essayer avec un insert vide pour voir les colonnes requises
  const testData = {
    year: 2024,
    month: 1,
    source_id: '00000000-0000-0000-0000-000000000000',
    currency_pair: 'TEST/TEST'
  };

  console.log('Test 1: Insert simple avec colonnes minimales...');
  const { error: error1 } = await supabase
    .from('fx_rates_monthly_aggregated')
    .insert(testData);

  if (error1) {
    console.log('Erreur:', error1.message);
    console.log('Hint:', error1.hint || 'N/A');
  }

  // Test avec average_rate
  console.log('\nTest 2: Insert avec average_rate...');
  const testData2 = {
    ...testData,
    average_rate: 1.0
  };

  const { error: error2 } = await supabase
    .from('fx_rates_monthly_aggregated')
    .insert(testData2);

  if (error2) {
    console.log('Erreur:', error2.message);
  } else {
    console.log('✅ Succès! La colonne average_rate existe.');
    
    // Nettoyer
    await supabase
      .from('fx_rates_monthly_aggregated')
      .delete()
      .eq('currency_pair', 'TEST/TEST');
  }

  // Essayer de lire pour voir les colonnes
  console.log('\nTest 3: Lecture de données existantes...');
  const { data, error: error3 } = await supabase
    .from('fx_rates_monthly_aggregated')
    .select('*')
    .limit(1);

  if (error3) {
    console.log('Erreur:', error3.message);
  } else if (data && data.length > 0) {
    console.log('Colonnes trouvées:', Object.keys(data[0]));
  } else {
    console.log('Aucune donnée dans la table');
  }
}

checkColumns()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err);
    process.exit(1);
  });
