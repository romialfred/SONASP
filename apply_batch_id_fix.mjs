import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('🔧 Starting batch_id fix migration...\n');

  try {
    // Read the SQL file
    const sql = readFileSync('/tmp/cc-agent/59164212/project/fix_batch_id_migration.sql', 'utf-8');

    // Split the SQL into individual statements
    const statements = sql
      .split('$$;')
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => {
        if (!stmt.includes('$$')) {
          return stmt.trim();
        }
        return stmt + '$$;';
      });

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement.length === 0 || statement.startsWith('--')) continue;

      console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);

      const { error } = await supabase.rpc('exec_sql', {
        sql_string: statement
      });

      if (error) {
        console.error(`❌ Error executing statement ${i + 1}:`, error);
        throw error;
      }

      console.log(`✅ Statement ${i + 1} executed successfully\n`);
    }

    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log('  - Removed batch_id foreign key constraint');
    console.log('  - Dropped batch_id column from inventory_transactions');
    console.log('  - Ensured freight_shipment_id column exists');
    console.log('  - Updated create_inventory_transaction() function');
    console.log('  - Recreated trigger without batch_id reference');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();
