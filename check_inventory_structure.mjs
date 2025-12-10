import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('🔍 Checking gold_inventory table structure...\n');

// Query to get table structure
const { data: goldInventoryColumns, error: goldError } = await supabase
  .rpc('exec_sql', {
    sql_query: `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'gold_inventory'
      ORDER BY ordinal_position;
    `
  });

if (goldError) {
  console.error('❌ Error querying gold_inventory:', goldError);
} else {
  console.log('✅ gold_inventory columns:');
  console.table(goldInventoryColumns);
}

console.log('\n🔍 Checking inventory_transactions table structure...\n');

const { data: transactionsColumns, error: transError } = await supabase
  .rpc('exec_sql', {
    sql_query: `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'inventory_transactions'
      ORDER BY ordinal_position;
    `
  });

if (transError) {
  console.error('❌ Error querying inventory_transactions:', transError);
} else {
  console.log('✅ inventory_transactions columns:');
  console.table(transactionsColumns);
}

// Check for foreign key constraints
console.log('\n🔍 Checking constraints on inventory tables...\n');

const { data: constraints, error: constraintError } = await supabase
  .rpc('exec_sql', {
    sql_query: `
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.table_name IN ('gold_inventory', 'inventory_transactions')
        AND (tc.constraint_type = 'FOREIGN KEY' OR kcu.column_name LIKE '%batch%')
      ORDER BY tc.table_name, tc.constraint_name;
    `
  });

if (constraintError) {
  console.error('❌ Error querying constraints:', constraintError);
} else {
  console.log('✅ Constraints related to batch:');
  console.table(constraints);
}

console.log('\n✅ Analysis complete!');
