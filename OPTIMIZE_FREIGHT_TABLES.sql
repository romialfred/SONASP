/*
  # OPTIMISATION TABLES FREIGHT & CUSTOMS (Optionnel)
  
  ## Objectif
  Récupérer l'espace disque et mettre à jour les statistiques
  après le nettoyage du module Freight & Customs
  
  ## À Exécuter APRÈS
  Exécuter ce script APRÈS avoir exécuté CLEANUP_FREIGHT_CUSTOMS_MODULE.sql
  
  ## Important
  VACUUM ne peut pas s'exécuter dans une transaction, donc ce script
  doit être exécuté SÉPARÉMENT du nettoyage principal
*/

-- Optimiser la table des signataires
VACUUM ANALYZE freight_shipment_signatories;

-- Optimiser la table des productions liées
VACUUM ANALYZE freight_shipment_productions;

-- Optimiser la table des expéditions principales
VACUUM ANALYZE freight_shipments;
