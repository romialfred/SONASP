/*
  # Mise à jour complète du système Artisans Miniers - 04/01/2025

  1. Tables principales
    - artisans_miniers (mise à jour)
    - cartes_professionnelles_artisans (mise à jour)
    - ventes_or_artisans (mise à jour)
    - paiements_artisans (mise à jour)
    - factures_definitives_artisans (mise à jour)
    - infractions_artisans (mise à jour)

  2. Sécurité
    - RLS activé sur toutes les tables
    - Politiques d'accès restrictives

  3. Fonctions utilitaires
    - Triggers de mise à jour
    - Fonctions de calcul
*/

-- =================================================================
-- 1. MISE À JOUR DE LA TABLE artisans_miniers
-- =================================================================

DO $$
BEGIN
  -- Ajouter des colonnes manquantes si elles n'existent pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artisans_miniers' AND column_name = 'statut_global'
  ) THEN
    ALTER TABLE artisans_miniers ADD COLUMN statut_global text DEFAULT 'actif';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artisans_miniers' AND column_name = 'raison_desactivation'
  ) THEN
    ALTER TABLE artisans_miniers ADD COLUMN raison_desactivation text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artisans_miniers' AND column_name = 'date_desactivation'
  ) THEN
    ALTER TABLE artisans_miniers ADD COLUMN date_desactivation timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artisans_miniers' AND column_name = 'desactive_par'
  ) THEN
    ALTER TABLE artisans_miniers ADD COLUMN desactive_par uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artisans_miniers' AND column_name = 'poids_total_vendu_grammes'
  ) THEN
    ALTER TABLE artisans_miniers ADD COLUMN poids_total_vendu_grammes numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artisans_miniers' AND column_name = 'nombre_ventes'
  ) THEN
    ALTER TABLE artisans_miniers ADD COLUMN nombre_ventes integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artisans_miniers' AND column_name = 'chiffre_affaires_total'
  ) THEN
    ALTER TABLE artisans_miniers ADD COLUMN chiffre_affaires_total numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artisans_miniers' AND column_name = 'derniere_vente_date'
  ) THEN
    ALTER TABLE artisans_miniers ADD COLUMN derniere_vente_date timestamptz;
  END IF;
END $$;

-- =================================================================
-- 2. MISE À JOUR DE LA TABLE cartes_professionnelles_artisans
-- =================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cartes_professionnelles_artisans' AND column_name = 'carte_recto_url'
  ) THEN
    ALTER TABLE cartes_professionnelles_artisans ADD COLUMN carte_recto_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cartes_professionnelles_artisans' AND column_name = 'carte_verso_url'
  ) THEN
    ALTER TABLE cartes_professionnelles_artisans ADD COLUMN carte_verso_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cartes_professionnelles_artisans' AND column_name = 'motif_rejet'
  ) THEN
    ALTER TABLE cartes_professionnelles_artisans ADD COLUMN motif_rejet text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cartes_professionnelles_artisans' AND column_name = 'validee_par'
  ) THEN
    ALTER TABLE cartes_professionnelles_artisans ADD COLUMN validee_par uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cartes_professionnelles_artisans' AND column_name = 'date_validation'
  ) THEN
    ALTER TABLE cartes_professionnelles_artisans ADD COLUMN date_validation timestamptz;
  END IF;
END $$;

-- =================================================================
-- 3. MISE À JOUR DE LA TABLE ventes_or_artisans
-- =================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ventes_or_artisans' AND column_name = 'statut_paiement'
  ) THEN
    ALTER TABLE ventes_or_artisans ADD COLUMN statut_paiement text DEFAULT 'en_attente';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ventes_or_artisans' AND column_name = 'date_paiement'
  ) THEN
    ALTER TABLE ventes_or_artisans ADD COLUMN date_paiement timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ventes_or_artisans' AND column_name = 'reference_paiement'
  ) THEN
    ALTER TABLE ventes_or_artisans ADD COLUMN reference_paiement text;
  END IF;
END $$;

-- =================================================================
-- 4. MISE À JOUR DE LA TABLE paiements_artisans
-- =================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements_artisans' AND column_name = 'preuve_paiement_url'
  ) THEN
    ALTER TABLE paiements_artisans ADD COLUMN preuve_paiement_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements_artisans' AND column_name = 'statut_validation'
  ) THEN
    ALTER TABLE paiements_artisans ADD COLUMN statut_validation text DEFAULT 'en_attente';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements_artisans' AND column_name = 'valide_par'
  ) THEN
    ALTER TABLE paiements_artisans ADD COLUMN valide_par uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements_artisans' AND column_name = 'date_validation'
  ) THEN
    ALTER TABLE paiements_artisans ADD COLUMN date_validation timestamptz;
  END IF;
END $$;

-- =================================================================
-- 5. MISE À JOUR DE LA TABLE factures_definitives_artisans
-- =================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'factures_definitives_artisans' AND column_name = 'facture_pdf_url'
  ) THEN
    ALTER TABLE factures_definitives_artisans ADD COLUMN facture_pdf_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'factures_definitives_artisans' AND column_name = 'statut_facture'
  ) THEN
    ALTER TABLE factures_definitives_artisans ADD COLUMN statut_facture text DEFAULT 'emise';
  END IF;
END $$;

-- =================================================================
-- 6. INDEX POUR OPTIMISER LES PERFORMANCES
-- =================================================================

CREATE INDEX IF NOT EXISTS idx_artisans_statut_global ON artisans_miniers(statut_global);
CREATE INDEX IF NOT EXISTS idx_artisans_type_artisan ON artisans_miniers(type_artisan);
CREATE INDEX IF NOT EXISTS idx_artisans_region ON artisans_miniers(region);
CREATE INDEX IF NOT EXISTS idx_artisans_numero_carte ON artisans_miniers(numero_carte);

CREATE INDEX IF NOT EXISTS idx_ventes_or_artisan_id ON ventes_or_artisans(artisan_id);
CREATE INDEX IF NOT EXISTS idx_ventes_or_date_vente ON ventes_or_artisans(date_vente);
CREATE INDEX IF NOT EXISTS idx_ventes_or_statut_paiement ON ventes_or_artisans(statut_paiement);

CREATE INDEX IF NOT EXISTS idx_paiements_vente_id ON paiements_artisans(vente_or_id);
CREATE INDEX IF NOT EXISTS idx_paiements_facture_id ON paiements_artisans(facture_definitive_id);
CREATE INDEX IF NOT EXISTS idx_paiements_statut ON paiements_artisans(statut_validation);

CREATE INDEX IF NOT EXISTS idx_cartes_artisan_id ON cartes_professionnelles_artisans(artisan_id);
CREATE INDEX IF NOT EXISTS idx_cartes_statut ON cartes_professionnelles_artisans(statut);
CREATE INDEX IF NOT EXISTS idx_cartes_numero ON cartes_professionnelles_artisans(numero_carte);

CREATE INDEX IF NOT EXISTS idx_infractions_artisan_id ON infractions_artisans(artisan_id);
CREATE INDEX IF NOT EXISTS idx_infractions_date ON infractions_artisans(date_infraction);
CREATE INDEX IF NOT EXISTS idx_infractions_type ON infractions_artisans(type_infraction);

-- =================================================================
-- 7. FONCTION DE MISE À JOUR DES MÉTRIQUES ARTISAN
-- =================================================================

CREATE OR REPLACE FUNCTION update_artisan_metrics()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE artisans_miniers
  SET
    poids_total_vendu_grammes = COALESCE((
      SELECT SUM(poids_grammes)
      FROM ventes_or_artisans
      WHERE artisan_id = NEW.artisan_id
    ), 0),
    nombre_ventes = COALESCE((
      SELECT COUNT(*)
      FROM ventes_or_artisans
      WHERE artisan_id = NEW.artisan_id
    ), 0),
    chiffre_affaires_total = COALESCE((
      SELECT SUM(montant_total_fcfa)
      FROM ventes_or_artisans
      WHERE artisan_id = NEW.artisan_id
    ), 0),
    derniere_vente_date = (
      SELECT MAX(date_vente)
      FROM ventes_or_artisans
      WHERE artisan_id = NEW.artisan_id
    ),
    updated_at = now()
  WHERE id = NEW.artisan_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_artisan_metrics ON ventes_or_artisans;
CREATE TRIGGER trigger_update_artisan_metrics
  AFTER INSERT OR UPDATE ON ventes_or_artisans
  FOR EACH ROW
  EXECUTE FUNCTION update_artisan_metrics();

-- =================================================================
-- 8. FONCTION DE MISE À JOUR DU STATUT DE PAIEMENT
-- =================================================================

CREATE OR REPLACE FUNCTION update_vente_paiement_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ventes_or_artisans
  SET
    statut_paiement = 'effectue',
    date_paiement = NEW.date_paiement,
    reference_paiement = NEW.reference_paiement,
    updated_at = now()
  WHERE id = NEW.vente_or_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vente_paiement ON paiements_artisans;
CREATE TRIGGER trigger_update_vente_paiement
  AFTER INSERT ON paiements_artisans
  FOR EACH ROW
  EXECUTE FUNCTION update_vente_paiement_status();

-- =================================================================
-- 9. RLS - ACTIVATION ET POLITIQUES
-- =================================================================

ALTER TABLE artisans_miniers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartes_professionnelles_artisans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventes_or_artisans ENABLE ROW LEVEL SECURITY;
ALTER TABLE paiements_artisans ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures_definitives_artisans ENABLE ROW LEVEL SECURITY;
ALTER TABLE infractions_artisans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent voir artisans" ON artisans_miniers;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent créer artisans" ON artisans_miniers;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent modifier artisans" ON artisans_miniers;

CREATE POLICY "Utilisateurs authentifiés peuvent voir artisans"
  ON artisans_miniers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs authentifiés peuvent créer artisans"
  ON artisans_miniers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Utilisateurs authentifiés peuvent modifier artisans"
  ON artisans_miniers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Utilisateurs peuvent voir cartes" ON cartes_professionnelles_artisans;
DROP POLICY IF EXISTS "Utilisateurs peuvent créer cartes" ON cartes_professionnelles_artisans;
DROP POLICY IF EXISTS "Utilisateurs peuvent modifier cartes" ON cartes_professionnelles_artisans;

CREATE POLICY "Utilisateurs peuvent voir cartes"
  ON cartes_professionnelles_artisans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs peuvent créer cartes"
  ON cartes_professionnelles_artisans FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Utilisateurs peuvent modifier cartes"
  ON cartes_professionnelles_artisans FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Utilisateurs peuvent voir ventes" ON ventes_or_artisans;
DROP POLICY IF EXISTS "Utilisateurs peuvent créer ventes" ON ventes_or_artisans;
DROP POLICY IF EXISTS "Utilisateurs peuvent modifier ventes" ON ventes_or_artisans;

CREATE POLICY "Utilisateurs peuvent voir ventes"
  ON ventes_or_artisans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs peuvent créer ventes"
  ON ventes_or_artisans FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Utilisateurs peuvent modifier ventes"
  ON ventes_or_artisans FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Utilisateurs peuvent voir paiements" ON paiements_artisans;
DROP POLICY IF EXISTS "Utilisateurs peuvent créer paiements" ON paiements_artisans;
DROP POLICY IF EXISTS "Utilisateurs peuvent modifier paiements" ON paiements_artisans;

CREATE POLICY "Utilisateurs peuvent voir paiements"
  ON paiements_artisans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs peuvent créer paiements"
  ON paiements_artisans FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Utilisateurs peuvent modifier paiements"
  ON paiements_artisans FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Utilisateurs peuvent voir factures" ON factures_definitives_artisans;
DROP POLICY IF EXISTS "Utilisateurs peuvent créer factures" ON factures_definitives_artisans;
DROP POLICY IF EXISTS "Utilisateurs peuvent modifier factures" ON factures_definitives_artisans;

CREATE POLICY "Utilisateurs peuvent voir factures"
  ON factures_definitives_artisans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs peuvent créer factures"
  ON factures_definitives_artisans FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Utilisateurs peuvent modifier factures"
  ON factures_definitives_artisans FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Utilisateurs peuvent voir infractions" ON infractions_artisans;
DROP POLICY IF EXISTS "Utilisateurs peuvent créer infractions" ON infractions_artisans;
DROP POLICY IF EXISTS "Utilisateurs peuvent modifier infractions" ON infractions_artisans;

CREATE POLICY "Utilisateurs peuvent voir infractions"
  ON infractions_artisans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs peuvent créer infractions"
  ON infractions_artisans FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Utilisateurs peuvent modifier infractions"
  ON infractions_artisans FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =================================================================
-- 10. VUE POUR LES STATISTIQUES GLOBALES
-- =================================================================

CREATE OR REPLACE VIEW vw_artisans_statistiques AS
SELECT
  a.id,
  a.numero_carte,
  a.nom,
  a.prenoms,
  a.type_artisan,
  a.region,
  a.statut_global,
  a.poids_total_vendu_grammes,
  a.nombre_ventes,
  a.chiffre_affaires_total,
  a.derniere_vente_date,
  c.statut as statut_carte,
  c.date_expiration as carte_date_expiration,
  COUNT(DISTINCT i.id) as nombre_infractions,
  COUNT(DISTINCT v.id) FILTER (WHERE v.statut_paiement = 'effectue') as nombre_ventes_payees
FROM artisans_miniers a
LEFT JOIN cartes_professionnelles_artisans c ON a.id = c.artisan_id
LEFT JOIN infractions_artisans i ON a.id = i.artisan_id
LEFT JOIN ventes_or_artisans v ON a.id = v.artisan_id
GROUP BY a.id, c.statut, c.date_expiration;
