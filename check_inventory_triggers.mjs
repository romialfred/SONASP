import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔍 Checking triggers and functions for batch_id references...\n');
console.log('Database URL:', supabaseUrl);
console.log('='.repeat(80));

// Using fetch to call the PostgREST API directly for better control
async function executeSQL(query) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({ sql_query: query })
  });

  if (!response.ok) {
    const error = await response.text();
    console.log(`❌ Query failed: ${error}`);
    return null;
  }

  return await response.json();
}

// Check for triggers on inventory tables
console.log('\n📋 1. TRIGGERS on gold_inventory:');
console.log('-'.repeat(80));

const triggersOnGoldInventory = await executeSQL(`
  SELECT
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
  FROM information_schema.triggers
  WHERE event_object_table = 'gold_inventory'
  ORDER BY trigger_name;
`);

if (triggersOnGoldInventory) {
  console.table(triggersOnGoldInventory);
} else {
  console.log('⚠️  Could not fetch triggers (RPC function might not exist)');
}

console.log('\n📋 2. TRIGGERS on inventory_transactions:');
console.log('-'.repeat(80));

const triggersOnTransactions = await executeSQL(`
  SELECT
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
  FROM information_schema.triggers
  WHERE event_object_table = 'inventory_transactions'
  ORDER BY trigger_name;
`);

if (triggersOnTransactions) {
  console.table(triggersOnTransactions);
} else {
  console.log('⚠️  Could not fetch triggers');
}

// Search for functions containing 'batch_id'
console.log('\n📋 3. FUNCTIONS containing "batch_id":');
console.log('-'.repeat(80));

const functionsWithBatchId = await executeSQL(`
  SELECT
    routine_name,
    routine_type,
    routine_definition
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND (routine_definition LIKE '%batch_id%' OR routine_name LIKE '%batch%')
  ORDER BY routine_name;
`);

if (functionsWithBatchId && functionsWithBatchId.length > 0) {
  console.log(`Found ${functionsWithBatchId.length} functions with 'batch_id':\n`);
  functionsWithBatchId.forEach(func => {
    console.log(`📦 ${func.routine_name} (${func.routine_type})`);
    console.log(`   Definition: ${func.routine_definition.substring(0, 200)}...`);
    console.log('');
  });
} else {
  console.log('✅ No functions found with batch_id references');
}

console.log('\n' + '='.repeat(80));
console.log('✅ Analysis complete!');
console.log('='.repeat(80));
