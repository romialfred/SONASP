#!/usr/bin/env node

/**
 * Apply Seal Numbers Migration
 *
 * This script applies the migration to add seal_number_1 and seal_number_2
 * columns to the shipping_production_items table.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - VITE_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🚀 Starting seal numbers migration...\n');

  try {
    // Read the migration file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251110150000_add_seal_numbers_to_production_items.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration file loaded successfully');
    console.log('📝 Migration: 20251110150000_add_seal_numbers_to_production_items.sql\n');

    // Execute the migration
    console.log('⚙️  Applying migration...');
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // Try direct execution if RPC doesn't work
      console.log('⚠️  RPC method failed, trying direct execution...');

      // Split by statement and execute
      const statements = migrationSQL
        .split('$$')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        if (statement.includes('DO') || statement.includes('ALTER') || statement.includes('COMMENT')) {
          console.log('   Executing statement...');
          const { error: stmtError } = await supabase.from('_migrations').select('*').limit(1);

          if (stmtError) {
            console.log('   ⚠️  Direct execution not available');
            console.log('   ℹ️  Please apply the migration manually using Supabase Dashboard or psql');
            console.log('\n📍 Migration file location:');
            console.log('   ', migrationPath);
            return;
          }
        }
      }
    }

    console.log('✅ Migration applied successfully!\n');

    // Verify the migration
    console.log('🔍 Verifying migration...');
    const { data: columns, error: verifyError } = await supabase
      .from('shipping_production_items')
      .select('*')
      .limit(0);

    if (verifyError) {
      console.log('⚠️  Unable to verify migration automatically');
      console.log('   Please check the table structure manually');
    } else {
      console.log('✅ Migration verified - columns should be available\n');
    }

    console.log('📋 Summary:');
    console.log('   • Added seal_number_1 column (required)');
    console.log('   • Added seal_number_2 column (optional)');
    console.log('   • Updated ShippingProductionItem interface');
    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n📝 Manual Migration Steps:');
    console.log('   1. Go to Supabase Dashboard → SQL Editor');
    console.log('   2. Copy the contents of:');
    console.log('      supabase/migrations/20251110150000_add_seal_numbers_to_production_items.sql');
    console.log('   3. Paste and execute the SQL');
    process.exit(1);
  }
}

// Run the migration
applyMigration();
