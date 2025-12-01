/*
  # OPTIMISATION TABLES FREIGHT & CUSTOMS (Optionnel)

  ## Objectif
  Récupérer l'espace disque et mettre à jour les statistiques
  après le nettoyage du module Freight & Customs

  ## ⚠️ IMPORTANT - Supabase SQL Editor
  Supabase SQL Editor exécute tout dans une transaction.
  VACUUM ne peut PAS s'exécuter dans une transaction.

  ## ✅ SOLUTION SIMPLE - Utilisez ANALYZE seulement

  ANALYZE fonctionne dans une transaction et met à jour les statistiques
  pour améliorer les performances des requêtes. C'est suffisant pour
  la plupart des cas.

  La seule différence: VACUUM récupère aussi l'espace disque, mais ce
  n'est généralement pas critique après une simple suppression de données.
*/

-- Mettre à jour les statistiques de la table des signataires
ANALYZE freight_shipment_signatories;

-- Mettre à jour les statistiques de la table des productions liées
ANALYZE freight_shipment_productions;

-- Mettre à jour les statistiques de la table des expéditions principales
ANALYZE freight_shipments;

/*
  ## 📊 RÉSULTAT
  Les statistiques des tables sont maintenant à jour.
  PostgreSQL pourra optimiser automatiquement les requêtes sur ces tables.

  ## 💡 Pour exécuter VACUUM (optionnel, via psql uniquement)
  Si vous avez accès à psql en ligne de commande:

  psql $DATABASE_URL -c "VACUUM ANALYZE freight_shipment_signatories;"
  psql $DATABASE_URL -c "VACUUM ANALYZE freight_shipment_productions;"
  psql $DATABASE_URL -c "VACUUM ANALYZE freight_shipments;"
*/
