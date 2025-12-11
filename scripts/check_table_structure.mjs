import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Try to insert a test record to see what fields are expected
const testRecord = {
  price_date: '2024-01-01',
  london_am_rate: 2000.00,
  opening_price: 2000.00,
  closing_price: 2000.00,
  high_price: 2000.00,
  low_price: 2000.00,
  source: 'Test',
  currency: 'USD',
};

const { data, error } = await supabase
  .from('gold_prices_daily')
  .insert(testRecord)
  .select();

console.log('Data:', data);
console.log('Error:', error);
