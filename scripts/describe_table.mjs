import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Try to select from the table to see what columns exist
const { data, error } = await supabase
  .from('gold_prices_daily')
  .select('*')
  .limit(1);

console.log('Data columns available:', data ? Object.keys(data[0] || {}) : []);
console.log('Error:', error);

// Try also with a simple select to get column info
const { data: emptyData, error: emptyError } = await supabase
  .from('gold_prices_daily')
  .select()
  .limit(0);

console.log('\nEmpty select error:', emptyError);
