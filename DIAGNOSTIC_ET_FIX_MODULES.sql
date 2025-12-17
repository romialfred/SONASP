/*
  ==========================================
  DIAGNOSTIC ET CORRECTION DES MODULES
  ==========================================

  Ce script va:
  1. Diagnostiquer le problème actuel
  2. Nettoyer les anciens modules
  3. Insérer tous les nouveaux modules
  ==========================================
*/

-- ==========================================
-- PARTIE 1: DIAGNOSTIC
-- ==========================================

-- Voir combien de modules vous avez actuellement
SELECT
  'DIAGNOSTIC' as section,
  COUNT(*) as nombre_total_modules,
  COUNT(CASE WHEN is_active THEN 1 END) as modules_actifs
FROM modules;

-- Voir les modules par catégorie actuellement
SELECT
  'MODULES PAR CATEGORIE' as section,
  category,
  COUNT(*) as nombre,
  STRING_AGG(name, ', ' ORDER BY name) as liste_modules
FROM modules
GROUP BY category
ORDER BY category;

-- Voir tous les modules actuels
SELECT
  'LISTE COMPLETE' as section,
  name,
  display_name,
  category,
  is_active
FROM modules
ORDER BY category, name;

-- ==========================================
-- PARTIE 2: NETTOYAGE
-- ==========================================

-- Supprimer TOUS les anciens modules
-- ATTENTION: Cela supprimera aussi les permissions associées si ON DELETE CASCADE
-- Si vous voulez garder les permissions, commentez cette ligne
DELETE FROM modules;

-- Message de confirmation
SELECT 'NETTOYAGE TERMINÉ - Anciens modules supprimés' as status;

-- ==========================================
-- PARTIE 3: VÉRIFICATION DE LA STRUCTURE
-- ==========================================

-- S'assurer que la colonne sort_order existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modules' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE modules ADD COLUMN sort_order integer DEFAULT 0;
    RAISE NOTICE 'Colonne sort_order ajoutée';
  ELSE
    RAISE NOTICE 'Colonne sort_order existe déjà';
  END IF;
END $$;

-- ==========================================
-- PARTIE 4: INSERTION DES 43 NOUVEAUX MODULES
-- ==========================================

INSERT INTO modules (name, display_name, description, category, sort_order) VALUES

-- ========== BATCHES MANAGEMENT (8 modules) ==========
('dashboard', 'Tableau de Bord', 'Tableaux de bord et vues d''ensemble', 'batches', 1),
('production_daily', 'Production Quotidienne', 'Enregistrement de la production quotidienne', 'batches', 2),
('production_view', 'Consultation Production', 'Voir les données de production', 'batches', 3),
('production_in_safe', 'Production en Coffre', 'Gestion de l''or en coffre', 'batches', 4),
('shipping_preparation', 'Préparation Expédition', 'Créer et gérer les préparations d''expédition', 'batches', 10),
('shipping_view', 'Consultation Expéditions', 'Voir les expéditions', 'batches', 11),
('documents_assay', 'Certificats d''Essai', 'Gestion des certificats d''essai', 'batches', 30),
('documents_export_licenses', 'Licences d''Export', 'Gestion des licences d''exportation', 'batches', 31),

-- ========== OPERATIONS (7 modules) ==========
('freight_shipments', 'Expéditions de Fret', 'Gestion des expéditions de fret internationales', 'operations', 20),
('freight_customs', 'Douanes & Documents', 'Factures et documents douaniers', 'operations', 21),
('inventory_gold', 'Inventaire Or', 'Gestion du stock d''or', 'operations', 40),
('inventory_silver', 'Inventaire Argent', 'Gestion du stock d''argent', 'operations', 41),
('receiving', 'Réception', 'Confirmation de réception des lots', 'operations', 50),
('refining_process', 'Processus de Raffinage', 'Gestion du processus de raffinage', 'operations', 51),
('refining_freight', 'Fret Raffinage', 'Expéditions vers raffineries', 'operations', 52),

-- ========== SALES MANAGEMENT (10 modules) ==========
('sales_view', 'Consultation Ventes', 'Voir les ventes d''or', 'sales', 60),
('sales_create', 'Création Vente', 'Créer nouvelle vente', 'sales', 61),
('sales_trade_space', 'Espace Trading', 'Espace de trading et ventes en direct', 'sales', 62),
('presales', 'Pré-Ventes', 'Gestion des pré-ventes et estimations', 'sales', 63),
('customers_view', 'Consultation Clients', 'Voir la liste des clients', 'sales', 70),
('customers_manage', 'Gestion Clients', 'Créer et modifier des clients', 'sales', 71),
('payments_view', 'Consultation Paiements', 'Voir les paiements', 'sales', 80),
('payments_create', 'Enregistrer Paiement', 'Enregistrer nouveau paiement', 'sales', 81),
('payments_approve', 'Approuver Paiements', 'Approuver les paiements clients', 'sales', 82),
('payments_virtual', 'Paiements Virtuels', 'Gérer les paiements virtuels', 'sales', 83),

-- ========== INSIGHTS & REPORTS (7 modules) ==========
('analytics_dashboard', 'Tableau Analytique', 'Analyses et intelligence d''affaires', 'analytics', 90),
('analytics_intelligence', 'Intelligence Center', 'Centre d''intelligence avancée', 'analytics', 91),
('reports_generate', 'Génération Rapports', 'Générer et gérer les rapports', 'analytics', 92),
('performance_budgets', 'Gestion Budgets', 'Gestion des budgets annuels', 'analytics', 100),
('performance_forecasts', 'Prévisions', 'Gestion des prévisions', 'analytics', 101),
('prices_gold', 'Prix de l''Or', 'Gestion des prix de l''or (LBMA)', 'analytics', 110),
('prices_fx_rates', 'Taux de Change', 'Gestion des taux FX (USD/CFA/GNF)', 'analytics', 111),

-- ========== ADMINISTRATION (11 modules) ==========
('stakeholders_mining', 'Sociétés Minières', 'Gestion des sociétés minières', 'system', 120),
('stakeholders_depositors', 'Déposants', 'Gestion des déposants', 'system', 121),
('stakeholders_freight', 'Compagnies de Fret', 'Gestion des compagnies de transport', 'system', 122),
('stakeholders_refineries', 'Raffineries', 'Gestion des raffineries', 'system', 123),
('stakeholders_transport', 'Transport Terrestre', 'Compagnies de transport terrestre', 'system', 124),
('users_manage', 'Gestion Utilisateurs', 'Créer et gérer les utilisateurs', 'system', 130),
('users_permissions', 'Permissions Utilisateurs', 'Configurer les permissions', 'system', 131),
('settings_system', 'Paramètres Système', 'Configuration système', 'system', 132),
('settings_gold_sales', 'Paramètres Ventes', 'Configuration des paramètres de vente', 'system', 133),
('settings_status_manager', 'Gestionnaire Statuts', 'Gérer les statuts et workflows', 'system', 134),
('audit_trail', 'Journal d''Audit', 'Consultation des logs d''audit', 'system', 140),
('approvals_dashboard', 'Tableau Approbations', 'Gestion des workflows d''approbation', 'system', 141);

-- Message de confirmation
SELECT 'INSERTION TERMINÉE - 43 nouveaux modules insérés' as status;

-- ==========================================
-- PARTIE 5: VÉRIFICATION FINALE
-- ==========================================

-- Compter les modules
SELECT
  'VERIFICATION FINALE' as section,
  COUNT(*) as total_modules,
  COUNT(CASE WHEN is_active THEN 1 END) as modules_actifs
FROM modules;

-- Résumé par catégorie
SELECT
  'RESUME PAR CATEGORIE' as section,
  category,
  COUNT(*) as nombre_modules,
  STRING_AGG(display_name, ', ' ORDER BY sort_order) as modules
FROM modules
WHERE is_active = true
GROUP BY category
ORDER BY
  CASE category
    WHEN 'batches' THEN 1
    WHEN 'operations' THEN 2
    WHEN 'sales' THEN 3
    WHEN 'analytics' THEN 4
    WHEN 'system' THEN 5
    ELSE 6
  END;

-- Liste complète pour vérification
SELECT
  'LISTE COMPLETE FINALE' as section,
  category,
  name,
  display_name,
  sort_order,
  is_active
FROM modules
ORDER BY
  CASE category
    WHEN 'batches' THEN 1
    WHEN 'operations' THEN 2
    WHEN 'sales' THEN 3
    WHEN 'analytics' THEN 4
    WHEN 'system' THEN 5
    ELSE 6
  END,
  sort_order;

-- ==========================================
-- RÉSULTAT ATTENDU
-- ==========================================
/*
Vous devriez voir:

VERIFICATION FINALE:
- total_modules: 43
- modules_actifs: 43

RESUME PAR CATEGORIE:
- batches: 8 modules
- operations: 7 modules
- sales: 10 modules
- analytics: 7 modules
- system: 11 modules

TOTAL: 43 MODULES
*/
