#!/usr/bin/env node

import pg from 'pg';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const password = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Essayer plusieurs formats de connexion
const connectionStrings = [
  `postgresql://postgres.${projectRef}:${password}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`,
  `postgresql://postgres:${password}@db.${projectRef}.supabase.co:6543/postgres`
];

async function tryConnection(connString) {
  const client = new Client({ connectionString: connString });
  try {
    await client.connect();
    const result = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    await client.end();
    return result.rows;
  } catch (err) {
    await client.end().catch(() => {});
    return null;
  }
}

(async () => {
  console.log('🔍 Recherche des tables...\n');

  for (const connString of connectionStrings) {
    console.log('Tentative de connexion...');
    const tables = await tryConnection(connString);

    if (tables) {
      console.log('\n✓ Connexion réussie!\n');
      console.log('📊 TABLES DANS LA BASE:\n');
      tables.forEach(t => console.log(`  - ${t.tablename}`));
      return;
    }
  }

  console.log('❌ Impossible de se connecter avec PostgreSQL direct');
  console.log('Utilisation de Supabase JS client à la place...\n');
})();
