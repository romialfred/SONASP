#!/usr/bin/env node

/**
 * Utilitaire pour exécuter les migrations SQL directement sur Supabase
 * Usage: node scripts/run-migration.js <fichier.sql>
 *
 * Ce script utilise la variable SUPABASE_DB_URL qui contient la chaîne de connexion PostgreSQL directe
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
config({ path: join(__dirname, '../.env') });

const dbUrl = process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error('❌ ERREUR: Variable SUPABASE_DB_URL manquante dans .env');
  console.error('   Cette variable contient la chaîne de connexion PostgreSQL directe');
  process.exit(1);
}

async function runMigration(sqlFile) {
  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    console.log(`📂 Lecture du fichier: ${sqlFile}`);
    const sqlFilePath = resolve(__dirname, sqlFile);
    const sql = readFileSync(sqlFilePath, 'utf-8');

    console.log(`🔌 Connexion à la base de données...`);
    await client.connect();

    console.log(`🚀 Exécution de la migration...`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const result = await client.query(sql);

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log('✅ Migration exécutée avec succès!');

    if (result.rows && result.rows.length > 0) {
      console.log('\n📊 Résultat:', JSON.stringify(result.rows, null, 2));
    }

    console.log(`\n✓ Commandes exécutées: ${result.command || 'Multiple'}`);
    console.log(`✓ Lignes affectées: ${result.rowCount || 0}`);

  } catch (err) {
    console.error('❌ ERREUR lors de l\'exécution:', err.message);
    console.error('   Détails:', err.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Connexion fermée');
  }
}

// Vérifier les arguments
const sqlFile = process.argv[2];

if (!sqlFile) {
  console.error('❌ Usage: node scripts/run-migration.js <fichier.sql>');
  console.error('   Exemple: node scripts/run-migration.js FIX-COMPANY-TYPE-AND-SONASP.sql');
  process.exit(1);
}

runMigration(sqlFile);
