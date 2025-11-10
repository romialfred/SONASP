/*
  Script SQL pour supprimer toutes les préparations d'expédition avec le statut "prepared"
  et toutes leurs données liées.

  ATTENTION: Ce script supprime définitivement des données!

  Utilisation:
  1. Exécuter d'abord la section "PREVIEW" pour voir ce qui sera supprimé
  2. Puis exécuter la section "DELETE" pour supprimer
*/

-- ============================================================================
-- PREVIEW: Voir ce qui sera supprimé (sans supprimer)
-- ============================================================================

-- Préparations qui seront supprimées
SELECT
  'shipping_preparations' as table_name,
  id,
  expedition_lot_number,
  status,
  created_at,
  packing_list_url
FROM shipping_preparations
WHERE status = 'prepared'
ORDER BY created_at DESC;

-- Documents qui seront supprimés
SELECT
  'shipping_documents' as table_name,
  sd.id,
  sd.shipping_preparation_id,
  sp.expedition_lot_number,
  sd.title,
  sd.file_name,
  sd.file_size,
  sd.document_url
FROM shipping_documents sd
JOIN shipping_preparations sp ON sp.id = sd.shipping_preparation_id
WHERE sp.status = 'prepared'
ORDER BY sd.created_at DESC;

-- Production items qui seront supprimés
SELECT
  'shipping_production_items' as table_name,
  spi.id,
  spi.shipping_preparation_id,
  sp.expedition_lot_number,
  spi.ingot_box_number,
  spi.net_weight_grams,
  spi.gross_weight_grams
FROM shipping_production_items spi
JOIN shipping_preparations sp ON sp.id = spi.shipping_preparation_id
WHERE sp.status = 'prepared'
ORDER BY spi.order_index;

-- Signataires qui seront supprimés
SELECT
  'shipping_signatories' as table_name,
  ss.id,
  ss.shipping_preparation_id,
  sp.expedition_lot_number,
  ss.position,
  ss.name
FROM shipping_signatories ss
JOIN shipping_preparations sp ON sp.id = ss.shipping_preparation_id
WHERE sp.status = 'prepared'
ORDER BY ss.order_index;

-- Comptage total
SELECT
  (SELECT COUNT(*) FROM shipping_preparations WHERE status = 'prepared') as total_preparations,
  (SELECT COUNT(*) FROM shipping_documents sd
   JOIN shipping_preparations sp ON sp.id = sd.shipping_preparation_id
   WHERE sp.status = 'prepared') as total_documents,
  (SELECT COUNT(*) FROM shipping_production_items spi
   JOIN shipping_preparations sp ON sp.id = spi.shipping_preparation_id
   WHERE sp.status = 'prepared') as total_production_items,
  (SELECT COUNT(*) FROM shipping_signatories ss
   JOIN shipping_preparations sp ON sp.id = ss.shipping_preparation_id
   WHERE sp.status = 'prepared') as total_signatories;

-- ============================================================================
-- DELETE: Supprimer toutes les données (ATTENTION: Irréversible!)
-- ============================================================================

-- Désactiver temporairement les triggers si nécessaire
-- SET session_replication_role = 'replica';

-- Étape 1: Supprimer les documents
DELETE FROM shipping_documents
WHERE shipping_preparation_id IN (
  SELECT id FROM shipping_preparations WHERE status = 'prepared'
);

-- Étape 2: Supprimer les production items
DELETE FROM shipping_production_items
WHERE shipping_preparation_id IN (
  SELECT id FROM shipping_preparations WHERE status = 'prepared'
);

-- Étape 3: Supprimer les signataires
DELETE FROM shipping_signatories
WHERE shipping_preparation_id IN (
  SELECT id FROM shipping_preparations WHERE status = 'prepared'
);

-- Étape 4: Supprimer les préparations
DELETE FROM shipping_preparations
WHERE status = 'prepared';

-- Réactiver les triggers
-- SET session_replication_role = 'origin';

-- Vérification finale
SELECT
  (SELECT COUNT(*) FROM shipping_preparations WHERE status = 'prepared') as remaining_preparations,
  (SELECT COUNT(*) FROM shipping_documents sd
   JOIN shipping_preparations sp ON sp.id = sd.shipping_preparation_id
   WHERE sp.status = 'prepared') as remaining_documents,
  (SELECT COUNT(*) FROM shipping_production_items spi
   JOIN shipping_preparations sp ON sp.id = spi.shipping_preparation_id
   WHERE sp.status = 'prepared') as remaining_production_items,
  (SELECT COUNT(*) FROM shipping_signatories ss
   JOIN shipping_preparations sp ON sp.id = ss.shipping_preparation_id
   WHERE sp.status = 'prepared') as remaining_signatories;

-- NOTE: Les fichiers PDF dans le storage bucket 'shipping-documents' doivent être
-- supprimés manuellement via l'interface Supabase Storage ou via le script Node.js
-- car ils ne sont pas automatiquement supprimés par les requêtes SQL.
