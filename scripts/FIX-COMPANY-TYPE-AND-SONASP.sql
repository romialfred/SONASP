/*
  # Correction: Ajout de company_type et configuration SONASP

  Ce script s'adapte à la structure RÉELLE de mining_companies:
  - contact_person_email (au lieu de email)
  - contact_person_phone (au lieu de phone)
  - Ajout de company_type

  1. Modifications apportées
    - Ajout de la colonne company_type si manquante
    - Configuration de SONASP avec company_type = 'sonasp'
    - Implémentation de la logique de vente Artisans → SONASP

  2. Sécurité
    - Vérifications IF EXISTS pour éviter les erreurs
    - Préservation des données existantes
*/

-- ============================================================================
-- ÉTAPE 1: Ajouter la colonne company_type si elle n'existe pas
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mining_companies' AND column_name = 'company_type'
  ) THEN
    -- Ajouter la colonne
    ALTER TABLE mining_companies
    ADD COLUMN company_type text DEFAULT 'standard' CHECK (company_type IN ('standard', 'sonasp', 'international'));

    -- Créer l'index
    CREATE INDEX IF NOT EXISTS idx_mining_companies_type ON mining_companies(company_type);

    RAISE NOTICE '✓ Colonne company_type ajoutée avec succès';
  ELSE
    RAISE NOTICE '✓ Colonne company_type existe déjà';
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 2: Mettre à jour SONASP avec le bon company_type
-- ============================================================================

DO $$
DECLARE
  sonasp_count INTEGER;
BEGIN
  -- Vérifier si SONASP existe
  SELECT COUNT(*) INTO sonasp_count
  FROM mining_companies
  WHERE name LIKE '%SONASP%' OR abbreviation = 'SONASP' OR code LIKE '%SONASP%';

  IF sonasp_count > 0 THEN
    -- Mettre à jour SONASP existante
    UPDATE mining_companies
    SET
      company_type = 'sonasp',
      abbreviation = 'SONASP',
      is_active = true,
      updated_at = now()
    WHERE name LIKE '%SONASP%' OR abbreviation = 'SONASP' OR code LIKE '%SONASP%';

    RAISE NOTICE '✓ SONASP mise à jour avec company_type = sonasp';
  ELSE
    -- Créer SONASP si elle n'existe pas
    INSERT INTO mining_companies (
      name,
      abbreviation,
      code,
      company_type,
      registration_number,
      tax_id,
      contact_person_email,
      contact_person_phone,
      contact_person_name,
      address,
      city,
      country,
      is_active,
      notes
    ) VALUES (
      'Société Nationale des Substances Naturelles',
      'SONASP',
      'SONASP-BF-001',
      'sonasp',
      'BF-SONASP-2024',
      'SONASP-TAX-001',
      'contact@sonasp.bf',
      '+226 25 XX XX XX',
      'Direction Générale',
      'Ouagadougou, Burkina Faso',
      'Ouagadougou',
      'BF',
      true,
      'Société nationale - Collecteur principal auprès des artisans miniers'
    );

    RAISE NOTICE '✓ SONASP créée avec company_type = sonasp';
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 3: Ajouter la colonne acheteur_id à snp_artisan_ventes_or
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snp_artisan_ventes_or' AND column_name = 'acheteur_id'
  ) THEN
    ALTER TABLE snp_artisan_ventes_or
    ADD COLUMN acheteur_id uuid REFERENCES mining_companies(id);

    COMMENT ON COLUMN snp_artisan_ventes_or.acheteur_id IS 'ID de la société acheteuse (doit être SONASP)';

    RAISE NOTICE '✓ Colonne acheteur_id ajoutée à snp_artisan_ventes_or';
  ELSE
    RAISE NOTICE '✓ Colonne acheteur_id existe déjà';
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 4: Lier toutes les ventes existantes à SONASP
-- ============================================================================

DO $$
DECLARE
  sonasp_id uuid;
  ventes_mises_a_jour INTEGER;
BEGIN
  -- Récupérer l'ID de SONASP
  SELECT id INTO sonasp_id
  FROM mining_companies
  WHERE company_type = 'sonasp'
  LIMIT 1;

  IF sonasp_id IS NULL THEN
    RAISE EXCEPTION 'SONASP introuvable après configuration';
  END IF;

  -- Mettre à jour les ventes sans acheteur
  UPDATE snp_artisan_ventes_or
  SET acheteur_id = sonasp_id
  WHERE acheteur_id IS NULL;

  GET DIAGNOSTICS ventes_mises_a_jour = ROW_COUNT;

  RAISE NOTICE '✓ % ventes liées à SONASP (ID: %)', ventes_mises_a_jour, sonasp_id;
END $$;

-- ============================================================================
-- ÉTAPE 5: Fonction pour obtenir l'ID de SONASP
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
-- ÉTAPE 6: Trigger pour définir automatiquement SONASP comme acheteur
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
-- ÉTAPE 7: Validation (gérée par le trigger)
-- ============================================================================

-- Note: La validation que l'acheteur est SONASP est gérée par le trigger
-- trigger_set_sonasp_buyer qui vérifie automatiquement lors de chaque INSERT/UPDATE
-- PostgreSQL ne permet pas de sous-requêtes dans les contraintes CHECK

DO $$
BEGIN
  RAISE NOTICE '✓ Validation gérée par le trigger trigger_set_sonasp_buyer';
END $$;

-- ============================================================================
-- ÉTAPE 8: Vue pour les ventes artisans avec détails SONASP
-- ============================================================================

CREATE OR REPLACE VIEW snp_ventes_artisans_sonasp AS
SELECT
  v.id,
  v.artisan_id,
  a.nom_complet as artisan_nom,
  a.numero_carte as artisan_carte,
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
-- ÉTAPE 9: Rapport final
-- ============================================================================

DO $$
DECLARE
  sonasp_rec RECORD;
  vente_count INTEGER;
BEGIN
  -- Afficher SONASP
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
  RAISE NOTICE '✓ Statistiques:';
  RAISE NOTICE '  - Ventes liées à SONASP: %', vente_count;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✓ Correction appliquée avec succès!';
  RAISE NOTICE '✓ Vous pouvez maintenant passer au script 3';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
