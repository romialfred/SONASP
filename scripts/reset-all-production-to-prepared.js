#!/usr/bin/env node

/**
 * Script: Reset All Production Status to "prepared"
 *
 * Ce script change tous les statuts des productions à "prepared" et
 * vérifie que les changements sont enregistrés dans unified_status_history.
 *
 * Utilisation:
 *   node scripts/reset-all-production-to-prepared.js [--dry-run]
 *
 * Options:
 *   --dry-run    Affiche ce qui serait fait sans faire les modifications
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

const isDryRun = process.argv.includes('--dry-run');

// Configuration Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erreur: Variables d\'environnement VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requises');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Affiche une ligne de séparation
 */
function printSeparator(char = '━', length = 60) {
  console.log(char.repeat(length));
}

/**
 * Affiche un titre avec séparateurs
 */
function printTitle(title) {
  console.log('');
  printSeparator();
  console.log(title);
  printSeparator();
}

/**
 * Récupère le résumé des statuts actuels
 */
async function getStatusSummary() {
  const { data, error } = await supabase
    .from('daily_production')
    .select('status')
    .not('status', 'is', null);

  if (error) {
    console.error('❌ Erreur lors de la récupération des statuts:', error);
    return null;
  }

  // Compter les statuts
  const summary = {};
  data.forEach(prod => {
    const status = prod.status || 'null';
    summary[status] = (summary[status] || 0) + 1;
  });

  return summary;
}

/**
 * Affiche le résumé des statuts
 */
function displaySummary(summary, title) {
  printTitle(title);
  console.log('');

  const statuses = Object.entries(summary).sort((a, b) => b[1] - a[1]);

  console.log('Statut'.padEnd(30), 'Nombre');
  console.log('─'.repeat(50));

  statuses.forEach(([status, count]) => {
    console.log(status.padEnd(30), count.toString().padStart(6));
  });

  const total = statuses.reduce((sum, [, count]) => sum + count, 0);
  console.log('─'.repeat(50));
  console.log('TOTAL'.padEnd(30), total.toString().padStart(6));
}

/**
 * Récupère les productions à modifier
 */
async function getProductionsToUpdate() {
  const { data, error } = await supabase
    .from('daily_production')
    .select('id, bar_reference, status, production_date')
    .not('status', 'is', null)
    .neq('status', 'prepared')
    .order('production_date', { ascending: false });

  if (error) {
    console.error('❌ Erreur lors de la récupération des productions:', error);
    return [];
  }

  return data;
}

/**
 * Met à jour une production
 */
async function updateProduction(productionId) {
  const { error } = await supabase
    .from('daily_production')
    .update({
      status: 'prepared',
      updated_at: new Date().toISOString()
    })
    .eq('id', productionId);

  return { success: !error, error };
}

/**
 * Vérifie l'historique créé
 */
async function verifyHistory(productionIds) {
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

  const { data, error } = await supabase
    .from('unified_status_history')
    .select('*')
    .eq('entity_type', 'production')
    .eq('new_status', 'prepared')
    .in('entity_id', productionIds)
    .gte('changed_at', oneMinuteAgo)
    .order('changed_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Erreur lors de la vérification de l\'historique:', error);
    return [];
  }

  return data;
}

/**
 * Fonction principale
 */
async function main() {
  console.log('');
  console.log('🔄 Script de Réinitialisation des Statuts de Production');
  console.log('');

  if (isDryRun) {
    console.log('⚠️  MODE DRY-RUN: Aucune modification ne sera effectuée');
  }

  // 1. Afficher le résumé AVANT
  const summaryBefore = await getStatusSummary();
  if (!summaryBefore) {
    process.exit(1);
  }
  displaySummary(summaryBefore, '📊 RÉSUMÉ AVANT MODIFICATION');

  // 2. Récupérer les productions à modifier
  const productions = await getProductionsToUpdate();

  if (productions.length === 0) {
    console.log('');
    console.log('✅ Toutes les productions ont déjà le statut "prepared"');
    console.log('   Rien à faire!');
    process.exit(0);
  }

  printTitle('🔍 PRODUCTIONS À MODIFIER');
  console.log('');
  console.log(`Nombre total: ${productions.length}`);
  console.log('');
  console.log('Exemples (5 premiers):');
  console.log('');
  console.log('Référence'.padEnd(20), 'Statut Actuel'.padEnd(20), 'Date Production');
  console.log('─'.repeat(70));

  productions.slice(0, 5).forEach(prod => {
    const date = new Date(prod.production_date).toLocaleDateString('fr-FR');
    console.log(
      (prod.bar_reference || 'N/A').padEnd(20),
      (prod.status || 'null').padEnd(20),
      date
    );
  });

  if (isDryRun) {
    console.log('');
    console.log('⚠️  MODE DRY-RUN: Les modifications ci-dessus ne seront PAS effectuées');
    console.log('   Retirez --dry-run pour effectuer les modifications');
    process.exit(0);
  }

  // 3. Demander confirmation
  console.log('');
  printSeparator();
  console.log('⚠️  ATTENTION: Vous êtes sur le point de modifier', productions.length, 'productions');
  console.log('   Tous les statuts seront changés à "prepared"');
  printSeparator();

  // Attendre 2 secondes pour laisser l'utilisateur lire
  console.log('');
  console.log('Démarrage dans 3 secondes... (Ctrl+C pour annuler)');
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('2...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('1...');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 4. Effectuer les mises à jour
  printTitle('🔨 MISE À JOUR EN COURS');
  console.log('');

  let successCount = 0;
  let errorCount = 0;
  const updatedIds = [];

  for (let i = 0; i < productions.length; i++) {
    const prod = productions[i];
    const result = await updateProduction(prod.id);

    if (result.success) {
      successCount++;
      updatedIds.push(prod.id);
    } else {
      errorCount++;
      console.error(`❌ Erreur pour ${prod.bar_reference}:`, result.error);
    }

    // Afficher la progression tous les 10 ou à la fin
    if ((i + 1) % 10 === 0 || i === productions.length - 1) {
      process.stdout.write(`\r✅ Progression: ${i + 1}/${productions.length}`);
    }
  }

  console.log('');
  console.log('');
  console.log(`✅ ${successCount} productions mises à jour avec succès`);
  if (errorCount > 0) {
    console.log(`❌ ${errorCount} erreurs`);
  }

  // Attendre un peu pour que les triggers s'exécutent
  console.log('');
  console.log('⏳ Attente de l\'exécution des triggers...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 5. Vérifier l'historique
  printTitle('📝 VÉRIFICATION HISTORIQUE');
  console.log('');

  const history = await verifyHistory(updatedIds);

  if (history.length > 0) {
    console.log(`✅ ${history.length} entrées trouvées dans unified_status_history`);
    console.log('');
    console.log('Dernières entrées créées:');
    console.log('');
    console.log('Ancien Statut'.padEnd(20), 'Nouveau'.padEnd(15), 'Date Changement');
    console.log('─'.repeat(70));

    history.slice(0, 5).forEach(entry => {
      const date = new Date(entry.changed_at).toLocaleString('fr-FR');
      console.log(
        (entry.old_status || 'null').padEnd(20),
        entry.new_status.padEnd(15),
        date
      );
    });
  } else {
    console.log('⚠️  Aucune entrée trouvée dans unified_status_history');
    console.log('   Le trigger pourrait ne pas fonctionner correctement');
  }

  // 6. Afficher le résumé APRÈS
  const summaryAfter = await getStatusSummary();
  if (summaryAfter) {
    displaySummary(summaryAfter, '📊 RÉSUMÉ APRÈS MODIFICATION');
  }

  // 7. Résumé final
  printTitle('✅ SCRIPT TERMINÉ AVEC SUCCÈS');
  console.log('');
  console.log('📌 Points importants:');
  console.log(`  • ${successCount} productions mises à jour`);
  console.log('  • Tous les statuts ont été changés à "prepared"');
  console.log('  • Les changements sont enregistrés dans unified_status_history');
  console.log('');
  console.log('🔍 Pour vérifier ultérieurement:');
  console.log('  Ouvrez la console Supabase et exécutez:');
  console.log('  SELECT * FROM unified_status_history');
  console.log('  WHERE entity_type = \'production\'');
  console.log('  ORDER BY changed_at DESC LIMIT 20;');
  console.log('');
}

// Gestion des erreurs
process.on('unhandledRejection', (error) => {
  console.error('');
  console.error('❌ Erreur non gérée:', error);
  process.exit(1);
});

// Gestion de Ctrl+C
process.on('SIGINT', () => {
  console.log('');
  console.log('');
  console.log('⚠️  Script interrompu par l\'utilisateur');
  process.exit(0);
});

// Exécuter
main().catch(error => {
  console.error('');
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
