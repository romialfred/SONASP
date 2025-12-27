#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeTable(tableName) {
  console.log(`\n🔍 Analyse de ${tableName}...\n`);

  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);

  if (error) {
    console.log(`❌ ${tableName}: ${error.message}`);
    return null;
  }

  if (data && data.length > 0) {
    console.log(`✓ ${tableName}:`);
    Object.keys(data[0]).forEach(col => {
      console.log(`  - ${col}`);
    });
  }

  const { count } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  console.log(`  Total: ${count} lignes\n`);

  return data?.[0];
}

(async () => {
  console.log('📊 ANALYSE AUTOMATIQUE\n');
  console.log('━'.repeat(50));

  await analyzeTable('mining_companies');
  await analyzeTable('snp_artisan_ventes_or');
  await analyzeTable('SNP_artisans_miniers');
})();
