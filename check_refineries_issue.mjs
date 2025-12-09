import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkRefineries() {
  console.log('🔍 Checking refinery_plants table...\n');

  const { data: refineries, error } = await supabase
    .from('refinery_plants')
    .select('*')
    .order('name');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`Found ${refineries ? refineries.length : 0} refineries:\n`);
  if (refineries) {
    refineries.forEach((ref, i) => {
      console.log(`${i + 1}. ${ref.name} (ID: ${ref.id})`);
      console.log(`   Location: ${ref.city}, ${ref.country}`);
      console.log(`   Status: ${ref.is_active ? '✅ Active' : '❌ Inactive'}`);
      console.log('');
    });
  }
}

checkRefineries();
