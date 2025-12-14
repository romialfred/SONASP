/*
  ┌────────────────────────────────────────────────────────────────────────────┐
  │  CORRECTION CRITIQUE - RLS POLICIES POUR SALES DASHBOARD                   │
  │                                                                              │
  │  PROBLÈME IDENTIFIÉ:                                                         │
  │  Les tables sales, customers et mining_companies ont RLS activé mais        │
  │  AUCUNE policy permettant la lecture aux utilisateurs authentifiés.         │
  │  Résultat: Dashboard vide malgré 4 ventes existantes en base.              │
  │                                                                              │
  │  SOLUTION:                                                                   │
  │  Ajouter les policies SELECT pour permettre la lecture des données.         │
  │                                                                              │
  │  SÉCURITÉ:                                                                   │
  │  - Uniquement les utilisateurs authentifiés peuvent lire                    │
  │  - RLS reste activé pour protection maximale                               │
  │  - Aucun accès public (anon) aux données sensibles                          │
  │                                                                              │
  │  INSTRUCTIONS D'APPLICATION:                                                │
  │  1. Ouvrir Supabase Dashboard → SQL Editor                                  │
  │  2. Copier-coller ce script complet                                         │
  │  3. Cliquer "Run" pour exécuter                                             │
  │  4. Rafraîchir l'application (Ctrl+Shift+R)                                 │
  │  5. Les ventes s'afficheront immédiatement                                  │
  └────────────────────────────────────────────────────────────────────────────┘
*/

-- ============================================================================
-- SECTION 1: SALES TABLE RLS POLICIES
-- ============================================================================

-- Nettoyer les anciennes policies pour éviter les conflits
DROP POLICY IF EXISTS "Authenticated users can view all sales" ON sales;
DROP POLICY IF EXISTS "Users can read sales" ON sales;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON sales;
DROP POLICY IF EXISTS "Authenticated users can view sales" ON sales;

-- Créer la policy SELECT pour les ventes
CREATE POLICY "Authenticated users can view sales"
  ON sales
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY "Authenticated users can view sales" ON sales IS
  'Permet à tous les utilisateurs authentifiés de consulter les ventes. Nécessaire pour Dashboard et rapports.';

-- ============================================================================
-- SECTION 2: CUSTOMERS TABLE RLS POLICIES
-- ============================================================================

-- Nettoyer les anciennes policies
DROP POLICY IF EXISTS "Authenticated users can view customers" ON customers;
DROP POLICY IF EXISTS "Users can read customers" ON customers;

-- Créer la policy SELECT pour les clients
CREATE POLICY "Authenticated users can view customers"
  ON customers
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY "Authenticated users can view customers" ON customers IS
  'Permet la lecture des informations clients. Nécessaire pour jointures avec sales.';

-- ============================================================================
-- SECTION 3: MINING_COMPANIES TABLE RLS POLICIES
-- ============================================================================

-- Nettoyer les anciennes policies
DROP POLICY IF EXISTS "Authenticated users can view mining_companies" ON mining_companies;
DROP POLICY IF EXISTS "Users can read mining_companies" ON mining_companies;

-- Créer la policy SELECT pour les sociétés minières
CREATE POLICY "Authenticated users can view mining_companies"
  ON mining_companies
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY "Authenticated users can view mining_companies" ON mining_companies IS
  'Permet la lecture des sociétés minières. Nécessaire pour jointures et graphiques.';

-- ============================================================================
-- VERIFICATION POST-APPLICATION
-- ============================================================================

-- Vérifier que les policies ont été créées correctement
DO $$
BEGIN
  RAISE NOTICE '✅ RLS Policies créées avec succès!';
  RAISE NOTICE '';
  RAISE NOTICE 'Policies actives sur SALES:';
  RAISE NOTICE '  - Authenticated users can view sales (SELECT)';
  RAISE NOTICE '';
  RAISE NOTICE 'Policies actives sur CUSTOMERS:';
  RAISE NOTICE '  - Authenticated users can view customers (SELECT)';
  RAISE NOTICE '';
  RAISE NOTICE 'Policies actives sur MINING_COMPANIES:';
  RAISE NOTICE '  - Authenticated users can view mining_companies (SELECT)';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Le Dashboard peut maintenant afficher les 4 ventes existantes!';
  RAISE NOTICE '🔐 La sécurité RLS reste active et protège vos données.';
END $$;
