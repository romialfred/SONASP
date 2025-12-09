import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function verifyRefineries() {
  console.log('🔍 Checking refineries table...\n');

  const { data: refineries, error } = await supabase
    .from('refineries')
    .select('*')
    .order('name');

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`✅ Found ${refineries.length} refineries in 'refineries' table:\n`);
  refineries.forEach((ref, i) => {
    console.log(`${i + 1}. ${ref.name} (ID: ${ref.id})`);
    console.log(`   Location: ${ref.location || ref.city}, ${ref.country}`);
    console.log('');
  });
}

verifyRefineries();
