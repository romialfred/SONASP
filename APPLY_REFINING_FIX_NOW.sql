/*
  =====================================================================
  CORRECTION MODULE REFINING PROCESS - À COPIER DANS SUPABASE SQL EDITOR
  =====================================================================

  Cette migration ajoute les statuts et colonnes manquants pour le
  module de raffinage. Elle est idempotente et sécurisée.

  INSTRUCTIONS:
  1. Ouvrir Supabase Dashboard
  2. Aller dans SQL Editor
  3. Copier tout ce fichier
  4. Cliquer sur "Run"
  5. Rafraîchir votre application
*/

-- ====================================================================
-- ÉTAPE 1: AJOUTER LES NOUVEAUX STATUTS À L'ENUM
-- ====================================================================

DO $$
BEGIN
  -- Vérifier et ajouter 'processing'
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'processing'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'freight_shipment_status')
  ) THEN
    ALTER TYPE freight_shipment_status ADD VALUE 'processing';
    RAISE NOTICE 'Statut "processing" ajouté';
  ELSE
    RAISE NOTICE 'Statut "processing" existe déjà';
  END IF;

  -- Vérifier et ajouter 'processed'
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'processed'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'freight_shipment_status')
  ) THEN
    ALTER TYPE freight_shipment_status ADD VALUE 'processed';
    RAISE NOTICE 'Statut "processed" ajouté';
  ELSE
    RAISE NOTICE 'Statut "processed" existe déjà';
  END IF;

  -- Vérifier et ajouter 'in_stock'
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'in_stock'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'freight_shipment_status')
  ) THEN
    ALTER TYPE freight_shipment_status ADD VALUE 'in_stock';
    RAISE NOTICE 'Statut "in_stock" ajouté';
  ELSE
    RAISE NOTICE 'Statut "in_stock" existe déjà';
  END IF;
END $$;

-- ====================================================================
-- ÉTAPE 2: AJOUTER LES COLONNES DE TRACKING POUR LE WORKFLOW
-- ====================================================================

DO $$
BEGIN
  -- Processing started
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments'
    AND column_name = 'processing_started_at'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN processing_started_at TIMESTAMPTZ;
    RAISE NOTICE 'Colonne "processing_started_at" ajoutée';
  ELSE
    RAISE NOTICE 'Colonne "processing_started_at" existe déjà';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments'
    AND column_name = 'processing_started_by'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN processing_started_by UUID REFERENCES auth.users(id);
    RAISE NOTICE 'Colonne "processing_started_by" ajoutée';
  ELSE
    RAISE NOTICE 'Colonne "processing_started_by" existe déjà';
  END IF;

  -- Processed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments'
    AND column_name = 'processed_at'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN processed_at TIMESTAMPTZ;
    RAISE NOTICE 'Colonne "processed_at" ajoutée';
  ELSE
    RAISE NOTICE 'Colonne "processed_at" existe déjà';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments'
    AND column_name = 'processed_by'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN processed_by UUID REFERENCES auth.users(id);
    RAISE NOTICE 'Colonne "processed_by" ajoutée';
  ELSE
    RAISE NOTICE 'Colonne "processed_by" existe déjà';
  END IF;

  -- In stock
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments'
    AND column_name = 'stocked_at'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN stocked_at TIMESTAMPTZ;
    RAISE NOTICE 'Colonne "stocked_at" ajoutée';
  ELSE
    RAISE NOTICE 'Colonne "stocked_at" existe déjà';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments'
    AND column_name = 'stocked_by'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN stocked_by UUID REFERENCES auth.users(id);
    RAISE NOTICE 'Colonne "stocked_by" ajoutée';
  ELSE
    RAISE NOTICE 'Colonne "stocked_by" existe déjà';
  END IF;

  -- Refining notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'freight_shipments'
    AND column_name = 'refining_notes'
  ) THEN
    ALTER TABLE freight_shipments ADD COLUMN refining_notes TEXT;
    RAISE NOTICE 'Colonne "refining_notes" ajoutée';
  ELSE
    RAISE NOTICE 'Colonne "refining_notes" existe déjà';
  END IF;
END $$;

-- ====================================================================
-- ÉTAPE 3: METTRE À JOUR LE COMMENTAIRE DU STATUT
-- ====================================================================

COMMENT ON COLUMN freight_shipments.status IS
  'Workflow: pending, approved, shipped_to_refinery, received_at_refinery, processing, processed, in_stock';

-- ====================================================================
-- VÉRIFICATION: AFFICHER LES STATUTS DISPONIBLES
-- ====================================================================

SELECT
  'Statuts disponibles:' as info,
  string_agg(enumlabel, ', ' ORDER BY enumlabel) as statuts
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'freight_shipment_status');

-- ====================================================================
-- MIGRATION TERMINÉE AVEC SUCCÈS
-- ====================================================================
-- Vous pouvez maintenant rafraîchir votre application.
-- Le module Refining Process devrait fonctionner correctement.
-- ====================================================================
