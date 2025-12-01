#!/usr/bin/env node

/**
 * Execute TRUNCATE_OPERATIONAL_DATA.sql directly via Supabase
 * This simulates MCP execution but runs directly in Node.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Initialize Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🚀 Starting TRUNCATE operation...\n');

// Read the SQL script
const sqlScript = readFileSync(
  join(__dirname, 'TRUNCATE_OPERATIONAL_DATA.sql'),
  'utf8'
);

// Execute the script
try {
  console.log('📄 Reading TRUNCATE_OPERATIONAL_DATA.sql...');
  console.log(`📏 Script size: ${sqlScript.length} characters\n`);
  
  console.log('🔄 Executing SQL script via Supabase...\n');
  console.log('=' .repeat(60));
  
  // Execute using raw SQL via Supabase
  const { data, error } = await supabase.rpc('exec_sql', {
    query_text: sqlScript
  });
  
  if (error) {
    console.error('\n❌ Error executing script:');
    console.error('Message:', error.message);
    console.error('Details:', error.details);
    console.error('Hint:', error.hint);
    
    // If exec_sql doesn't exist, provide helpful message
    if (error.code === '42883') {
      console.error('\n⚠️  The exec_sql function is not configured in Supabase.');
      console.error('📝 Please run mcp-server/setup_exec_sql.sql in Supabase SQL Editor first.');
      console.error('\nAlternatively, copy TRUNCATE_OPERATIONAL_DATA.sql directly to Supabase SQL Editor.');
    }
    
    process.exit(1);
  }
  
  console.log('=' .repeat(60));
  console.log('\n✅ Script executed successfully!');
  
  if (data) {
    console.log('\n📊 Results:', JSON.stringify(data, null, 2));
  }
  
  // Verify the truncate worked
  console.log('\n🔍 Verifying truncate results...\n');
  
  const tables = [
    'daily_production',
    'freight_shipments',
    'sales',
    'payments'
  ];
  
  for (const table of tables) {
    try {
      const { count, error: countError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.log(`⚠️  ${table}: Could not verify (table may not exist)`);
      } else {
        const status = count === 0 ? '✅' : '⚠️';
        console.log(`${status} ${table}: ${count} rows`);
      }
    } catch (err) {
      console.log(`⚠️  ${table}: ${err.message}`);
    }
  }
  
  console.log('\n🎉 TRUNCATE operation completed!\n');
  
} catch (err) {
  console.error('\n❌ Unexpected error:');
  console.error(err);
  process.exit(1);
}
