import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkTables() {
  console.log('=== VERIFICATION DES TABLES WORKFLOW ===\n');
  
  const tables = [
    'workflow_templates',
    'workflow_statuses',
    'workflow_transitions',
    'workflow_history'
  ];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log('❌ Table "' + table + '": N EXISTE PAS');
        console.log('   Erreur: ' + error.message + '\n');
      } else {
        console.log('✅ Table "' + table + '": EXISTE');
        const count = data ? data.length : 0;
        console.log('   ' + count + ' enregistrement trouve\n');
      }
    } catch (err) {
      console.log('❌ Table "' + table + '": ERREUR');
      console.log('   ' + err.message + '\n');
    }
  }
}

checkTables().then(() => process.exit(0));
