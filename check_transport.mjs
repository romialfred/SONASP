import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkTransportCompanies() {
  console.log('Checking transport_companies table...');
  
  const { data, error } = await supabase
    .from('transport_companies')
    .select('*')
    .order('name');
  
  if (error) {
    console.error('ERROR:', error);
    return;
  }
  
  console.log('Found', data.length, 'companies:');
  console.log(JSON.stringify(data, null, 2));
}

checkTransportCompanies();
