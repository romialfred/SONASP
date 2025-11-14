#!/usr/bin/env node

/**
 * Database Triggers and Functions Analyzer
 * Connects to Supabase and extracts all triggers and functions
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('═══════════════════════════════════════════════════════════════');
console.log('DATABASE TRIGGERS & FUNCTIONS ANALYSIS');
console.log('═══════════════════════════════════════════════════════════════\n');

// Query 1: Get all custom functions
async function getAllFunctions() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SECTION 1: ALL CUSTOM FUNCTIONS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        p.proname as function_name,
        pg_get_function_arguments(p.oid) as arguments,
        pg_catalog.format_type(p.prorettype, NULL) as return_type,
        CASE p.provolatile
          WHEN 'i' THEN 'IMMUTABLE'
          WHEN 's' THEN 'STABLE'
          WHEN 'v' THEN 'VOLATILE'
        END as volatility,
        CASE p.prosecdef
          WHEN true THEN 'DEFINER'
          ELSE 'INVOKER'
        END as security
      FROM pg_proc p
      LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.prokind = 'f'
      ORDER BY p.proname;
    `
  });

  if (error) {
    console.log('⚠️  Direct RPC not available. Using alternative method...\n');
    return await getTablesAlternative();
  }

  console.table(data);
  return data;
}

// Alternative method: Get info from information_schema
async function getTablesAlternative() {
  const { data: tables, error } = await supabase
    .from('information_schema.tables')
    .select('*')
    .eq('table_schema', 'public');

  if (error) {
    console.error('❌ Could not fetch database information:', error.message);
    console.log('\n📋 RECOMMENDATION:');
    console.log('Run the SQL analysis script directly in Supabase SQL Editor:');
    console.log('File: /tmp/cc-agent/59164212/project/comprehensive_db_analysis.sql\n');
    return;
  }

  console.log('✅ Found tables in database:\n');
  tables.forEach(table => {
    console.log(`  - ${table.table_name}`);
  });
}

// Query 2: Analyze specific trigger functions we know exist
async function analyzeKnownTriggers() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SECTION 2: KNOWN TRIGGER FUNCTIONS FROM MIGRATIONS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const knownTriggers = [
    {
      name: 'log_production_status_change()',
      table: 'daily_production',
      trigger_name: 'production_status_change_trigger',
      purpose: 'Tracks production status changes in unified_status_history',
      timing: 'AFTER INSERT OR UPDATE',
      file: '20251114_008_fix_production_status_trigger_COMPLETE.sql'
    },
    {
      name: 'create_shipping_status_history_on_update()',
      table: 'shipping_preparations',
      trigger_name: 'shipping_status_change_trigger',
      purpose: 'Tracks shipping status changes',
      timing: 'AFTER INSERT OR UPDATE OF status',
      file: '20251114_006_add_shipping_status_history_FIXED.sql'
    },
    {
      name: 'update_license_status()',
      table: 'export_licenses',
      trigger_name: 'trigger_update_license_status',
      purpose: 'Auto-updates export license status',
      timing: 'BEFORE UPDATE',
      file: 'add_license_quota_functions.sql'
    }
  ];

  console.log('📋 TRIGGER FUNCTIONS:');
  console.table(knownTriggers);

  console.log('\n📋 BUSINESS LOGIC FUNCTIONS:');
  const businessFunctions = [
    {
      name: 'check_license_availability()',
      purpose: 'Validates if a license has sufficient quota',
      returns: 'TABLE (is_available, remaining_quantity, message)'
    },
    {
      name: 'reserve_license_quota()',
      purpose: 'Reserves quota on a license for shipping',
      returns: 'BOOLEAN'
    },
    {
      name: 'release_license_quota()',
      purpose: 'Releases quota when shipment is cancelled',
      returns: 'BOOLEAN'
    }
  ];
  console.table(businessFunctions);
}

// Query 3: Check if tables exist
async function checkCriticalTables() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SECTION 3: CRITICAL TABLES STATUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const criticalTables = [
    'daily_production',
    'shipping_preparations',
    'export_licenses',
    'unified_status_history',
    'shipping_status_history'
  ];

  console.log('Checking if critical tables exist...\n');

  for (const tableName of criticalTables) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`  ❌ ${tableName.padEnd(30)} - NOT FOUND or NO ACCESS`);
    } else {
      console.log(`  ✅ ${tableName.padEnd(30)} - EXISTS (${data?.length || 0} rows)`);
    }
  }
}

// Main execution
async function main() {
  try {
    await getAllFunctions();
    await analyzeKnownTriggers();
    await checkCriticalTables();

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('ANALYSIS COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('📝 NEXT STEPS:');
    console.log('1. For detailed function definitions, run comprehensive_db_analysis.sql in Supabase SQL Editor');
    console.log('2. File location: /tmp/cc-agent/59164212/project/comprehensive_db_analysis.sql');
    console.log('3. Copy contents and paste into: https://supabase.com/dashboard/project/[your-project]/sql\n');

  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
    console.log('\n⚠️  The anon key has limited permissions.');
    console.log('For full analysis, run the SQL script directly in Supabase SQL Editor.\n');
  }
}

main();
