#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function checkTableExists(tableName) {
  const { error } = await supabase.from(tableName).select('id').limit(1).maybeSingle();
  return !error || !error.message.includes('does not exist');
}

async function checkColumnExists(tableName, columnName) {
  const { data, error } = await supabase.from(tableName).select('*').limit(1).maybeSingle();
  if (error || !data) return false;
  return Object.keys(data).includes(columnName);
}

function extractTablesFromSQL(sqlContent) {
  const tables = new Set();
  const createTableRegex = /CREATE TABLE (?:IF NOT EXISTS )?([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  const alterTableRegex = /ALTER TABLE ([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  const fromRegex = /FROM ([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  const joinRegex = /JOIN ([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  
  let match;
  while ((match = createTableRegex.exec(sqlContent)) !== null) tables.add(match[1]);
  while ((match = alterTableRegex.exec(sqlContent)) !== null) tables.add(match[1]);
  while ((match = fromRegex.exec(sqlContent)) !== null) tables.add(match[1]);
  while ((match = joinRegex.exec(sqlContent)) !== null) tables.add(match[1]);
  
  return Array.from(tables).filter(t => !['information_schema', 'pg_catalog'].includes(t));
}

async function analyzeScript(scriptPath) {
  const content = readFileSync(scriptPath, 'utf-8');
  const tables = extractTablesFromSQL(content);
  
  const analysis = {
    creates: content.match(/CREATE TABLE/gi)?.length || 0,
    alters: content.match(/ALTER TABLE/gi)?.length || 0,
    functions: content.match(/CREATE (?:OR REPLACE )?FUNCTION/gi)?.length || 0,
    triggers: content.match(/CREATE TRIGGER/gi)?.length || 0,
    views: content.match(/CREATE (?:OR REPLACE )?VIEW/gi)?.length || 0,
    tables: tables,
    size: (content.length / 1024).toFixed(1) + ' KB'
  };
  
  const issues = [];
  for (const table of tables) {
    if (table.includes('"') || table !== table.toLowerCase()) {
      const exists = await checkTableExists(table.toLowerCase().replace(/"/g, ''));
      if (!exists) {
        issues.push(`⚠️ Table "${table}" utilise des majuscules ou guillemets - vérifier le nom`);
      }
    }
  }
  
  return { analysis, issues };
}

async function main() {
  console.log('🔍 ANALYSE DES SCRIPTS SQL NON EXÉCUTÉS\n');
  console.log('━'.repeat(80));
  
  const scriptsDir = __dirname;
  const sqlFiles = readdirSync(scriptsDir)
    .filter(f => f.endsWith('.sql'))
    .filter(f => !f.includes('insert-artisans')) // Skip data insertion scripts
    .sort();
  
  const priorityScripts = [
    'CORRECTION-COMPLETE-A-EXECUTER.sql',
    'CREATE-MODULES-MANAGEMENT-SYSTEM.sql',
    'FIX-ARTISAN-MODULES.sql',
    'CREATE-ARTISAN-GOLD-SALES-COLLECTION.sql',
    'IMPLEMENT-ARTISAN-SONASP-SALES-LOGIC.sql'
  ];
  
  const results = [];
  
  for (const file of sqlFiles) {
    const path = join(scriptsDir, file);
    const { analysis, issues } = await analyzeScript(path);
    const priority = priorityScripts.includes(file);
    
    results.push({
      file,
      priority,
      analysis,
      issues
    });
  }
  
  console.log('\n📊 SCRIPTS PRIORITAIRES (modules dynamiques + artisans)\n');
  results.filter(r => r.priority).forEach(r => {
    console.log(`\n✅ ${r.file}`);
    console.log(`   Crée: ${r.analysis.creates} tables | Modifie: ${r.analysis.alters} tables`);
    console.log(`   Fonctions: ${r.analysis.functions} | Triggers: ${r.analysis.triggers} | Vues: ${r.analysis.views}`);
    console.log(`   Taille: ${r.analysis.size}`);
    if (r.analysis.tables.length > 0) {
      console.log(`   Tables impliquées: ${r.analysis.tables.slice(0, 5).join(', ')}${r.analysis.tables.length > 5 ? '...' : ''}`);
    }
    if (r.issues.length > 0) {
      r.issues.forEach(issue => console.log(`   ${issue}`));
    }
  });
  
  console.log('\n\n📋 AUTRES SCRIPTS\n');
  results.filter(r => !r.priority).forEach(r => {
    console.log(`\n• ${r.file}`);
    console.log(`   Crée: ${r.analysis.creates} | Modifie: ${r.analysis.alters} | Fonctions: ${r.analysis.functions}`);
    if (r.issues.length > 0) {
      r.issues.forEach(issue => console.log(`   ${issue}`));
    }
  });
  
  console.log('\n━'.repeat(80));
  console.log('\n🎯 ORDRE D\'EXÉCUTION RECOMMANDÉ:\n');
  
  const executionOrder = [
    { file: 'CORRECTION-COMPLETE-A-EXECUTER.sql', desc: 'Configure SONASP et acheteur_id (BASE)' },
    { file: 'CREATE-MODULES-MANAGEMENT-SYSTEM.sql', desc: 'Système de modules dynamiques' },
    { file: 'FIX-ARTISAN-MODULES.sql', desc: 'Correction modules artisans' },
    { file: 'CREATE-ARTISAN-GOLD-SALES-COLLECTION.sql', desc: 'Système de collecte d\'or artisans' },
    { file: 'IMPLEMENT-ARTISAN-SONASP-SALES-LOGIC.sql', desc: 'Logique ventes SONASP' }
  ];
  
  executionOrder.forEach((script, idx) => {
    console.log(`${idx + 1}. ${script.file}`);
    console.log(`   → ${script.desc}\n`);
  });
  
  console.log('━'.repeat(80));
  console.log('\n💡 INSTRUCTIONS:\n');
  console.log('1. Ouvrir Supabase Dashboard > SQL Editor');
  console.log('2. Exécuter les scripts dans l\'ORDRE ci-dessus');
  console.log('3. Vérifier les messages de succès après chaque script');
  console.log('4. Tester avec: node scripts/apply-fix-automatically.js\n');
}

main().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
