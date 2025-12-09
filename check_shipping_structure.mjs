import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkStructure() {
  console.log('=== STRUCTURE DE LA TABLE shipping_preparations ===\n');
  
  const { data, error } = await supabase
    .from('shipping_preparations')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('Erreur:', error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('Colonnes disponibles:');
    Object.keys(data[0]).forEach(key => {
      console.log('  -', key);
    });
  }
}

checkStructure();
