#!/usr/bin/env node

/**
 * Utilitaire pour analyser la structure de la base de données Supabase
 * Usage: node scripts/analyze-database.js [nom_table]
 */

import pg from 'pg';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERREUR: Variables manquantes dans .env');
  process.exit(1);
}

// Construire l'URL de connexion PostgreSQL à partir de l'URL Supabase
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error('❌ ERREUR: URL Supabase invalide');
  process.exit(1);
}

const dbUrl = `postgresql://postgres.${projectRef}:${supabaseKey.split('.')[2] || 'password'}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;

async function listAllTables(client) {
  const query = `
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `;

  const result = await client.query(query);

  console.log('\n📊 TABLES DU PROJET:\n');
  console.log('━'.repeat(70));

  for (const row of result.rows) {
    const countResult = await client.query(`SELECT COUNT(*) as count FROM "${row.tablename}"`);
    const count = countResult.rows[0].count;
    console.log(`  ✓ ${row.tablename.padEnd(40)} (${count} lignes)`);
  }

  console.log('\n━'.repeat(70));
  console.log(`\n💡 Usage: node scripts/analyze-database.js nom_table\n`);
}

async function analyzeTable(client, tableName) {
  console.log(`\n🔍 ANALYSE: ${tableName}\n`);
  console.log('━'.repeat(100));

  const columnsQuery = `
    SELECT
      column_name,
      data_type,
      character_maximum_length,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_name = $1 AND table_schema = 'public'
    ORDER BY ordinal_position;
  `;

  try {
    const result = await client.query(columnsQuery, [tableName]);

    if (result.rows.length === 0) {
      console.log(`❌ Table "${tableName}" introuvable\n`);
      return;
    }

    console.log('\n📋 COLONNES:\n');
    result.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const maxLen = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      const defaultVal = col.column_default ? `DEFAULT ${col.column_default.substring(0, 30)}` : '';

      console.log(`  • ${col.column_name.padEnd(35)} ${col.data_type}${maxLen.padEnd(8)} ${nullable.padEnd(10)} ${defaultVal}`);
    });

    const countResult = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
    console.log(`\n📊 Lignes: ${countResult.rows[0].count}\n`);

    console.log('━'.repeat(100));
    console.log('');

  } catch (err) {
    console.error('❌ Erreur:', err.message);
  }
}

async function main() {
  console.log('🔌 Connexion...');

  // Utiliser une connexion simple sans pooler
  const simpleUrl = `postgresql://postgres:${supabaseKey}@db.${projectRef}.supabase.co:5432/postgres`;

  const client = new Client({ connectionString: simpleUrl });

  try {
    await client.connect();

    const tableName = process.argv[2];

    if (tableName) {
      await analyzeTable(client, tableName);
    } else {
      await listAllTables(client);
    }

  } catch (err) {
    console.error('❌ Connexion échouée');
    console.error('Essayez d\'ajouter SUPABASE_DB_URL dans votre .env');
    console.error('Format: postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres');
  } finally {
    await client.end();
  }
}

main();
