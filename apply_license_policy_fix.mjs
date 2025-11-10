import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env');
  console.log('📋 This migration requires service role key to modify RLS policies');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🔧 Applying License Requests RLS Policy Fix Migration...\n');
  
  const migrationSQL = readFileSync(
    'supabase/migrations/20251110160000_fix_license_requests_policies.sql',
    'utf8'
  );
  
  console.log('📜 Migration SQL loaded');
  console.log('🚀 Executing migration...\n');
  
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: migrationSQL
  });
  
  if (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n📋 Attempting direct execution via query...');
    
    // Try to execute via direct query
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('/*') && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.length < 10) continue;
      
      try {
        const { error: stmtError } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        });
        
        if (stmtError) {
          console.error('❌ Statement error:', stmtError.message);
        } else {
          console.log('✅ Statement executed');
        }
      } catch (e) {
        console.error('❌ Exception:', e.message);
      }
    }
    
    return;
  }
  
  console.log('✅ Migration applied successfully!');
  console.log('\n📋 Changes made:');
  console.log('  ✅ Removed restrictive SELECT policy');
  console.log('  ✅ Removed restrictive INSERT policy');
  console.log('  ✅ Removed restrictive UPDATE policy');
  console.log('  ✅ Added permissive policies for all authenticated users');
  console.log('\n🎉 License requests should now display correctly!');
}

applyMigration().catch(console.error);
