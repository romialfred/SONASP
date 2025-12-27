-- ============================================================================
-- CORRECTION COMPLÈTE À EXÉCUTER UNE SEULE FOIS
-- ============================================================================
--
-- OÙ EXÉCUTER CE SCRIPT:
-- 1. Allez sur https://supabase.com/dashboard
-- 2. Sélectionnez votre projet
-- 3. Cliquez sur "SQL Editor" dans le menu latéral
-- 4. Cliquez sur "+ New query"
-- 5. Copiez-collez TOUT ce fichier
-- 6. Cliquez sur "Run" (ou Ctrl+Enter)
--
-- Ce script fait TOUT automatiquement:
-- - Ajoute company_type à mining_companies
-- - Configure SONASP
-- - Ajoute acheteur_id à snp_artisan_ventes_or
-- - Crée les triggers automatiques
-- - Lie les ventes existantes à SONASP
--
-- ============================================================================

-- ÉTAPE 1: Ajouter company_type
ALTER TABLE mining_companies
ADD COLUMN IF NOT EXISTS company_type text DEFAULT 'standard'
CHECK (company_type IN ('standard', 'sonasp', 'international'));

CREATE INDEX IF NOT EXISTS idx_mining_companies_type ON mining_companies(company_type);

-- ÉTAPE 2: Configurer SONASP
DO $$
DECLARE
  sonasp_id uuid;
BEGIN
  SELECT id INTO sonasp_id
  FROM mining_companies
  WHERE name ILIKE '%SONASP%' OR abbreviation = 'SONASP'
  LIMIT 1;

  IF sonasp_id IS NOT NULL THEN
    UPDATE mining_companies
    SET company_type = 'sonasp', abbreviation = 'SONASP', is_active = true
    WHERE id = sonasp_id;
    RAISE NOTICE 'SONASP mise à jour (ID: %)', sonasp_id;
  ELSE
    INSERT INTO mining_companies (
      name, abbreviation, code, company_type, registration_number, tax_id,
      contact_person_email, contact_person_phone, contact_person_name,
      address, city, country, is_active, notes
    ) VALUES (
      'Société Nationale des Substances Naturelles', 'SONASP', 'SONASP-BF-001',
      'sonasp', 'BF-SONASP-2024', 'SONASP-TAX-001', 'contact@sonasp.bf',
      '+226 25 XX XX XX', 'Direction Générale', 'Ouagadougou, Burkina Faso',
      'Ouagadougou', 'BF', true,
      'Société nationale - Collecteur principal auprès des artisans miniers'
    ) RETURNING id INTO sonasp_id;
    RAISE NOTICE 'SONASP créée (ID: %)', sonasp_id;
  END IF;
END $$;

-- ÉTAPE 3: Ajouter acheteur_id aux ventes
ALTER TABLE snp_artisan_ventes_or
ADD COLUMN IF NOT EXISTS acheteur_id uuid REFERENCES mining_companies(id);

CREATE INDEX IF NOT EXISTS idx_ventes_or_acheteur ON snp_artisan_ventes_or(acheteur_id);

-- ÉTAPE 4: Lier les ventes existantes à SONASP
UPDATE snp_artisan_ventes_or
SET acheteur_id = (
  SELECT id FROM mining_companies WHERE company_type = 'sonasp' LIMIT 1
)
WHERE acheteur_id IS NULL;

-- ÉTAPE 5: Fonction pour obtenir l'ID de SONASP
CREATE OR REPLACE FUNCTION get_sonasp_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  sonasp_id uuid;
BEGIN
  SELECT id INTO sonasp_id
  FROM mining_companies
  WHERE company_type = 'sonasp' AND is_active = true
  LIMIT 1;

  IF sonasp_id IS NULL THEN
    RAISE EXCEPTION 'SONASP non configurée';
  END IF;

  RETURN sonasp_id;
END;
$$;

-- ÉTAPE 6: Trigger pour définir automatiquement SONASP comme acheteur
CREATE OR REPLACE FUNCTION set_sonasp_as_buyer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.acheteur_id IS NULL THEN
    NEW.acheteur_id := get_sonasp_id();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mining_companies
    WHERE id = NEW.acheteur_id AND company_type = 'sonasp'
  ) THEN
    RAISE EXCEPTION 'Les artisans peuvent vendre uniquement à SONASP';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_sonasp_buyer ON snp_artisan_ventes_or;
CREATE TRIGGER trigger_set_sonasp_buyer
  BEFORE INSERT OR UPDATE ON snp_artisan_ventes_or
  FOR EACH ROW
  EXECUTE FUNCTION set_sonasp_as_buyer();

-- ÉTAPE 7: Vue des ventes artisans avec SONASP
CREATE OR REPLACE VIEW snp_ventes_artisans_sonasp AS
SELECT
  v.id, v.artisan_id,
  COALESCE(a.raison_sociale, CONCAT(a.nom, ' ', a.prenoms)) as artisan_nom,
  a.numero_carte as artisan_carte, a.pays as artisan_pays, a.type_artisan,
  v.date_vente, v.quantite_grammes, v.type_or, v.purete_karat,
  v.prix_kg_fcfa, v.montant_brut_fcfa, v.tva_taux, v.tva_montant_fcfa,
  v.taxe_dev_comm_taux, v.taxe_dev_comm_montant_fcfa, v.montant_total_fcfa,
  v.numero_recu, v.observations, v.statut, v.acheteur_id,
  mc.name as acheteur_nom, mc.company_type as acheteur_type,
  v.created_at, v.updated_at
FROM snp_artisan_ventes_or v
LEFT JOIN snp_artisans_miniers a ON v.artisan_id = a.id
LEFT JOIN mining_companies mc ON v.acheteur_id = mc.id
WHERE mc.company_type = 'sonasp';

-- RAPPORT FINAL
DO $$
DECLARE
  sonasp_rec RECORD;
  vente_count integer;
BEGIN
  SELECT * INTO sonasp_rec FROM mining_companies WHERE company_type = 'sonasp' LIMIT 1;
  SELECT COUNT(*) INTO vente_count FROM snp_artisan_ventes_or WHERE acheteur_id = sonasp_rec.id;

  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'CONFIGURATION TERMINÉE AVEC SUCCÈS!';
  RAISE NOTICE 'SONASP: % (ID: %)', sonasp_rec.name, sonasp_rec.id;
  RAISE NOTICE 'Type: %', sonasp_rec.company_type;
  RAISE NOTICE 'Ventes liées: %', vente_count;
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
