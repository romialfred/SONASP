import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('🚀 Starting shipping system migration...\n');

    // Read the migration file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', 'add_shipping_system.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully');
    console.log(`📊 SQL length: ${migrationSQL.length} characters\n`);

    // Split SQL into individual statements (basic split by semicolon)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute migration using RPC or direct query
    // Note: Supabase client doesn't support multi-statement execution directly
    // We need to execute the full SQL as one block
    console.log('⚙️  Executing migration SQL...');

    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL }).catch(() => {
      // If RPC doesn't work, try direct approach
      return { data: null, error: { message: 'RPC not available, using fallback' } };
    });

    if (error) {
      // Fallback: Try to execute via admin API or use service role key
      console.log('⚠️  RPC method not available');
      console.log('📌 Please apply this migration manually using Supabase Dashboard:');
      console.log('   1. Go to: https://boolqagzdqbahqnpawpb.supabase.co');
      console.log('   2. Navigate to SQL Editor');
      console.log('   3. Paste and run the contents of: supabase/migrations/add_shipping_system.sql');
      console.log('\n✨ Migration file is ready at:');
      console.log('   ' + migrationPath);
      return;
    }

    console.log('\n✅ Migration applied successfully!');
    console.log('\n📋 Created tables:');
    console.log('   • shipping_preparations');
    console.log('   • shipping_production_items');
    console.log('   • shipping_signatories');
    console.log('   • shipping_ingots');
    console.log('   • shipping_documents');
    console.log('\n🔐 Security:');
    console.log('   • RLS enabled on all tables');
    console.log('   • Policies created for authenticated users');
    console.log('\n🎉 Shipping system is now ready to use!');

  } catch (error) {
    console.error('\n❌ Error applying migration:', error);
    console.error('\n📌 Manual migration required:');
    console.error('   Please apply supabase/migrations/add_shipping_system.sql manually');
    process.exit(1);
  }
}

applyMigration();
