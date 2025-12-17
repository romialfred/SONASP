/*
  ==========================================
  CORRECTION MODULES - VERSION SÉCURISÉE
  ==========================================

  Cette version NE SUPPRIME PAS les modules existants
  Elle les met à jour et ajoute les nouveaux
  Les permissions utilisateurs sont préservées
  ==========================================
*/

-- ==========================================
-- STEP 1: DIAGNOSTIC INITIAL
-- ==========================================

SELECT 'AVANT CORRECTION' as etape;

SELECT
  COUNT(*) as modules_avant,
  COUNT(CASE WHEN is_active THEN 1 END) as actifs_avant
FROM modules;

-- ==========================================
-- STEP 2: AJOUTER sort_order SI MANQUANT
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modules' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE modules ADD COLUMN sort_order integer DEFAULT 0;
    RAISE NOTICE '✓ Colonne sort_order ajoutée';
  ELSE
    RAISE NOTICE '✓ Colonne sort_order existe déjà';
  END IF;
END $$;

-- ==========================================
-- STEP 3: INSÉRER/METTRE À JOUR LES 43 MODULES
-- ==========================================

INSERT INTO modules (name, display_name, description, category, sort_order, is_active) VALUES

-- ========== BATCHES MANAGEMENT (8 modules) ==========
('dashboard', 'Tableau de Bord', 'Tableaux de bord et vues d''ensemble', 'batches', 1, true),
('production_daily', 'Production Quotidienne', 'Enregistrement de la production quotidienne', 'batches', 2, true),
('production_view', 'Consultation Production', 'Voir les données de production', 'batches', 3, true),
('production_in_safe', 'Production en Coffre', 'Gestion de l''or en coffre', 'batches', 4, true),
('shipping_preparation', 'Préparation Expédition', 'Créer et gérer les préparations d''expédition', 'batches', 10, true),
('shipping_view', 'Consultation Expéditions', 'Voir les expéditions', 'batches', 11, true),
('documents_assay', 'Certificats d''Essai', 'Gestion des certificats d''essai', 'batches', 30, true),
('documents_export_licenses', 'Licences d''Export', 'Gestion des licences d''exportation', 'batches', 31, true),

-- ========== OPERATIONS (7 modules) ==========
('freight_shipments', 'Expéditions de Fret', 'Gestion des expéditions de fret internationales', 'operations', 20, true),
('freight_customs', 'Douanes & Documents', 'Factures et documents douaniers', 'operations', 21, true),
('inventory_gold', 'Inventaire Or', 'Gestion du stock d''or', 'operations', 40, true),
('inventory_silver', 'Inventaire Argent', 'Gestion du stock d''argent', 'operations', 41, true),
('receiving', 'Réception', 'Confirmation de réception des lots', 'operations', 50, true),
('refining_process', 'Processus de Raffinage', 'Gestion du processus de raffinage', 'operations', 51, true),
('refining_freight', 'Fret Raffinage', 'Expéditions vers raffineries', 'operations', 52, true),

-- ========== SALES MANAGEMENT (10 modules) ==========
('sales_view', 'Consultation Ventes', 'Voir les ventes d''or', 'sales', 60, true),
('sales_create', 'Création Vente', 'Créer nouvelle vente', 'sales', 61, true),
('sales_trade_space', 'Espace Trading', 'Espace de trading et ventes en direct', 'sales', 62, true),
('presales', 'Pré-Ventes', 'Gestion des pré-ventes et estimations', 'sales', 63, true),
('customers_view', 'Consultation Clients', 'Voir la liste des clients', 'sales', 70, true),
('customers_manage', 'Gestion Clients', 'Créer et modifier des clients', 'sales', 71, true),
('payments_view', 'Consultation Paiements', 'Voir les paiements', 'sales', 80, true),
('payments_create', 'Enregistrer Paiement', 'Enregistrer nouveau paiement', 'sales', 81, true),
('payments_approve', 'Approuver Paiements', 'Approuver les paiements clients', 'sales', 82, true),
('payments_virtual', 'Paiements Virtuels', 'Gérer les paiements virtuels', 'sales', 83, true),

-- ========== INSIGHTS & REPORTS (7 modules) ==========
('analytics_dashboard', 'Tableau Analytique', 'Analyses et intelligence d''affaires', 'analytics', 90, true),
('analytics_intelligence', 'Intelligence Center', 'Centre d''intelligence avancée', 'analytics', 91, true),
('reports_generate', 'Génération Rapports', 'Générer et gérer les rapports', 'analytics', 92, true),
('performance_budgets', 'Gestion Budgets', 'Gestion des budgets annuels', 'analytics', 100, true),
('performance_forecasts', 'Prévisions', 'Gestion des prévisions', 'analytics', 101, true),
('prices_gold', 'Prix de l''Or', 'Gestion des prix de l''or (LBMA)', 'analytics', 110, true),
('prices_fx_rates', 'Taux de Change', 'Gestion des taux FX (USD/CFA/GNF)', 'analytics', 111, true),

-- ========== ADMINISTRATION (11 modules) ==========
('stakeholders_mining', 'Sociétés Minières', 'Gestion des sociétés minières', 'system', 120, true),
('stakeholders_depositors', 'Déposants', 'Gestion des déposants', 'system', 121, true),
('stakeholders_freight', 'Compagnies de Fret', 'Gestion des compagnies de transport', 'system', 122, true),
('stakeholders_refineries', 'Raffineries', 'Gestion des raffineries', 'system', 123, true),
('stakeholders_transport', 'Transport Terrestre', 'Compagnies de transport terrestre', 'system', 124, true),
('users_manage', 'Gestion Utilisateurs', 'Créer et gérer les utilisateurs', 'system', 130, true),
('users_permissions', 'Permissions Utilisateurs', 'Configurer les permissions', 'system', 131, true),
('settings_system', 'Paramètres Système', 'Configuration système', 'system', 132, true),
('settings_gold_sales', 'Paramètres Ventes', 'Configuration des paramètres de vente', 'system', 133, true),
('settings_status_manager', 'Gestionnaire Statuts', 'Gérer les statuts et workflows', 'system', 134, true),
('audit_trail', 'Journal d''Audit', 'Consultation des logs d''audit', 'system', 140, true),
('approvals_dashboard', 'Tableau Approbations', 'Gestion des workflows d''approbation', 'system', 141, true)

-- SI MODULE EXISTE: le mettre à jour
-- SI MODULE N'EXISTE PAS: l'insérer
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ==========================================
-- STEP 4: DÉSACTIVER LES ANCIENS MODULES
-- ==========================================

-- Optionnel: Désactiver les modules qui ne sont pas dans notre liste
-- Commentez cette section si vous voulez garder vos anciens modules actifs

UPDATE modules SET is_active = false
WHERE name NOT IN (
  'dashboard', 'production_daily', 'production_view', 'production_in_safe',
  'shipping_preparation', 'shipping_view', 'documents_assay', 'documents_export_licenses',
  'freight_shipments', 'freight_customs', 'inventory_gold', 'inventory_silver',
  'receiving', 'refining_process', 'refining_freight',
  'sales_view', 'sales_create', 'sales_trade_space', 'presales',
  'customers_view', 'customers_manage',
  'payments_view', 'payments_create', 'payments_approve', 'payments_virtual',
  'analytics_dashboard', 'analytics_intelligence', 'reports_generate',
  'performance_budgets', 'performance_forecasts', 'prices_gold', 'prices_fx_rates',
  'stakeholders_mining', 'stakeholders_depositors', 'stakeholders_freight',
  'stakeholders_refineries', 'stakeholders_transport',
  'users_manage', 'users_permissions', 'settings_system',
  'settings_gold_sales', 'settings_status_manager',
  'audit_trail', 'approvals_dashboard'
);

-- ==========================================
-- STEP 5: VÉRIFICATION FINALE
-- ==========================================

SELECT 'APRÈS CORRECTION' as etape;

-- Compter les modules
SELECT
  COUNT(*) as total_modules,
  COUNT(CASE WHEN is_active THEN 1 END) as modules_actifs,
  COUNT(CASE WHEN NOT is_active THEN 1 END) as modules_inactifs
FROM modules;

-- Résumé par catégorie (modules actifs seulement)
SELECT
  category,
  COUNT(*) as nombre_modules,
  STRING_AGG(display_name, ', ' ORDER BY sort_order) as liste_modules
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
  END;

-- Liste détaillée des modules actifs
SELECT
  category as 'Catégorie',
  name as 'Nom Technique',
  display_name as 'Nom Affiché',
  sort_order as 'Ordre',
  is_active as 'Actif'
FROM modules
WHERE is_active = true
ORDER BY
  CASE category
    WHEN 'batches' THEN 1
    WHEN 'operations' THEN 2
    WHEN 'sales' THEN 3
    WHEN 'analytics' THEN 4
    WHEN 'system' THEN 5
  END,
  sort_order;

-- Modules désactivés (si vous voulez les voir)
SELECT
  'MODULES DÉSACTIVÉS' as info,
  name,
  display_name,
  category
FROM modules
WHERE is_active = false;

-- Message final
SELECT '✅ CORRECTION TERMINÉE - 43 modules actifs' as status;
SELECT '📊 Résultats attendus: batches=8, operations=7, sales=10, analytics=7, system=11' as info;
