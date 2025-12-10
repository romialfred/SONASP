#!/usr/bin/env node

/**
 * Script pour rechercher toutes les occurrences de 'batch_id' dans la base de données
 *
 * Recherche dans :
 * - Colonnes de tables
 * - Colonnes de vues
 * - Définitions de fonctions
 * - Définitions de triggers
 * - Contraintes (FK, CHECK, etc.)
 * - Index
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 RECHERCHE DE "batch_id" DANS LA BASE DE DONNÉES\n');
console.log('='.repeat(80));

// 1. Colonnes de tables
async function searchTableColumns() {
  console.log('\n📊 1. COLONNES DE TABLES');
  console.log('-'.repeat(80));

  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT
        schemaname as schema_name,
        tablename as table_name,
        attname as column_name,
        format_type(atttypid, atttypmod) as data_type,
        CASE WHEN attnotnull THEN 'NOT NULL' ELSE 'NULL' END as nullable
      FROM pg_attribute
      JOIN pg_class ON pg_attribute.attrelid = pg_class.oid
      JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
      JOIN pg_stat_user_tables ON pg_class.relname = pg_stat_user_tables.tablename
        AND pg_namespace.nspname = pg_stat_user_tables.schemaname
      WHERE attname ILIKE '%batch_id%'
        AND attnum > 0
        AND NOT attisdropped
        AND schemaname = 'public'
      ORDER BY tablename, attname;
    `
  });

  if (error) {
    console.error('❌ Erreur:', error.message);
    return [];
  }

  if (data && data.length > 0) {
    data.forEach(row => {
      console.log(`   📌 Table: ${row.table_name}`);
      console.log(`      Colonne: ${row.column_name} (${row.data_type}) ${row.nullable}`);
    });
    console.log(`\n   ✅ ${data.length} colonnes trouvées dans les tables`);
  } else {
    console.log('   ✅ Aucune colonne "batch_id" trouvée dans les tables');
  }

  return data || [];
}

// 2. Colonnes de vues
async function searchViewColumns() {
  console.log('\n📊 2. COLONNES DE VUES');
  console.log('-'.repeat(80));

  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT
        table_schema as schema_name,
        table_name as view_name,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE column_name ILIKE '%batch_id%'
        AND table_schema = 'public'
        AND table_name IN (
          SELECT table_name
          FROM information_schema.views
          WHERE table_schema = 'public'
        )
      ORDER BY table_name, column_name;
    `
  });

  if (error) {
    console.error('❌ Erreur:', error.message);
    return [];
  }

  if (data && data.length > 0) {
    data.forEach(row => {
      console.log(`   📌 Vue: ${row.view_name}`);
      console.log(`      Colonne: ${row.column_name} (${row.data_type})`);
    });
    console.log(`\n   ✅ ${data.length} colonnes trouvées dans les vues`);
  } else {
    console.log('   ✅ Aucune colonne "batch_id" trouvée dans les vues');
  }

  return data || [];
}

// 3. Fonctions
async function searchFunctions() {
  console.log('\n⚙️  3. FONCTIONS');
  console.log('-'.repeat(80));

  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT
        n.nspname as schema_name,
        p.proname as function_name,
        pg_get_function_arguments(p.oid) as arguments
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND (
          pg_get_functiondef(p.oid) ILIKE '%batch_id%'
          OR pg_get_function_arguments(p.oid) ILIKE '%batch_id%'
        )
      ORDER BY p.proname;
    `
  });

  if (error) {
    console.error('❌ Erreur:', error.message);
    return [];
  }

  if (data && data.length > 0) {
    data.forEach(row => {
      console.log(`   📌 Fonction: ${row.function_name}(${row.arguments || ''})`);
    });
    console.log(`\n   ⚠️  ${data.length} fonctions référencent "batch_id"`);
  } else {
    console.log('   ✅ Aucune fonction ne référence "batch_id"');
  }

  return data || [];
}

// 4. Triggers
async function searchTriggers() {
  console.log('\n🔧 4. TRIGGERS');
  console.log('-'.repeat(80));

  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT DISTINCT
        event_object_schema as schema_name,
        event_object_table as table_name,
        trigger_name,
        action_timing || ' ' || event_manipulation as trigger_event
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
        AND action_statement ILIKE '%batch_id%'
      ORDER BY event_object_table, trigger_name;
    `
  });

  if (error) {
    console.error('❌ Erreur:', error.message);
    return [];
  }

  if (data && data.length > 0) {
    data.forEach(row => {
      console.log(`   📌 Table: ${row.table_name}`);
      console.log(`      Trigger: ${row.trigger_name} (${row.trigger_event})`);
    });
    console.log(`\n   ⚠️  ${data.length} triggers référencent "batch_id"`);
  } else {
    console.log('   ✅ Aucun trigger ne référence "batch_id"');
  }

  return data || [];
}

// 5. Contraintes
async function searchConstraints() {
  console.log('\n🔒 5. CONTRAINTES');
  console.log('-'.repeat(80));

  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT DISTINCT
        tc.table_schema as schema_name,
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      LEFT JOIN information_schema.check_constraints cc
        ON cc.constraint_name = tc.constraint_name
        AND cc.constraint_schema = tc.table_schema
      WHERE tc.table_schema = 'public'
        AND (
          kcu.column_name ILIKE '%batch_id%'
          OR ccu.column_name ILIKE '%batch_id%'
          OR cc.check_clause ILIKE '%batch_id%'
          OR tc.constraint_name ILIKE '%batch_id%'
        )
      ORDER BY tc.table_name, tc.constraint_name;
    `
  });

  if (error) {
    console.error('❌ Erreur:', error.message);
    return [];
  }

  if (data && data.length > 0) {
    data.forEach(row => {
      console.log(`   📌 Table: ${row.table_name}`);
      console.log(`      Contrainte: ${row.constraint_name} (${row.constraint_type})`);
      if (row.column_name) {
        console.log(`      Colonne: ${row.column_name}`);
      }
    });
    console.log(`\n   ⚠️  ${data.length} contraintes référencent "batch_id"`);
  } else {
    console.log('   ✅ Aucune contrainte ne référence "batch_id"');
  }

  return data || [];
}

// 6. Index
async function searchIndexes() {
  console.log('\n📇 6. INDEX');
  console.log('-'.repeat(80));

  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT
        schemaname as schema_name,
        tablename as table_name,
        indexname as index_name,
        indexdef as index_definition
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND (
          indexname ILIKE '%batch_id%'
          OR indexdef ILIKE '%batch_id%'
        )
      ORDER BY tablename, indexname;
    `
  });

  if (error) {
    console.error('❌ Erreur:', error.message);
    return [];
  }

  if (data && data.length > 0) {
    data.forEach(row => {
      console.log(`   📌 Table: ${row.table_name}`);
      console.log(`      Index: ${row.index_name}`);
      console.log(`      Définition: ${row.index_definition}`);
    });
    console.log(`\n   ⚠️  ${data.length} index référencent "batch_id"`);
  } else {
    console.log('   ✅ Aucun index ne référence "batch_id"');
  }

  return data || [];
}

// Fonction principale
async function main() {
  try {
    const tables = await searchTableColumns();
    const views = await searchViewColumns();
    const functions = await searchFunctions();
    const triggers = await searchTriggers();
    const constraints = await searchConstraints();
    const indexes = await searchIndexes();

    // Résumé
    console.log('\n' + '='.repeat(80));
    console.log('📋 RÉSUMÉ');
    console.log('='.repeat(80));
    console.log(`   Colonnes de tables: ${tables.length}`);
    console.log(`   Colonnes de vues: ${views.length}`);
    console.log(`   Fonctions: ${functions.length}`);
    console.log(`   Triggers: ${triggers.length}`);
    console.log(`   Contraintes: ${constraints.length}`);
    console.log(`   Index: ${indexes.length}`);

    const total = tables.length + views.length + functions.length + triggers.length + constraints.length + indexes.length;

    console.log('\n' + '='.repeat(80));
    if (total === 0) {
      console.log('✅ AUCUNE RÉFÉRENCE À "batch_id" TROUVÉE DANS LA BASE DE DONNÉES');
    } else {
      console.log(`⚠️  TOTAL: ${total} RÉFÉRENCES À "batch_id" TROUVÉES`);
      console.log('\n⚠️  ATTENTION: Ces références doivent être nettoyées ou migrées!');
    }
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

main();
