#!/usr/bin/env node

/**
 * Script de Nettoyage Complet des Données de Shipping
 *
 * Ce script supprime TOUTES les données liées au système de shipping :
 * - shipping_documents
 * - shipping_signatories
 * - shipping_ingots
 * - shipping_production_items
 * - shipping_preparations
 * - Fichiers dans le bucket shipping-documents
 *
 * ATTENTION : Cette opération est IRRÉVERSIBLE !
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erreur: Variables d\'environnement VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requises');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
  stat: (label, value) => console.log(`  ${colors.magenta}${label}:${colors.reset} ${value}`),
};

// Mode dry-run par défaut pour sécurité
const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--confirm');

/**
 * Compte les enregistrements dans une table
 */
async function countRecords(tableName) {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (error) {
    log.error(`Erreur lors du comptage de ${tableName}: ${error.message}`);
    return 0;
  }

  return count || 0;
}

/**
 * Liste les fichiers dans le bucket shipping-documents
 */
async function listStorageFiles() {
  const { data, error } = await supabase.storage
    .from('shipping-documents')
    .list('', {
      limit: 1000,
      offset: 0,
    });

  if (error) {
    log.error(`Erreur lors de la liste des fichiers: ${error.message}`);
    return [];
  }

  return data || [];
}

/**
 * Supprime tous les fichiers du bucket
 */
async function cleanupStorageFiles(folders) {
  if (folders.length === 0) {
    log.info('Aucun fichier à supprimer dans le storage');
    return { success: true, deleted: 0 };
  }

  let totalDeleted = 0;

  for (const folder of folders) {
    // Liste tous les fichiers dans ce dossier
    const { data: files, error: listError } = await supabase.storage
      .from('shipping-documents')
      .list(folder.name);

    if (listError) {
      log.error(`Erreur lors de la liste des fichiers dans ${folder.name}: ${listError.message}`);
      continue;
    }

    if (files && files.length > 0) {
      const filePaths = files.map(f => `${folder.name}/${f.name}`);

      if (isDryRun) {
        log.warning(`[DRY-RUN] Suppression de ${filePaths.length} fichier(s) dans ${folder.name}`);
        totalDeleted += filePaths.length;
      } else {
        const { error: deleteError } = await supabase.storage
          .from('shipping-documents')
          .remove(filePaths);

        if (deleteError) {
          log.error(`Erreur lors de la suppression des fichiers dans ${folder.name}: ${deleteError.message}`);
        } else {
          log.success(`Supprimé ${filePaths.length} fichier(s) dans ${folder.name}`);
          totalDeleted += filePaths.length;
        }
      }
    }

    // Supprimer le dossier lui-même (vide maintenant)
    if (!isDryRun) {
      const { error: deleteFolderError } = await supabase.storage
        .from('shipping-documents')
        .remove([folder.name]);

      if (deleteFolderError) {
        log.warning(`Le dossier ${folder.name} n'a pas pu être supprimé (peut-être pas vide)`);
      }
    }
  }

  return { success: true, deleted: totalDeleted };
}

/**
 * Supprime tous les enregistrements d'une table
 */
async function deleteAllFromTable(tableName) {
  const count = await countRecords(tableName);

  if (count === 0) {
    log.info(`Table ${tableName} : déjà vide`);
    return { success: true, deleted: 0 };
  }

  if (isDryRun) {
    log.warning(`[DRY-RUN] Suppression de ${count} enregistrement(s) de ${tableName}`);
    return { success: true, deleted: count };
  }

  // Supprimer par lots pour éviter les timeouts
  const batchSize = 100;
  let totalDeleted = 0;

  while (true) {
    // Récupérer un lot d'IDs
    const { data: records, error: fetchError } = await supabase
      .from(tableName)
      .select('id')
      .limit(batchSize);

    if (fetchError) {
      log.error(`Erreur lors de la récupération des IDs de ${tableName}: ${fetchError.message}`);
      return { success: false, deleted: totalDeleted };
    }

    if (!records || records.length === 0) {
      break; // Plus d'enregistrements
    }

    const ids = records.map(r => r.id);

    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .in('id', ids);

    if (deleteError) {
      log.error(`Erreur lors de la suppression de ${tableName}: ${deleteError.message}`);
      return { success: false, deleted: totalDeleted };
    }

    totalDeleted += ids.length;
    log.info(`${tableName} : ${totalDeleted}/${count} supprimés...`);
  }

  log.success(`Table ${tableName} : ${totalDeleted} enregistrement(s) supprimé(s)`);
  return { success: true, deleted: totalDeleted };
}

/**
 * Affiche les statistiques avant nettoyage
 */
async function displayStats() {
  log.title('📊 STATISTIQUES ACTUELLES');

  const stats = {
    shipping_documents: await countRecords('shipping_documents'),
    shipping_signatories: await countRecords('shipping_signatories'),
    shipping_ingots: await countRecords('shipping_ingots'),
    shipping_production_items: await countRecords('shipping_production_items'),
    shipping_preparations: await countRecords('shipping_preparations'),
  };

  const folders = await listStorageFiles();
  let totalFiles = 0;
  for (const folder of folders) {
    const { data: files } = await supabase.storage
      .from('shipping-documents')
      .list(folder.name);
    if (files) {
      totalFiles += files.length;
    }
  }

  log.stat('shipping_preparations', stats.shipping_preparations);
  log.stat('shipping_production_items', stats.shipping_production_items);
  log.stat('shipping_ingots', stats.shipping_ingots);
  log.stat('shipping_signatories', stats.shipping_signatories);
  log.stat('shipping_documents', stats.shipping_documents);
  log.stat('Fichiers storage', `${totalFiles} dans ${folders.length} dossier(s)`);

  const total = Object.values(stats).reduce((sum, val) => sum + val, 0) + totalFiles;
  console.log(`\n  ${colors.bright}TOTAL : ${total} éléments${colors.reset}\n`);

  return { stats, folders, totalFiles };
}

/**
 * Fonction principale
 */
async function main() {
  console.log('\n' + '='.repeat(70));
  log.title('🗑️  NETTOYAGE COMPLET DES DONNÉES DE SHIPPING');
  console.log('='.repeat(70));

  if (isDryRun) {
    log.warning('MODE DRY-RUN : Aucune suppression réelle ne sera effectuée');
    log.info('Pour exécuter le nettoyage réel, utilisez : npm run cleanup:shipping -- --confirm');
  } else {
    log.error('⚠️  ATTENTION : MODE SUPPRESSION RÉELLE ACTIVÉ ⚠️');
    log.error('Cette opération est IRRÉVERSIBLE !');
  }

  // Afficher les statistiques
  const { stats, folders, totalFiles } = await displayStats();

  const totalRecords = Object.values(stats).reduce((sum, val) => sum + val, 0);
  const totalItems = totalRecords + totalFiles;

  if (totalItems === 0) {
    log.success('✨ Aucune donnée de shipping trouvée. Base de données déjà propre !');
    return;
  }

  if (isDryRun) {
    log.title('🔍 APERÇU DES SUPPRESSIONS (DRY-RUN)');
  } else {
    log.title('🗑️  DÉBUT DU NETTOYAGE');
  }

  let deletedCount = 0;

  // 1. Supprimer les documents (enfants de shipping_preparations)
  console.log('\n📄 Étape 1/6 : shipping_documents');
  const docsResult = await deleteAllFromTable('shipping_documents');
  deletedCount += docsResult.deleted;

  // 2. Supprimer les signataires (enfants de shipping_preparations)
  console.log('\n✍️  Étape 2/6 : shipping_signatories');
  const sigResult = await deleteAllFromTable('shipping_signatories');
  deletedCount += sigResult.deleted;

  // 3. Supprimer les lingots (enfants de shipping_preparations)
  console.log('\n🪙  Étape 3/6 : shipping_ingots');
  const ingotsResult = await deleteAllFromTable('shipping_ingots');
  deletedCount += ingotsResult.deleted;

  // 4. Supprimer les items de production (enfants de shipping_preparations)
  console.log('\n📦 Étape 4/6 : shipping_production_items');
  const itemsResult = await deleteAllFromTable('shipping_production_items');
  deletedCount += itemsResult.deleted;

  // 5. Supprimer les préparations (parent)
  console.log('\n📋 Étape 5/6 : shipping_preparations');
  const prepsResult = await deleteAllFromTable('shipping_preparations');
  deletedCount += prepsResult.deleted;

  // 6. Nettoyer le storage
  console.log('\n💾 Étape 6/6 : Fichiers storage');
  const storageResult = await cleanupStorageFiles(folders);
  deletedCount += storageResult.deleted;

  // Résumé final
  console.log('\n' + '='.repeat(70));
  log.title('📊 RÉSUMÉ DU NETTOYAGE');
  console.log('='.repeat(70));

  log.stat('Total éléments supprimés', deletedCount);

  if (isDryRun) {
    log.warning('\n⚠️  Ceci était un DRY-RUN - Aucune suppression réelle effectuée');
    log.info('\nPour exécuter le nettoyage réel :');
    console.log(`  ${colors.cyan}npm run cleanup:shipping -- --confirm${colors.reset}`);
  } else {
    log.success('\n✨ Nettoyage terminé avec succès !');

    // Vérification finale
    const finalStats = {
      shipping_preparations: await countRecords('shipping_preparations'),
      shipping_production_items: await countRecords('shipping_production_items'),
      shipping_ingots: await countRecords('shipping_ingots'),
      shipping_signatories: await countRecords('shipping_signatories'),
      shipping_documents: await countRecords('shipping_documents'),
    };

    const remaining = Object.values(finalStats).reduce((sum, val) => sum + val, 0);

    if (remaining === 0) {
      log.success('✓ Toutes les tables de shipping sont maintenant vides');
    } else {
      log.warning(`⚠️  Il reste ${remaining} enregistrement(s) (possiblement dû aux contraintes RLS)`);
    }
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

// Exécuter le script
main().catch((error) => {
  log.error(`Erreur fatale: ${error.message}`);
  console.error(error);
  process.exit(1);
});
