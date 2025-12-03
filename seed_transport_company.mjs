import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function seedTransportCompany() {
  console.log('Creating transport company...\n');
  
  const company = {
    name: 'Brinks Freight Express Limited',
    email: 'contact@brinks.com',
    phone: '+27 11 444 0000',
    company_type: 'both',
    address: 'Johannesburg, South Africa',
    contact_person: 'John Smith',
    is_active: true
  };
  
  const { data, error } = await supabase
    .from('transport_companies')
    .insert([company])
    .select();
  
  if (error) {
    console.error('ERROR:', error);
    return;
  }
  
  console.log('SUCCESS! Created transport company:');
  console.log(JSON.stringify(data, null, 2));
  
  // Verify
  const { data: allCompanies } = await supabase
    .from('transport_companies')
    .select('*');
  
  console.log('\nTotal companies in database:', allCompanies?.length);
}

seedTransportCompany();
