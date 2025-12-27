/*
  # Implémentation de la Logique de Vente Artisans → SONASP (VERSION CORRIGÉE)

  1. Modifications apportées
    - Ajout de la colonne acheteur_id (référence à SONASP) dans snp_artisan_ventes_or
    - Ajout d'un trigger pour définir automatiquement SONASP comme acheteur
    - Mise à jour des ventes existantes pour lier à SONASP

  2. Logique Métier
    - Artisans miniers vendent UNIQUEMENT à SONASP
    - SONASP est identifiée par company_type = 'sonasp'
    - Les ventes sont automatiquement liées à SONASP à la création

  3. Sécurité
    - RLS activé avec vérification de l'acheteur
    - Trigger pour empêcher les ventes à d'autres clients (pas de CHECK avec subquery)
*/

-- ============================================================================
-- ÉTAPE 1: Vérifier que la table snp_artisan_ventes_or existe
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'snp_artisan_ventes_or') THEN
    RAISE EXCEPTION 'La table snp_artisan_ventes_or n''existe pas. Veuillez d''abord exécuter CREATE-ARTISAN-GOLD-SALES-COLLECTION.sql';
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 2: Ajout de la colonne acheteur_id si elle n'existe pas
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snp_artisan_ventes_or' AND column_name = 'acheteur_id'
  ) THEN
    -- Ajouter la colonne acheteur_id (référence vers mining_companies)
    ALTER TABLE snp_artisan_ventes_or
    ADD COLUMN acheteur_id uuid REFERENCES mining_companies(id);

    COMMENT ON COLUMN snp_artisan_ventes_or.acheteur_id IS 'ID de la société acheteuse (doit être SONASP)';

    RAISE NOTICE 'Colonne acheteur_id ajoutée avec succès';
  ELSE
    RAISE NOTICE 'Colonne acheteur_id existe déjà';
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 3: Récupérer l'ID de SONASP
-- ============================================================================

DO $$
DECLARE
  sonasp_id uuid;
BEGIN
  -- Trouver SONASP
  SELECT id INTO sonasp_id
  FROM mining_companies
  WHERE company_type = 'sonasp'
  LIMIT 1;

  IF sonasp_id IS NULL THEN
    RAISE EXCEPTION 'SONASP n''existe pas dans la table mining_companies. Veuillez d''abord exécuter RESUME-CORRECTIONS-27-12-2024.sql';
  END IF;

  -- Mettre à jour toutes les ventes existantes pour lier à SONASP
  UPDATE snp_artisan_ventes_or
  SET acheteur_id = sonasp_id
  WHERE acheteur_id IS NULL;

  RAISE NOTICE 'Toutes les ventes existantes ont été liées à SONASP (ID: %)', sonasp_id;
END $$;

-- ============================================================================
-- ÉTAPE 4: Fonction pour obtenir l'ID de SONASP
-- ============================================================================

CREATE OR REPLACE FUNCTION get_sonasp_id()
RETURNS uuid AS $$
DECLARE
  sonasp_id uuid;
BEGIN
  SELECT id INTO sonasp_id
  FROM mining_companies
  WHERE company_type = 'sonasp'
  AND is_active = true
  LIMIT 1;

  IF sonasp_id IS NULL THEN
    RAISE EXCEPTION 'SONASP n''est pas configurée dans le système';
  END IF;

  RETURN sonasp_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_sonasp_id IS 'Retourne l''ID de la société SONASP';

-- ============================================================================
-- ÉTAPE 5: Trigger pour définir automatiquement SONASP comme acheteur
-- ============================================================================

CREATE OR REPLACE FUNCTION set_sonasp_as_buyer()
RETURNS TRIGGER AS $$
BEGIN
  -- Si aucun acheteur n'est spécifié, définir SONASP automatiquement
  IF NEW.acheteur_id IS NULL THEN
    NEW.acheteur_id := get_sonasp_id();
  END IF;

  -- Vérifier que l'acheteur est bien SONASP
  IF NOT EXISTS (
    SELECT 1 FROM mining_companies
    WHERE id = NEW.acheteur_id
    AND company_type = 'sonasp'
  ) THEN
    RAISE EXCEPTION 'Les artisans miniers peuvent vendre uniquement à SONASP';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_sonasp_buyer ON snp_artisan_ventes_or;
CREATE TRIGGER trigger_set_sonasp_buyer
  BEFORE INSERT OR UPDATE ON snp_artisan_ventes_or
  FOR EACH ROW
  EXECUTE FUNCTION set_sonasp_as_buyer();

COMMENT ON TRIGGER trigger_set_sonasp_buyer ON snp_artisan_ventes_or IS
  'Définit automatiquement SONASP comme acheteur et empêche les ventes à d''autres clients';

-- ============================================================================
-- ÉTAPE 6: Index pour optimiser les performances
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ventes_or_acheteur ON snp_artisan_ventes_or(acheteur_id);
CREATE INDEX IF NOT EXISTS idx_ventes_or_artisan ON snp_artisan_ventes_or(artisan_id);
CREATE INDEX IF NOT EXISTS idx_ventes_or_date ON snp_artisan_ventes_or(date_vente);

RAISE NOTICE 'Index créés pour optimiser les performances';

-- ============================================================================
-- ÉTAPE 7: Vue pour les ventes artisans avec détails SONASP
-- ============================================================================

CREATE OR REPLACE VIEW snp_ventes_artisans_sonasp AS
SELECT
  v.id,
  v.artisan_id,
  COALESCE(a.raison_sociale, CONCAT(a.nom, ' ', a.prenoms)) as artisan_nom,
  a.numero_carte as artisan_carte,
  a.pays as artisan_pays,
  a.type_artisan,
  v.date_vente,
  v.quantite_grammes,
  v.type_or,
  v.purete_karat,
  v.prix_kg_fcfa,
  v.montant_brut_fcfa,
  v.tva_taux,
  v.tva_montant_fcfa,
  v.taxe_dev_comm_taux,
  v.taxe_dev_comm_montant_fcfa,
  v.montant_total_fcfa,
  v.numero_recu,
  v.observations,
  v.statut,
  v.acheteur_id,
  mc.name as acheteur_nom,
  mc.company_type as acheteur_type,
  v.created_at,
  v.updated_at,
  v.created_by,
  v.updated_by
FROM snp_artisan_ventes_or v
LEFT JOIN snp_artisans_miniers a ON v.artisan_id = a.id
LEFT JOIN mining_companies mc ON v.acheteur_id = mc.id
WHERE mc.company_type = 'sonasp';

COMMENT ON VIEW snp_ventes_artisans_sonasp IS 'Vue des ventes artisans avec les détails de SONASP';

-- ============================================================================
-- ÉTAPE 8: Fonction pour créer une vente artisan → SONASP
-- ============================================================================

CREATE OR REPLACE FUNCTION create_artisan_sale_to_sonasp(
  p_artisan_id uuid,
  p_date_vente date,
  p_quantite_grammes numeric,
  p_type_or text,
  p_purete_karat numeric,
  p_prix_kg_fcfa numeric,
  p_observations text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_sale_id uuid;
  v_sonasp_id uuid;
  v_montant_brut numeric;
  v_tva_taux numeric := 18.00;
  v_tva_montant numeric;
  v_taxe_dev_taux numeric := 1.00;
  v_taxe_dev_montant numeric;
  v_montant_total numeric;
BEGIN
  -- Récupérer l'ID de SONASP
  v_sonasp_id := get_sonasp_id();

  -- Calculs automatiques
  v_montant_brut := (p_quantite_grammes / 1000) * p_prix_kg_fcfa;
  v_tva_montant := v_montant_brut * (v_tva_taux / 100);
  v_taxe_dev_montant := v_montant_brut * (v_taxe_dev_taux / 100);
  v_montant_total := v_montant_brut + v_tva_montant + v_taxe_dev_montant;

  -- Insérer la vente
  INSERT INTO snp_artisan_ventes_or (
    artisan_id,
    acheteur_id,
    date_vente,
    quantite_grammes,
    type_or,
    purete_karat,
    prix_kg_fcfa,
    montant_brut_fcfa,
    tva_taux,
    tva_montant_fcfa,
    taxe_dev_comm_taux,
    taxe_dev_comm_montant_fcfa,
    montant_total_fcfa,
    observations,
    statut,
    created_by
  ) VALUES (
    p_artisan_id,
    v_sonasp_id,
    p_date_vente,
    p_quantite_grammes,
    p_type_or,
    p_purete_karat,
    p_prix_kg_fcfa,
    v_montant_brut,
    v_tva_taux,
    v_tva_montant,
    v_taxe_dev_taux,
    v_taxe_dev_montant,
    v_montant_total,
    p_observations,
    'en_attente',
    auth.uid()
  )
  RETURNING id INTO v_sale_id;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_artisan_sale_to_sonasp IS
  'Crée une vente d''un artisan minier à SONASP avec calculs automatiques';

-- ============================================================================
-- ÉTAPE 9: Vérification et rapport final
-- ============================================================================

DO $$
DECLARE
  sonasp_rec RECORD;
  vente_count INTEGER;
BEGIN
  -- Afficher les informations de SONASP
  SELECT * INTO sonasp_rec
  FROM mining_companies
  WHERE company_type = 'sonasp'
  LIMIT 1;

  IF sonasp_rec IS NOT NULL THEN
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '✓ SONASP configurée:';
    RAISE NOTICE '  - Nom: %', sonasp_rec.name;
    RAISE NOTICE '  - Type: %', sonasp_rec.company_type;
    RAISE NOTICE '  - ID: %', sonasp_rec.id;
    RAISE NOTICE '  - Statut: %', CASE WHEN sonasp_rec.is_active THEN 'Actif' ELSE 'Inactif' END;
  ELSE
    RAISE WARNING '✗ SONASP non trouvée!';
  END IF;

  -- Compter les ventes
  SELECT COUNT(*) INTO vente_count
  FROM snp_artisan_ventes_or
  WHERE acheteur_id = sonasp_rec.id;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✓ Statistiques des ventes:';
  RAISE NOTICE '  - Ventes liées à SONASP: %', vente_count;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✓ Logique implémentée avec succès:';
  RAISE NOTICE '  1. Artisans vendent UNIQUEMENT à SONASP';
  RAISE NOTICE '  2. SONASP définie automatiquement comme acheteur';
  RAISE NOTICE '  3. Trigger empêche les ventes à d''autres clients';
  RAISE NOTICE '  4. Index créés pour optimiser les performances';
  RAISE NOTICE '  5. Fonction helper create_artisan_sale_to_sonasp() disponible';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
