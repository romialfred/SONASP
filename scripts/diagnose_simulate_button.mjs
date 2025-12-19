#!/usr/bin/env node

/**
 * DIAGNOSTIC COMPLET: Bouton Simulate
 *
 * Ce script vérifie TOUTES les dépendances nécessaires
 * pour que le bouton Simulate fonctionne
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 DIAGNOSTIC COMPLET: Bouton Simulate\n');
console.log('='.repeat(60));

const results = {
  passed: [],
  failed: [],
  warnings: []
};

async function checkTable(tableName, requiredColumns = []) {
  console.log(`\n📋 Vérification: ${tableName}`);

  try {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      if (error.code === '42P01') {
        console.log(`   ❌ Table ${tableName} N'EXISTE PAS`);
        results.failed.push({
          table: tableName,
          issue: 'Table does not exist',
          code: error.code
        });
        return false;
      }

      console.log(`   ⚠️  Erreur: ${error.message}`);
      results.warnings.push({
        table: tableName,
        issue: error.message,
        code: error.code
      });
      return false;
    }

    console.log(`   ✅ Table existe (${count || 0} lignes)`);

    if (count === 0) {
      console.log(`   ⚠️  Table vide - aucune donnée`);
      results.warnings.push({
        table: tableName,
        issue: 'Table is empty'
      });
    }

    results.passed.push(tableName);
    return true;

  } catch (error) {
    console.log(`   ❌ Erreur inattendue: ${error.message}`);
    results.failed.push({
      table: tableName,
      issue: error.message
    });
    return false;
  }
}

async function checkRLS(tableName) {
  console.log(`\n🔒 Vérification RLS: ${tableName}`);

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST301') {
        console.log(`   ❌ RLS bloque l'accès - Aucune policy SELECT`);
        results.failed.push({
          table: tableName,
          issue: 'RLS blocking access - No SELECT policy',
          code: error.code
        });
        return false;
      }

      console.log(`   ⚠️  Erreur RLS: ${error.message}`);
      results.warnings.push({
        table: tableName,
        issue: `RLS: ${error.message}`,
        code: error.code
      });
      return false;
    }

    console.log(`   ✅ RLS OK - Accès autorisé`);
    return true;

  } catch (error) {
    console.log(`   ❌ Erreur: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('Début du diagnostic...\n');

  // 1. Vérifier gold_prices_daily
  await checkTable('gold_prices_daily');
  await checkRLS('gold_prices_daily');

  // 2. Vérifier forward_rates
  await checkTable('forward_rates');
  await checkRLS('forward_rates');

  // 3. Vérifier refineries_approved
  await checkTable('refineries_approved');
  await checkRLS('refineries_approved');

  // 4. Vérifier mining_companies
  await checkTable('mining_companies');
  await checkRLS('mining_companies');

  // 5. Vérifier customers
  await checkTable('customers');
  await checkRLS('customers');

  // 6. Vérifier gold_inventory
  await checkTable('gold_inventory');
  await checkRLS('gold_inventory');

  // Résumé
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ DU DIAGNOSTIC\n');

  console.log(`✅ Tests réussis: ${results.passed.length}`);
  if (results.passed.length > 0) {
    results.passed.forEach(t => console.log(`   - ${t}`));
  }

  console.log(`\n⚠️  Avertissements: ${results.warnings.length}`);
  if (results.warnings.length > 0) {
    results.warnings.forEach(w => {
      console.log(`   - ${w.table}: ${w.issue}`);
    });
  }

  console.log(`\n❌ Erreurs critiques: ${results.failed.length}`);
  if (results.failed.length > 0) {
    results.failed.forEach(f => {
      console.log(`   - ${f.table}: ${f.issue}`);
    });
  }

  console.log('\n' + '='.repeat(60));

  if (results.failed.length > 0) {
    console.log('\n🔧 ACTIONS REQUISES:\n');

    const missingTables = results.failed.filter(f => f.issue.includes('does not exist'));
    if (missingTables.length > 0) {
      console.log('Tables manquantes à créer:');
      missingTables.forEach(t => {
        console.log(`   • ${t.table}`);
      });
    }

    const rlsIssues = results.failed.filter(f => f.issue.includes('RLS'));
    if (rlsIssues.length > 0) {
      console.log('\nProblèmes RLS à corriger:');
      rlsIssues.forEach(t => {
        console.log(`   • ${t.table}: Ajouter policy SELECT`);
      });
    }

    console.log('\n📝 Exécuter: node scripts/fix_simulate_button_complete.mjs');
    console.log('');

    process.exit(1);
  } else {
    console.log('\n✅ Toutes les vérifications sont OK!');
    console.log('Le bouton Simulate devrait fonctionner.');
    console.log('');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('\n❌ Erreur fatale:', error);
  process.exit(1);
});
