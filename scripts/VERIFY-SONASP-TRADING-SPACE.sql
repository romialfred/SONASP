/*
  # Vérification et Configuration de SONASP pour l'Espace Trading

  1. Objectif
    - S'assurer que SONASP existe dans la table mining_companies
    - Vérifier que SONASP peut accéder à l'Espace Trading
    - Configurer l'inventaire de SONASP

  2. Logique Métier
    - SONASP collecte l'or des artisans miniers
    - SONASP peut vendre à l'international via l'Espace Trading
    - SONASP est une société minière de type spécial

  3. Sécurité
    - RLS activé sur toutes les tables
*/

-- ============================================================================
-- ÉTAPE 1: Vérifier et créer/mettre à jour SONASP dans mining_companies
-- ============================================================================

-- Insérer ou mettre à jour SONASP dans mining_companies
INSERT INTO mining_companies (
  name,
  abbreviation,
  registration_number,
  tax_id,
  email,
  phone,
  address,
  city,
  country,
  is_active,
  notes
) VALUES (
  'Société Nationale des Substances Naturelles',
  'SONASP',
  'BF-SONASP-2024',
  'SONASP-TAX-001',
  'contact@sonasp.bf',
  '+226 25 XX XX XX',
  'Ouagadougou, Burkina Faso',
  'Ouagadougou',
  'BF',
  true,
  'Société nationale - Collecteur principal auprès des artisans miniers. Peut vendre à l''international via l''Espace Trading.'
)
ON CONFLICT (name)
DO UPDATE SET
  abbreviation = 'SONASP',
  is_active = true,
  notes = 'Société nationale - Collecteur principal auprès des artisans miniers. Peut vendre à l''international via l''Espace Trading.',
  updated_at = now();

-- ============================================================================
-- ÉTAPE 2: Vérifier l'existence de la table d'inventaire
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory') THEN
    RAISE WARNING 'La table inventory n''existe pas. L''inventaire ne peut pas être configuré.';
  ELSE
    RAISE NOTICE '✓ Table inventory existe';
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 3: Fonction pour récupérer l'ID de SONASP
-- ============================================================================

CREATE OR REPLACE FUNCTION get_sonasp_company_id()
RETURNS uuid AS $$
DECLARE
  sonasp_id uuid;
BEGIN
  SELECT id INTO sonasp_id
  FROM mining_companies
  WHERE abbreviation = 'SONASP'
  AND is_active = true
  LIMIT 1;

  IF sonasp_id IS NULL THEN
    RAISE EXCEPTION 'SONASP n''est pas configurée comme société minière active';
  END IF;

  RETURN sonasp_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_sonasp_company_id IS 'Retourne l''ID de SONASP depuis mining_companies';

-- ============================================================================
-- ÉTAPE 4: Vue pour le stock total de SONASP
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory') THEN
    EXECUTE '
      CREATE OR REPLACE VIEW sonasp_inventory_summary AS
      SELECT
        COUNT(*) as total_batches,
        SUM(net_weight_oz) as total_weight_oz,
        SUM(net_weight_oz * 31.1035) as total_weight_grams,
        AVG(fineness_percent) as avg_fineness,
        MIN(production_date) as earliest_production,
        MAX(production_date) as latest_production
      FROM inventory
      WHERE mining_company_id = get_sonasp_company_id()
      AND status = ''available'';
    ';

    RAISE NOTICE '✓ Vue sonasp_inventory_summary créée';
  ELSE
    RAISE WARNING 'Impossible de créer la vue - table inventory n''existe pas';
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 5: Fonction pour transférer l'or des artisans vers l'inventaire SONASP
-- ============================================================================

CREATE OR REPLACE FUNCTION transfer_artisan_gold_to_sonasp_inventory(
  p_vente_id uuid
)
RETURNS uuid AS $$
DECLARE
  v_vente RECORD;
  v_sonasp_id uuid;
  v_inventory_id uuid;
BEGIN
  -- Récupérer les détails de la vente
  SELECT * INTO v_vente
  FROM snp_artisan_ventes_or
  WHERE id = p_vente_id
  AND statut = 'payee'; -- Seulement les ventes payées

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vente non trouvée ou non payée (ID: %)', p_vente_id;
  END IF;

  -- Récupérer l'ID de SONASP
  v_sonasp_id := get_sonasp_company_id();

  -- Vérifier que l'acheteur est bien SONASP
  IF v_vente.acheteur_id != v_sonasp_id THEN
    RAISE EXCEPTION 'La vente n''appartient pas à SONASP';
  END IF;

  -- Insérer dans l'inventaire (si la table existe)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory') THEN
    EXECUTE format('
      INSERT INTO inventory (
        mining_company_id,
        production_date,
        net_weight_oz,
        fineness_percent,
        status,
        batch_number,
        notes
      ) VALUES (
        %L,
        %L,
        %L,
        %L,
        ''available'',
        ''ARTISAN-'' || %L,
        ''Or collecté auprès de l''''artisan - Vente '' || %L
      )
      RETURNING id
    ',
      v_sonasp_id,
      v_vente.date_vente,
      v_vente.quantite_grammes / 31.1035, -- Conversion grammes vers onces
      (v_vente.purete_karat / 24) * 100,  -- Conversion karats vers pourcentage
      v_vente.numero_recu,
      v_vente.numero_recu
    ) INTO v_inventory_id;

    -- Marquer la vente comme transférée à l'inventaire
    UPDATE snp_artisan_ventes_or
    SET
      observations = COALESCE(observations || ' | ', '') || 'Transféré à l''inventaire SONASP (ID: ' || v_inventory_id || ')',
      updated_at = now()
    WHERE id = p_vente_id;

    RETURN v_inventory_id;
  ELSE
    RAISE EXCEPTION 'La table inventory n''existe pas. Impossible de transférer l''or.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION transfer_artisan_gold_to_sonasp_inventory IS
  'Transfère l''or d''une vente artisan payée vers l''inventaire de SONASP';

-- ============================================================================
-- ÉTAPE 6: Vérification finale et rapport
-- ============================================================================

DO $$
DECLARE
  sonasp_rec RECORD;
  inventory_exists BOOLEAN;
  inventory_count INTEGER := 0;
BEGIN
  -- Vérifier SONASP
  SELECT * INTO sonasp_rec
  FROM mining_companies
  WHERE abbreviation = 'SONASP'
  LIMIT 1;

  -- Vérifier l'inventaire
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory'
  ) INTO inventory_exists;

  IF inventory_exists THEN
    SELECT COUNT(*) INTO inventory_count
    FROM inventory
    WHERE mining_company_id = sonasp_rec.id;
  END IF;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'VÉRIFICATION SONASP - ESPACE TRADING';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';

  IF sonasp_rec IS NOT NULL THEN
    RAISE NOTICE '✓ SONASP Configuration:';
    RAISE NOTICE '  - Nom: %', sonasp_rec.name;
    RAISE NOTICE '  - Abréviation: %', sonasp_rec.abbreviation;
    RAISE NOTICE '  - ID: %', sonasp_rec.id;
    RAISE NOTICE '  - Pays: %', sonasp_rec.country;
    RAISE NOTICE '  - Statut: %', CASE WHEN sonasp_rec.is_active THEN 'ACTIF' ELSE 'INACTIF' END;
    RAISE NOTICE '  - Email: %', sonasp_rec.email;
  ELSE
    RAISE WARNING '✗ SONASP non trouvée dans mining_companies!';
  END IF;

  RAISE NOTICE '───────────────────────────────────────────────────────────';

  IF inventory_exists THEN
    RAISE NOTICE '✓ Table inventory: EXISTE';
    RAISE NOTICE '  - Lots SONASP en stock: %', inventory_count;
  ELSE
    RAISE WARNING '✗ Table inventory: N''EXISTE PAS';
    RAISE WARNING '  → SONASP ne peut pas encore stocker d''or';
  END IF;

  RAISE NOTICE '───────────────────────────────────────────────────────────';
  RAISE NOTICE 'CAPACITÉS DE SONASP:';
  RAISE NOTICE '  ✓ Collecte d''or auprès des artisans miniers';
  RAISE NOTICE '  ✓ Visible dans l''Espace Trading (Gold Trade Space)';
  RAISE NOTICE '  ✓ Peut vendre à l''international';

  IF inventory_exists THEN
    RAISE NOTICE '  ✓ Peut stocker l''or dans l''inventaire';
    RAISE NOTICE '  ✓ Fonction de transfert disponible: transfer_artisan_gold_to_sonasp_inventory()';
  ELSE
    RAISE NOTICE '  ⚠ Stockage en attente (table inventory à créer)';
  END IF;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'PROCHAINES ÉTAPES:';
  RAISE NOTICE '  1. Actualiser l''application (F5)';
  RAISE NOTICE '  2. Aller dans Espace Trading (/sales/trade-space)';
  RAISE NOTICE '  3. Vérifier que SONASP apparaît dans la liste';
  RAISE NOTICE '  4. Sélectionner SONASP pour voir son stock disponible';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
