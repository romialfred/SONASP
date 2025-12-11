/**
 * Import LBMA Data with Service Role Key
 * Uses SERVICE_ROLE_KEY to bypass RLS for admin import
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  console.error('❌ VITE_SUPABASE_URL not found in .env');
  process.exit(1);
}

if (!serviceKey) {
  console.error('❌ Service role key not found in .env');
  console.error('Please add one of:');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY=your_service_key');
  console.error('  - VITE_SUPABASE_SERVICE_KEY=your_service_key');
  console.error('\nYou can find it in: Supabase Dashboard > Settings > API > service_role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

console.log('✅ Using Service Role Key for admin import\n');

// Import using same logic but with service role permissions
// Copy the import logic here or import from the other file
// For now, let's create a simple test

async function testInsert() {
  console.log('Testing insert with service role key...');

  const testData = {
    price_date: '2025-01-02',
    london_am_rate: 2700.00,
    london_pm_rate: 2705.00,
    spot_price: 2703.00,
    average_price: 2702.67,
    high_price: 2710.00,
    low_price: 2695.00,
    source: 'Test',
    currency: 'USD',
    notes: 'Test data',
  };

  const { data, error } = await supabase
    .from('gold_prices_daily')
    .upsert(testData, { onConflict: 'price_date' })
    .select();

  if (error) {
    console.error('❌ Error:', error);
    return false;
  }

  console.log('✅ Test insert successful!');
  console.log('   Data:', data);
  return true;
}

testInsert().then(success => {
  if (success) {
    console.log('\n✅ Service key works! You can now run the full import.');
    console.log('   Update the main script to use SERVICE_ROLE_KEY');
  }
  process.exit(success ? 0 : 1);
});
