import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('📦 Reading migration file...');
    const sql = readFileSync('./temp_status_manager_migration.sql', 'utf8');

    console.log('🚀 Applying migration...');
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!');
    console.log('📊 Verifying tables...');

    const { data: templates } = await supabase.from('workflow_templates').select('count');
    const { data: statuses } = await supabase.from('workflow_statuses').select('count');
    const { data: transitions } = await supabase.from('workflow_transitions').select('count');

    console.log('Tables created:');
    console.log('  - workflow_templates:', templates);
    console.log('  - workflow_statuses:', statuses);
    console.log('  - workflow_transitions:', transitions);

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

applyMigration();
