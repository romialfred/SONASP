#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSearch() {
  console.log('🔍 Recherche des références à batch_id dans le code SQL...\n');

  try {
    // Read the SQL file
    const sqlContent = readFileSync(join(__dirname, 'CHERCHER_BATCH_ID_DANS_CODE_SQL.sql'), 'utf8');

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sqlContent
    });

    if (error) {
      console.error('❌ Erreur lors de l\'exécution:', error.message);

      // Try alternative method - direct query
      console.log('\n⚙️  Tentative avec méthode alternative...\n');
      const { error: execError } = await supabase.rpc('execute_sql', {
        query: sqlContent
      });

      if (execError) {
        console.error('❌ Erreur:', execError.message);
        console.log('\n📝 Veuillez copier-coller le contenu de CHERCHER_BATCH_ID_DANS_CODE_SQL.sql');
        console.log('   dans l\'éditeur SQL de Supabase.');
      }
    } else {
      console.log('✅ Script exécuté avec succès!');
      console.log('\n📊 Vérifiez les messages dans l\'onglet "Messages" de Supabase');
      if (data) {
        console.log('\nRésultats:', data);
      }
    }

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    console.log('\n📝 Solution: Copiez le contenu de CHERCHER_BATCH_ID_DANS_CODE_SQL.sql');
    console.log('   et exécutez-le directement dans l\'éditeur SQL de Supabase.');
  }
}

runSearch();
