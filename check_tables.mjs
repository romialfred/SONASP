import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkTables() {
  console.log('Checking different transport-related tables...\n');
  
  // Check transport_companies
  const { data: transport1, error: error1 } = await supabase
    .from('transport_companies')
    .select('*');
  
  console.log('transport_companies:', transport1 ? transport1.length : 0, 'records');
  
  // Check freight_companies
  const { data: transport2, error: error2 } = await supabase
    .from('freight_companies')
    .select('*');
  
  if (!error2) {
    console.log('freight_companies:', transport2 ? transport2.length : 0, 'records');
    if (transport2 && transport2.length > 0) {
      console.log('Freight companies found:');
      console.log(JSON.stringify(transport2, null, 2));
    }
  }
  
  // Check stakeholders table with freight companies
  const { data: stakeholders, error: error3 } = await supabase
    .from('stakeholders')
    .select('*')
    .eq('stakeholder_type', 'freight_company');
  
  if (!error3) {
    console.log('\nstakeholders (freight_company):', stakeholders ? stakeholders.length : 0, 'records');
    if (stakeholders && stakeholders.length > 0) {
      console.log('Stakeholders found:');
      console.log(JSON.stringify(stakeholders, null, 2));
    }
  }
}

checkTables();
