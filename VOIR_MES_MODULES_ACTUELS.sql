/*
  ==========================================
  DIAGNOSTIC SIMPLE - Voir vos modules actuels
  ==========================================

  Copiez/collez ce script dans Supabase SQL Editor
  pour voir exactement ce que vous avez actuellement
  ==========================================
*/

-- Combien de modules avez-vous ?
SELECT
  '1. NOMBRE DE MODULES' as diagnostic,
  COUNT(*) as total,
  COUNT(CASE WHEN is_active THEN 1 END) as actifs,
  COUNT(CASE WHEN NOT is_active THEN 1 END) as inactifs
FROM modules;

-- Quelles catégories avez-vous ?
SELECT
  '2. PAR CATEGORIE' as diagnostic,
  category,
  COUNT(*) as nombre,
  STRING_AGG(display_name, ', ') as liste
FROM modules
WHERE is_active = true
GROUP BY category
ORDER BY category;

-- Liste complète de vos modules
SELECT
  '3. LISTE COMPLETE' as diagnostic,
  name as nom_technique,
  display_name as nom_affiche,
  category,
  is_active as actif
FROM modules
ORDER BY
  CASE category
    WHEN 'batches' THEN 1
    WHEN 'operations' THEN 2
    WHEN 'sales' THEN 3
    WHEN 'analytics' THEN 4
    WHEN 'system' THEN 5
    ELSE 99
  END,
  display_name;

-- Vérifier si la colonne sort_order existe
SELECT
  '4. STRUCTURE TABLE' as diagnostic,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'modules'
ORDER BY ordinal_position;

-- Combien de permissions utilisateurs ?
SELECT
  '5. PERMISSIONS UTILISATEURS' as diagnostic,
  COUNT(DISTINCT user_id) as nombre_utilisateurs,
  COUNT(*) as total_permissions
FROM user_permissions;

/*
  ==========================================
  INTERPRÉTATION DES RÉSULTATS
  ==========================================

  1. NOMBRE DE MODULES
  - Si total < 43 → Vous n'avez pas tous les modules
  - Si total = 43 → Parfait !
  - Si total > 43 → Vous avez des anciens modules

  2. PAR CATEGORIE
  - Attendu: batches=8, operations=7, sales=10, analytics=7, system=11
  - Si différent → Exécuter FIX_MODULES_SANS_SUPPRIMER.sql

  3. LISTE COMPLETE
  - Vérifiez les noms affichés
  - Si vous voyez "Batches", "Sales", "Analytics" seulement
    → Ce sont les anciens modules
  - Si vous voyez "Tableau de Bord", "Production Quotidienne", etc.
    → Ce sont les bons modules !

  4. STRUCTURE TABLE
  - Doit contenir la colonne "sort_order"
  - Si absente → Le script la créera automatiquement

  5. PERMISSIONS UTILISATEURS
  - Nombre d'utilisateurs ayant des permissions
  - Total de permissions configurées
  ==========================================
*/
