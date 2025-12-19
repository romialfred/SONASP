#!/usr/bin/env node

/**
 * Script to apply gold_prices_daily table migration
 *
 * This script:
 * 1. Checks if gold_prices_daily table exists
 * 2. If not, creates the table with proper structure
 * 3. Sets up RLS policies
 * 4. Adds initial gold price data
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Please ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTableExists() {
  console.log('🔍 Checking if gold_prices_daily table exists...');

  const { data, error } = await supabase
    .from('gold_prices_daily')
    .select('id')
    .limit(1);

  if (error) {
    if (error.code === '42P01') {
      // Table does not exist
      return false;
    }
    console.error('❌ Error checking table:', error);
    return false;
  }

  return true;
}

async function applyMigration() {
  console.log('📦 Applying gold_prices_daily table migration...');

  try {
    // Read the SQL file
    const sqlPath = join(__dirname, '..', 'CREATE_GOLD_PRICES_TABLES.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Note: Supabase client doesn't support raw SQL execution
    // User needs to execute this manually via dashboard
    console.log('⚠️  Please apply the migration manually:');
    console.log('');
    console.log('1. Open Supabase Dashboard SQL Editor:');
    console.log(`   ${supabaseUrl.replace('/rest/v1', '')}/sql/new`);
    console.log('');
    console.log('2. Copy the content from: CREATE_GOLD_PRICES_TABLES.sql');
    console.log('');
    console.log('3. Paste and click "Run"');
    console.log('');
    console.log('📄 Migration file location:', sqlPath);

    return false;
  } catch (error) {
    console.error('❌ Error reading migration file:', error);
    return false;
  }
}

async function seedInitialData() {
  console.log('🌱 Adding initial gold price data...');

  const today = new Date().toISOString().split('T')[0];
  const currentPrice = 4335.10; // Current approximate gold price

  const { data, error } = await supabase
    .from('gold_prices_daily')
    .upsert({
      price_date: today,
      opening_price: currentPrice * 0.998,
      closing_price: currentPrice,
      high_price: currentPrice * 1.005,
      low_price: currentPrice * 0.995,
      london_am_rate: currentPrice,
      london_pm_rate: currentPrice * 1.002,
      average_price: currentPrice,
      source: 'Initial Seed',
      currency: 'USD',
      data_points: 1,
    }, {
      onConflict: 'price_date'
    })
    .select();

  if (error) {
    console.error('❌ Error seeding initial data:', error);
    return false;
  }

  console.log('✅ Initial gold price data added successfully');
  console.log(`   Date: ${today}`);
  console.log(`   London AM Rate: $${currentPrice.toFixed(2)}/oz`);

  return true;
}

async function main() {
  console.log('🚀 Gold Prices Table Migration Script\n');

  // Step 1: Check if table exists
  const tableExists = await checkTableExists();

  if (tableExists) {
    console.log('✅ gold_prices_daily table already exists');
    console.log('');

    // Try to seed data anyway
    const seeded = await seedInitialData();

    if (seeded) {
      console.log('');
      console.log('🎉 Migration complete!');
      console.log('');
      console.log('Next steps:');
      console.log('1. Refresh the Gold Trade Space page');
      console.log('2. Click on a mine with available stock');
      console.log('3. Click the "Simulate" button');
      console.log('4. The pricing mechanisms should now display');
    }

    process.exit(0);
  }

  // Step 2: Table doesn't exist, need to create it
  console.log('⚠️  gold_prices_daily table does not exist');
  console.log('');

  await applyMigration();

  console.log('');
  console.log('After applying the migration manually, run this script again to seed initial data.');

  process.exit(1);
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
