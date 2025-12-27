#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function analyzeTable(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      return { exists: false, error: error.message };
    }

    if (!data) {
      return { exists: true, columns: [], count: 0 };
    }

    const columns = Object.keys(data);

    const { count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    return { exists: true, columns, count, sample: data };
  } catch (err) {
    return { exists: false, error: err.message };
  }
}

async function main() {
  console.log('🔍 ANALYSE COMPLÈTE DE LA BASE DE DONNÉES\n');
  console.log('━'.repeat(70));

  const tablesToCheck = [
    'mining_companies',
    'snp_artisan_ventes_or',
    'SNP_artisans_miniers',
    'snp_artisans_miniers',
    'artisans_miniers',
    'snp_cartes_professionnelles',
    'snp_carte_statistics',
    'snp_artisan_activities',
    'daily_production',
    'sales',
    'customers',
    'shipping_preparations',
    'export_licenses'
  ];

  const results = {};

  for (const table of tablesToCheck) {
    const result = await analyzeTable(table);
    results[table] = result;

    if (result.exists) {
      console.log(`\n✅ ${table}`);
      console.log(`   Lignes: ${result.count}`);
      console.log(`   Colonnes (${result.columns.length}):`);
      result.columns.forEach(col => console.log(`     - ${col}`));
    } else {
      console.log(`\n❌ ${table} - N'EXISTE PAS`);
    }
  }

  // Générer un fichier de référence
  const timestamp = new Date().toISOString().split('T')[0];
  const report = {
    date: timestamp,
    project: process.env.VITE_SUPABASE_URL,
    tables: results
  };

  const outputPath = join(__dirname, 'database-schema.json');
  writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log('\n━'.repeat(70));
  console.log(`\n📄 Schéma sauvegardé: ${outputPath}`);

  // Créer un document Markdown
  let mdContent = `# Schéma de Base de Données\n\n`;
  mdContent += `**Date:** ${timestamp}\n\n`;
  mdContent += `## Tables Existantes\n\n`;

  for (const [table, info] of Object.entries(results)) {
    if (info.exists) {
      mdContent += `### ${table}\n\n`;
      mdContent += `- **Nombre de lignes:** ${info.count}\n`;
      mdContent += `- **Colonnes:**\n`;
      info.columns.forEach(col => {
        mdContent += `  - \`${col}\`\n`;
      });
      mdContent += `\n`;
    }
  }

  mdContent += `## Tables Non Trouvées\n\n`;
  for (const [table, info] of Object.entries(results)) {
    if (!info.exists) {
      mdContent += `- ❌ \`${table}\`\n`;
    }
  }

  const mdPath = join(__dirname, 'DATABASE-SCHEMA.md');
  writeFileSync(mdPath, mdContent);

  console.log(`📄 Documentation créée: ${mdPath}\n`);

  // Identifier la bonne table des artisans
  const artisanTables = Object.entries(results)
    .filter(([name, info]) => info.exists && name.toLowerCase().includes('artisan'))
    .filter(([name, info]) => !name.includes('vente') && !name.includes('activities'));

  console.log('━'.repeat(70));
  console.log('\n🎯 TABLE DES ARTISANS DÉTECTÉE:\n');

  if (artisanTables.length > 0) {
    artisanTables.forEach(([name, info]) => {
      console.log(`✅ ${name} (${info.count} lignes)`);
      console.log('   Colonnes clés:');
      const keyCols = info.columns.filter(c =>
        ['id', 'nom', 'prenom', 'prenoms', 'numero_carte', 'type_artisan', 'pays'].some(
          key => c.toLowerCase().includes(key.toLowerCase())
        )
      );
      keyCols.forEach(col => console.log(`     - ${col}`));
    });
  } else {
    console.log('❌ Aucune table d\'artisans trouvée');
  }

  console.log('\n');
}

main().catch(err => {
  console.error('❌ ERREUR:', err.message);
  process.exit(1);
});
