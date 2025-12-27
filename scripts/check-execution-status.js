#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
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

async function checkExists(table, column = null) {
  const { data, error } = await supabase.from(table).select('*').limit(1).maybeSingle();
  if (error) return { exists: false, error: error.message };
  if (!column) return { exists: true };
  return { exists: data && Object.keys(data).includes(column) };
}

async function main() {
  console.log('🔍 VÉRIFICATION DE L\'ÉTAT D\'EXÉCUTION DES SCRIPTS\n');
  console.log('━'.repeat(80));
  
  const checks = [
    {
      script: '1. CORRECTION-COMPLETE-A-EXECUTER.sql',
      checks: [
        { desc: 'company_type dans mining_companies', table: 'mining_companies', column: 'company_type' },
        { desc: 'acheteur_id dans snp_artisan_ventes_or', table: 'snp_artisan_ventes_or', column: 'acheteur_id' },
        { desc: 'Vue snp_ventes_artisans_sonasp', table: 'snp_ventes_artisans_sonasp' }
      ]
    },
    {
      script: '2. CREATE-MODULES-MANAGEMENT-SYSTEM.sql',
      checks: [
        { desc: 'Table snp_modules', table: 'snp_modules' },
        { desc: 'Colonne parent_id dans snp_modules', table: 'snp_modules', column: 'parent_id' },
        { desc: 'Colonne icon dans snp_modules', table: 'snp_modules', column: 'icon' }
      ]
    },
    {
      script: '3. FIX-ARTISAN-MODULES.sql',
      checks: [
        { desc: 'Données modules artisans', table: 'snp_modules' }
      ]
    },
    {
      script: '4. CREATE-ARTISAN-GOLD-SALES-COLLECTION.sql',
      checks: [
        { desc: 'Colonne collecteur_id dans snp_artisan_ventes_or', table: 'snp_artisan_ventes_or', column: 'collecteur_id' },
        { desc: 'Colonne lieu_collecte dans snp_artisan_ventes_or', table: 'snp_artisan_ventes_or', column: 'lieu_collecte' },
        { desc: 'Colonne commission_taux dans snp_artisan_ventes_or', table: 'snp_artisan_ventes_or', column: 'commission_taux' }
      ]
    },
    {
      script: '5. IMPLEMENT-ARTISAN-SONASP-SALES-LOGIC.sql',
      checks: [
        { desc: 'Colonne type_acheteur dans snp_artisan_ventes_or', table: 'snp_artisan_ventes_or', column: 'type_acheteur' },
        { desc: 'Colonne prix_unitaire_fcfa dans snp_artisan_ventes_or', table: 'snp_artisan_ventes_or', column: 'prix_unitaire_fcfa' }
      ]
    }
  ];
  
  const results = [];
  
  for (const scriptCheck of checks) {
    console.log(`\n${scriptCheck.script}`);
    
    let allPassed = true;
    const details = [];
    
    for (const check of scriptCheck.checks) {
      const result = await checkExists(check.table, check.column);
      const status = result.exists ? '✅' : '❌';
      console.log(`   ${status} ${check.desc}`);
      
      if (!result.exists) {
        allPassed = false;
        if (result.error && result.error.includes('does not exist')) {
          details.push(`Table/Vue "${check.table}" n'existe pas`);
        } else {
          details.push(`Colonne "${check.column}" manquante`);
        }
      }
    }
    
    results.push({
      script: scriptCheck.script,
      executed: allPassed,
      details
    });
  }
  
  console.log('\n━'.repeat(80));
  console.log('\n📋 RÉSUMÉ:\n');
  
  const toExecute = results.filter(r => !r.executed);
  const executed = results.filter(r => r.executed);
  
  if (executed.length > 0) {
    console.log('✅ SCRIPTS DÉJÀ EXÉCUTÉS:');
    executed.forEach(r => console.log(`   • ${r.script}`));
  }
  
  if (toExecute.length > 0) {
    console.log('\n❌ SCRIPTS À EXÉCUTER:\n');
    toExecute.forEach((r, idx) => {
      console.log(`${idx + 1}. ${r.script}`);
      if (r.details.length > 0) {
        console.log(`   Manque: ${r.details.join(', ')}\n`);
      }
    });
    
    console.log('━'.repeat(80));
    console.log('\n🎯 PROCHAINES ÉTAPES:\n');
    console.log('1. Ouvrir Supabase Dashboard > SQL Editor');
    console.log('2. Copier le premier script de la liste ci-dessus');
    console.log('3. Coller dans SQL Editor et cliquer "Run"');
    console.log('4. Relancer: node scripts/check-execution-status.js');
    console.log('5. Répéter jusqu\'à ce que tous les scripts soient exécutés\n');
  } else {
    console.log('\n🎉 TOUS LES SCRIPTS SONT DÉJÀ EXÉCUTÉS!\n');
  }
}

main().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
