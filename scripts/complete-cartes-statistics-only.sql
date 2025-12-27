/*
  Script Partiel: Création des Statistiques de Cartes

  Date: 27 Décembre 2024

  CONTEXTE:
  Ce script contient UNIQUEMENT la partie qui a échoué lors de l'exécution
  du script complet fix-cartes-table-and-generate-data.sql

  La première partie (colonnes, cartes, activités) s'est bien exécutée.
  Seule la création des statistiques a échoué à cause de colonnes inexistantes.

  NE PAS RÉEXÉCUTER LE SCRIPT COMPLET!
  Exécuter seulement ce script pour compléter l'installation.

  TABLES CONCERNÉES:
  - snp_carte_statistics (insertion de données)

  COLONNES VÉRIFIÉES:
  ✅ carte_id (uuid, NOT NULL, UNIQUE)
  ✅ nombre_ventes (integer, DEFAULT 0)
  ✅ nombre_achats (integer, DEFAULT 0)
  ✅ quantite_totale_grammes (numeric(15,3), DEFAULT 0)
  ✅ montant_total (numeric(15,2), DEFAULT 0)
  ✅ derniere_activite (date, nullable)

  ❌ COLONNES QUI N'EXISTENT PAS (corrigées):
  - artisan_id
  - annee, mois
  - montant_total_ventes (la vraie colonne: montant_total)
  - quantite_totale_onces
  - nombre_collectes, nombre_depots, nombre_transactions
  - jours_actifs
*/

-- Créer des statistiques pour les cartes en exploitation
-- ✅ Colonnes vérifiées dans le DDL de snp_carte_statistics
INSERT INTO snp_carte_statistics (
  carte_id,
  nombre_ventes,
  nombre_achats,
  quantite_totale_grammes,
  montant_total,
  derniere_activite
)
SELECT
  c.id,
  (1 + random() * 5)::INTEGER,
  (1 + random() * 3)::INTEGER,
  (100 + random() * 800)::NUMERIC(15,3),
  (200000 + random() * 3000000)::NUMERIC(15,2),
  CURRENT_DATE - (random() * 30)::INTEGER * INTERVAL '1 day'
FROM snp_cartes_professionnelles c
WHERE c.statut = 'en_exploitation'
  AND random() < 0.7
ON CONFLICT (carte_id) DO NOTHING;

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM snp_carte_statistics;
  RAISE NOTICE '% statistiques créées', v_count;
END $$;

-- Afficher le résumé final
DO $$
DECLARE
  v_stats RECORD;
BEGIN
  SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE statut = 'en_cours') as en_cours,
    COUNT(*) FILTER (WHERE statut = 'validee') as validee,
    COUNT(*) FILTER (WHERE statut = 'en_exploitation') as en_exploitation,
    COUNT(*) FILTER (WHERE statut = 'expiree') as expiree,
    COUNT(*) FILTER (WHERE statut = 'suspendue') as suspendue,
    COUNT(*) FILTER (WHERE date_expiration < CURRENT_DATE) as deja_expirees,
    COUNT(*) FILTER (WHERE date_expiration BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days') as expire_7j,
    COUNT(*) FILTER (WHERE date_expiration BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') as expire_30j,
    COUNT(*) FILTER (WHERE date_expiration BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days') as expire_60j
  INTO v_stats
  FROM snp_cartes_professionnelles;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '=== RÉSUMÉ DES CARTES CRÉÉES ===';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total cartes: %', v_stats.total;
  RAISE NOTICE '';
  RAISE NOTICE '--- Par Statut ---';
  RAISE NOTICE 'En cours (attente validation): %', v_stats.en_cours;
  RAISE NOTICE 'Validées: %', v_stats.validee;
  RAISE NOTICE 'En exploitation: %', v_stats.en_exploitation;
  RAISE NOTICE 'Expirées: %', v_stats.expiree;
  RAISE NOTICE 'Suspendues: %', v_stats.suspendue;
  RAISE NOTICE '';
  RAISE NOTICE '--- Alertes Expiration ---';
  RAISE NOTICE 'Déjà expirées: %', v_stats.deja_expirees;
  RAISE NOTICE 'Expirant dans 7 jours: %', v_stats.expire_7j;
  RAISE NOTICE 'Expirant dans 30 jours: %', v_stats.expire_30j;
  RAISE NOTICE 'Expirant dans 60 jours: %', v_stats.expire_60j;
  RAISE NOTICE '========================================';
END $$;
