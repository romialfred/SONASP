import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkTables() {
  console.log('🔍 Checking refineries table...\n');

  const { data: refineries, error: refError } = await supabase
    .from('refineries')
    .select('*')
    .order('name');

  if (refError) {
    console.error('❌ Error with refineries:', refError.message);
  } else {
    console.log(`✅ Found ${refineries ? refineries.length : 0} entries in refineries table\n`);
    if (refineries && refineries.length > 0) {
      refineries.forEach((ref, i) => {
        console.log(`${i + 1}. ${ref.name} (ID: ${ref.id})`);
        console.log(`   Location: ${ref.city || 'N/A'}, ${ref.country || 'N/A'}`);
        console.log('');
      });
    }
  }

  console.log('\n🔍 Checking refinery_plants table...\n');

  const { data: plants, error: plantsError } = await supabase
    .from('refinery_plants')
    .select('*')
    .order('name');

  if (plantsError) {
    console.error('❌ Error with refinery_plants:', plantsError.message);
  } else {
    console.log(`✅ Found ${plants ? plants.length : 0} entries in refinery_plants table\n`);
    if (plants && plants.length > 0) {
      plants.forEach((plant, i) => {
        console.log(`${i + 1}. ${plant.name} (ID: ${plant.id})`);
        console.log(`   Location: ${plant.city || 'N/A'}, ${plant.country || 'N/A'}`);
        console.log('');
      });
    }
  }

  console.log('\n🔍 Checking shipping_preparations foreign key...\n');

  const { data: preps, error: prepsError } = await supabase
    .from('shipping_preparations')
    .select('id, refinery_id')
    .limit(1);

  if (prepsError) {
    console.log('Error querying shipping_preparations:', prepsError.message);
  } else {
    console.log('✅ shipping_preparations table accessible');
    console.log('   Has refinery_id column');
  }
}

checkTables();
