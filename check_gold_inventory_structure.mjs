import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkStructure() {
  console.log('Checking gold_inventory table structure...\n');

  const { data, error } = await supabase
    .from('gold_inventory')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log('Columns in gold_inventory table:');
    console.log(Object.keys(data[0]));
  } else {
    console.log('No data in gold_inventory table');
  }
}

checkStructure();
