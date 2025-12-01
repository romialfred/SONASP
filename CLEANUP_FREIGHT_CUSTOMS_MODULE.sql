/*
  # NETTOYAGE COMPLET: Module Freight & Customs
  
  ## Objectif
  Supprimer TOUTES les données du module Freight & Customs pour remettre à zéro
  
  ## Tables Concernées
  1. freight_shipment_signatories
  2. freight_shipment_productions
  3. freight_shipments
  
  ## Ordre de Suppression
  Respecte les contraintes de clés étrangères (enfant → parent)
  
  ## Impact
  - Supprime toutes les expéditions freight
  - Supprime toutes les productions liées
  - Supprime tous les signataires
  - Les productions dans daily_production ne sont PAS supprimées
  - Le module reste fonctionnel mais vide
*/

-- =====================================================
-- 1. DÉSACTIVER LES TRIGGERS UTILISATEUR TEMPORAIREMENT
-- =====================================================

-- Désactiver uniquement les triggers utilisateur (pas les triggers système)
ALTER TABLE freight_shipments DISABLE TRIGGER USER;
ALTER TABLE freight_shipment_productions DISABLE TRIGGER USER;
ALTER TABLE freight_shipment_signatories DISABLE TRIGGER USER;

-- =====================================================
-- 2. SUPPRESSION DES DONNÉES (Ordre: Enfant → Parent)
-- =====================================================

DO $$
DECLARE
  v_signatories_count int;
  v_productions_count int;
  v_shipments_count int;
BEGIN
  -- Compter avant suppression
  SELECT COUNT(*) INTO v_signatories_count FROM freight_shipment_signatories;
  SELECT COUNT(*) INTO v_productions_count FROM freight_shipment_productions;
  SELECT COUNT(*) INTO v_shipments_count FROM freight_shipments;
  
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'DÉBUT DU NETTOYAGE - FREIGHT & CUSTOMS';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Signataires à supprimer: %', v_signatories_count;
  RAISE NOTICE 'Productions liées à supprimer: %', v_productions_count;
  RAISE NOTICE 'Expéditions à supprimer: %', v_shipments_count;
  RAISE NOTICE '';
  
  -- Étape 1: Supprimer les signataires
  RAISE NOTICE '1/3 Suppression des signataires...';
  DELETE FROM freight_shipment_signatories;
  RAISE NOTICE '✓ Signataires supprimés: %', v_signatories_count;
  
  -- Étape 2: Supprimer les productions liées
  RAISE NOTICE '2/3 Suppression des productions liées...';
  DELETE FROM freight_shipment_productions;
  RAISE NOTICE '✓ Productions liées supprimées: %', v_productions_count;
  
  -- Étape 3: Supprimer les expéditions principales
  RAISE NOTICE '3/3 Suppression des expéditions...';
  DELETE FROM freight_shipments;
  RAISE NOTICE '✓ Expéditions supprimées: %', v_shipments_count;
  
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'NETTOYAGE TERMINÉ AVEC SUCCÈS';
  RAISE NOTICE '==============================================';
END $$;

-- =====================================================
-- 3. RÉACTIVER LES TRIGGERS UTILISATEUR
-- =====================================================

ALTER TABLE freight_shipment_signatories ENABLE TRIGGER USER;
ALTER TABLE freight_shipment_productions ENABLE TRIGGER USER;
ALTER TABLE freight_shipments ENABLE TRIGGER USER;

-- =====================================================
-- 4. RÉINITIALISER LES SÉQUENCES (si applicable)
-- =====================================================

-- Aucune séquence spécifique à réinitialiser (UUIDs utilisés)

-- =====================================================
-- 5. VÉRIFICATION FINALE
-- =====================================================

DO $$
DECLARE
  v_remaining_signatories int;
  v_remaining_productions int;
  v_remaining_shipments int;
BEGIN
  SELECT COUNT(*) INTO v_remaining_signatories FROM freight_shipment_signatories;
  SELECT COUNT(*) INTO v_remaining_productions FROM freight_shipment_productions;
  SELECT COUNT(*) INTO v_remaining_shipments FROM freight_shipments;
  
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'VÉRIFICATION FINALE';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Signataires restants: %', v_remaining_signatories;
  RAISE NOTICE 'Productions liées restantes: %', v_remaining_productions;
  RAISE NOTICE 'Expéditions restantes: %', v_remaining_shipments;
  
  IF v_remaining_signatories = 0 AND v_remaining_productions = 0 AND v_remaining_shipments = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ MODULE FREIGHT & CUSTOMS COMPLÈTEMENT VIDE';
    RAISE NOTICE '✅ Prêt pour de nouvelles données';
  ELSE
    RAISE WARNING 'Des données restent dans les tables!';
  END IF;
  RAISE NOTICE '==============================================';
END $$;

-- =====================================================
-- 6. VACUUM ET ANALYSE (Optionnel - Optimisation)
-- =====================================================

-- Récupérer l'espace disque et mettre à jour les statistiques
VACUUM ANALYZE freight_shipment_signatories;
VACUUM ANALYZE freight_shipment_productions;
VACUUM ANALYZE freight_shipments;

-- =====================================================
-- 7. MESSAGE FINAL
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✓ Optimisation des tables effectuée';
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'SCRIPT TERMINÉ - MODULE FREIGHT & CUSTOMS VIDE';
  RAISE NOTICE '==============================================';
END $$;
