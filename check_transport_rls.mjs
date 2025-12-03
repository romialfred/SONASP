import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkTransportCompanies() {
  console.log('Checking transport_companies with ANON key...\n');
  
  // Test 1: Sans filtre
  console.log('Test 1: SELECT * FROM transport_companies');
  const { data: test1, error: error1 } = await supabase
    .from('transport_companies')
    .select('*');
  
  if (error1) {
    console.error('ERROR Test 1:', error1);
  } else {
    console.log('SUCCESS Test 1:', test1?.length, 'records');
    if (test1 && test1.length > 0) {
      console.log('First company:', test1[0]);
    }
  }
  
  // Test 2: Avec filtre is_active
  console.log('\nTest 2: SELECT * WHERE is_active = true');
  const { data: test2, error: error2 } = await supabase
    .from('transport_companies')
    .select('*')
    .eq('is_active', true);
  
  if (error2) {
    console.error('ERROR Test 2:', error2);
  } else {
    console.log('SUCCESS Test 2:', test2?.length, 'records');
  }
  
  // Test 3: Colonnes spécifiques
  console.log('\nTest 3: SELECT id, name, address, company_type WHERE is_active = true');
  const { data: test3, error: error3 } = await supabase
    .from('transport_companies')
    .select('id, name, address, company_type')
    .eq('is_active', true)
    .order('name');
  
  if (error3) {
    console.error('ERROR Test 3:', error3);
  } else {
    console.log('SUCCESS Test 3:', test3?.length, 'records');
    if (test3 && test3.length > 0) {
      console.log('Companies:', JSON.stringify(test3, null, 2));
    }
  }
}

checkTransportCompanies();
