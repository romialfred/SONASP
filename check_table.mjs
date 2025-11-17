import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('Checking monthly_budgets table structure...\n');

// Check table structure
const { data: columns, error } = await supabase
  .rpc('get_table_columns', { table_name: 'monthly_budgets' })
  .catch(() => null);

// Try direct query
const { data, error: queryError } = await supabase
  .from('monthly_budgets')
  .select('*')
  .limit(1);

console.log('Query error:', queryError);
console.log('Data:', data);
