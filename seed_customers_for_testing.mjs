import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function seedCustomers() {
  console.log('\n=== SEEDING TEST CUSTOMERS ===\n');

  // Check existing customers first
  const { data: existing, error: checkError } = await supabase
    .from('customers')
    .select('id, name');

  if (checkError) {
    console.error('Error checking customers:', checkError);
    return;
  }

  console.log(`Found ${existing?.length || 0} existing customers`);

  if (existing && existing.length > 0) {
    console.log('Existing customers:');
    existing.forEach(c => console.log(`  - ${c.name}`));
    console.log('\nCustomers already exist. Skipping seed.');
    return;
  }

  // Get mining companies for assignment
  const { data: miningCompanies } = await supabase
    .from('mining_companies')
    .select('id, name')
    .limit(1);

  if (!miningCompanies || miningCompanies.length === 0) {
    console.error('No mining companies found. Cannot create customers.');
    return;
  }

  const miningCompanyId = miningCompanies[0].id;

  const testCustomers = [
    {
      name: 'Test Gold Refinery Ltd',
      email: 'contact@testgoldrefinery.com',
      country: 'United Arab Emirates',
      address: '123 Gold Street, Dubai',
      phone: '+971-4-1234567',
      contact_person: 'Mohammed Al Refinery',
      is_active: true
    },
    {
      name: 'Global Precious Metals Inc',
      email: 'sales@globalpreciousmetals.com',
      country: 'Switzerland',
      address: '456 Zurich Avenue, Zurich',
      phone: '+41-44-9876543',
      contact_person: 'Hans Mueller',
      is_active: true
    },
    {
      name: 'African Gold Trading Co',
      email: 'info@africangoldtrading.com',
      country: 'South Africa',
      address: '789 Johannesburg Road, Johannesburg',
      phone: '+27-11-555-1234',
      contact_person: 'John Sithole',
      is_active: true
    }
  ];

  console.log(`\nInserting ${testCustomers.length} test customers...`);

  const { data, error } = await supabase
    .from('customers')
    .insert(testCustomers)
    .select();

  if (error) {
    console.error('❌ Error inserting customers:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return;
  }

  console.log('✓ Successfully created customers:');
  data.forEach(c => console.log(`  - ${c.name} (${c.id})`));

  console.log('\n✓ Customers seeded successfully!');
}

seedCustomers().catch(console.error);
