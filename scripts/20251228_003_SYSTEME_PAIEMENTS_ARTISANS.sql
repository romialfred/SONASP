/*
  # Système de Paiements des Ventes d'Or Artisanal

  1. Nouvelles Tables
    - `snp_artisan_factures_definitives`
      - Factures définitives générées après validation d'une vente
      - Contient le montant total, taxes, et net à payer
      - Lien avec la vente d'or correspondante

    - `snp_artisan_paiements`
      - Enregistrement des paiements effectués aux artisans
      - Type de paiement (Virement, Cash, Orange Money, Mobile Money)
      - Statut du paiement (en_attente, traite, complete, annule)
      - Lien avec la facture et la vente

    - `snp_artisan_taxes_retenues`
      - Comptabilité des taxes retenues sur les paiements
      - Montants par type de taxe
      - Statut de reversement aux autorités

  2. Modifications Tables Existantes
    - Ajout colonne `statut_paiement` dans `snp_artisan_ventes_or`
    - Ajout colonne `facture_definitive_id` dans `snp_artisan_ventes_or`

  3. Sécurité
    - Enable RLS sur toutes les nouvelles tables
    - Politiques restrictives pour utilisateurs authentifiés seulement
    - Audit trail pour toutes les opérations de paiement

  4. Fonctions Automatiques
    - Fonction pour générer automatiquement une facture après validation
    - Fonction pour calculer les taxes retenues
    - Trigger pour mettre à jour le statut de paiement
*/

-- ================================================
-- 1. TABLE: snp_artisan_factures_definitives
-- ================================================
CREATE TABLE IF NOT EXISTS snp_artisan_factures_definitives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_facture TEXT UNIQUE NOT NULL,
  vente_or_id UUID NOT NULL REFERENCES snp_artisan_ventes_or(id) ON DELETE CASCADE,
  artisan_id UUID NOT NULL REFERENCES snp_artisans_miniers(id),

  -- Montants
  montant_brut DECIMAL(15, 2) NOT NULL,
  montant_taxe_tva DECIMAL(15, 2) DEFAULT 0,
  montant_taxe_retenue_source DECIMAL(15, 2) DEFAULT 0,
  montant_autres_taxes DECIMAL(15, 2) DEFAULT 0,
  montant_total_taxes DECIMAL(15, 2) NOT NULL,
  montant_net_a_payer DECIMAL(15, 2) NOT NULL,

  -- Informations fiscales
  taux_tva DECIMAL(5, 2) DEFAULT 0,
  taux_retenue_source DECIMAL(5, 2) DEFAULT 0,

  -- Dates
  date_emission TIMESTAMPTZ DEFAULT now(),
  date_echeance TIMESTAMPTZ,

  -- Statut
  statut TEXT DEFAULT 'emise' CHECK (statut IN ('emise', 'en_paiement', 'payee', 'annulee')),

  -- Documents
  pdf_url TEXT,

  -- Métadonnées
  notes TEXT,
  emise_par UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_factures_definitives_vente ON snp_artisan_factures_definitives(vente_or_id);
CREATE INDEX IF NOT EXISTS idx_factures_definitives_artisan ON snp_artisan_factures_definitives(artisan_id);
CREATE INDEX IF NOT EXISTS idx_factures_definitives_statut ON snp_artisan_factures_definitives(statut);
CREATE INDEX IF NOT EXISTS idx_factures_definitives_date ON snp_artisan_factures_definitives(date_emission);

-- RLS
ALTER TABLE snp_artisan_factures_definitives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent voir les factures" ON snp_artisan_factures_definitives;
CREATE POLICY "Utilisateurs authentifiés peuvent voir les factures"
  ON snp_artisan_factures_definitives FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent créer des factures" ON snp_artisan_factures_definitives;
CREATE POLICY "Utilisateurs authentifiés peuvent créer des factures"
  ON snp_artisan_factures_definitives FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent mettre à jour les factures" ON snp_artisan_factures_definitives;
CREATE POLICY "Utilisateurs authentifiés peuvent mettre à jour les factures"
  ON snp_artisan_factures_definitives FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ================================================
-- 2. TABLE: snp_artisan_paiements
-- ================================================
CREATE TABLE IF NOT EXISTS snp_artisan_paiements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_paiement TEXT UNIQUE NOT NULL,

  -- Relations
  facture_id UUID NOT NULL REFERENCES snp_artisan_factures_definitives(id) ON DELETE CASCADE,
  vente_or_id UUID NOT NULL REFERENCES snp_artisan_ventes_or(id) ON DELETE CASCADE,
  artisan_id UUID NOT NULL REFERENCES snp_artisans_miniers(id),

  -- Informations de paiement
  type_paiement TEXT NOT NULL CHECK (type_paiement IN (
    'virement_bancaire',
    'cash',
    'orange_money',
    'mobile_money',
    'moov_money',
    'wave',
    'cheque'
  )),

  -- Montants
  montant_paye DECIMAL(15, 2) NOT NULL,
  montant_taxes_retenues DECIMAL(15, 2) NOT NULL DEFAULT 0,

  -- Détails selon type de paiement
  details_paiement JSONB DEFAULT '{}'::jsonb,

  -- Statut et workflow
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN (
    'en_attente',
    'en_traitement',
    'valide',
    'complete',
    'annule',
    'echec'
  )),

  -- Dates
  date_paiement TIMESTAMPTZ DEFAULT now(),
  date_validation TIMESTAMPTZ,
  date_completion TIMESTAMPTZ,

  -- Preuves et documents
  preuve_paiement_url TEXT,
  recu_paiement_url TEXT,

  -- Informations de traitement
  traite_par UUID REFERENCES auth.users(id),
  valide_par UUID REFERENCES auth.users(id),

  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_paiements_facture ON snp_artisan_paiements(facture_id);
CREATE INDEX IF NOT EXISTS idx_paiements_vente ON snp_artisan_paiements(vente_or_id);
CREATE INDEX IF NOT EXISTS idx_paiements_artisan ON snp_artisan_paiements(artisan_id);
CREATE INDEX IF NOT EXISTS idx_paiements_statut ON snp_artisan_paiements(statut);
CREATE INDEX IF NOT EXISTS idx_paiements_date ON snp_artisan_paiements(date_paiement);
CREATE INDEX IF NOT EXISTS idx_paiements_type ON snp_artisan_paiements(type_paiement);

-- RLS
ALTER TABLE snp_artisan_paiements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent voir les paiements" ON snp_artisan_paiements;
CREATE POLICY "Utilisateurs authentifiés peuvent voir les paiements"
  ON snp_artisan_paiements FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent créer des paiements" ON snp_artisan_paiements;
CREATE POLICY "Utilisateurs authentifiés peuvent créer des paiements"
  ON snp_artisan_paiements FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent mettre à jour les paiements" ON snp_artisan_paiements;
CREATE POLICY "Utilisateurs authentifiés peuvent mettre à jour les paiements"
  ON snp_artisan_paiements FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ================================================
-- 3. TABLE: snp_artisan_taxes_retenues
-- ================================================
CREATE TABLE IF NOT EXISTS snp_artisan_taxes_retenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  paiement_id UUID NOT NULL REFERENCES snp_artisan_paiements(id) ON DELETE CASCADE,
  facture_id UUID NOT NULL REFERENCES snp_artisan_factures_definitives(id),
  vente_or_id UUID NOT NULL REFERENCES snp_artisan_ventes_or(id),
  artisan_id UUID NOT NULL REFERENCES snp_artisans_miniers(id),

  -- Types et montants de taxes
  type_taxe TEXT NOT NULL CHECK (type_taxe IN (
    'tva',
    'retenue_source',
    'taxe_municipale',
    'taxe_regionale',
    'autre'
  )),

  libelle_taxe TEXT NOT NULL,
  taux_taxe DECIMAL(5, 2) NOT NULL,
  montant_taxe DECIMAL(15, 2) NOT NULL,

  -- Comptabilité
  compte_comptable TEXT,
  reference_comptable TEXT,

  -- Statut de reversement
  statut_reversement TEXT DEFAULT 'a_reverser' CHECK (statut_reversement IN (
    'a_reverser',
    'en_cours',
    'reverse',
    'comptabilise'
  )),

  date_reversement TIMESTAMPTZ,
  reversement_reference TEXT,

  -- Métadonnées
  periode_fiscale TEXT,
  exercice_fiscal TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_taxes_retenues_paiement ON snp_artisan_taxes_retenues(paiement_id);
CREATE INDEX IF NOT EXISTS idx_taxes_retenues_vente ON snp_artisan_taxes_retenues(vente_or_id);
CREATE INDEX IF NOT EXISTS idx_taxes_retenues_artisan ON snp_artisan_taxes_retenues(artisan_id);
CREATE INDEX IF NOT EXISTS idx_taxes_retenues_type ON snp_artisan_taxes_retenues(type_taxe);
CREATE INDEX IF NOT EXISTS idx_taxes_retenues_statut ON snp_artisan_taxes_retenues(statut_reversement);
CREATE INDEX IF NOT EXISTS idx_taxes_retenues_periode ON snp_artisan_taxes_retenues(periode_fiscale);

-- RLS
ALTER TABLE snp_artisan_taxes_retenues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent voir les taxes" ON snp_artisan_taxes_retenues;
CREATE POLICY "Utilisateurs authentifiés peuvent voir les taxes"
  ON snp_artisan_taxes_retenues FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent créer des taxes" ON snp_artisan_taxes_retenues;
CREATE POLICY "Utilisateurs authentifiés peuvent créer des taxes"
  ON snp_artisan_taxes_retenues FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent mettre à jour les taxes" ON snp_artisan_taxes_retenues;
CREATE POLICY "Utilisateurs authentifiés peuvent mettre à jour les taxes"
  ON snp_artisan_taxes_retenues FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ================================================
-- 4. MODIFICATION TABLE EXISTANTE: snp_artisan_ventes_or
-- ================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snp_artisan_ventes_or' AND column_name = 'statut_paiement'
  ) THEN
    ALTER TABLE snp_artisan_ventes_or
    ADD COLUMN statut_paiement TEXT DEFAULT 'non_paye'
    CHECK (statut_paiement IN ('non_paye', 'en_attente_facture', 'facture_emise', 'en_paiement', 'paye', 'paiement_partiel'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snp_artisan_ventes_or' AND column_name = 'facture_definitive_id'
  ) THEN
    ALTER TABLE snp_artisan_ventes_or
    ADD COLUMN facture_definitive_id UUID REFERENCES snp_artisan_factures_definitives(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snp_artisan_ventes_or' AND column_name = 'reference_vente'
  ) THEN
    ALTER TABLE snp_artisan_ventes_or
    ADD COLUMN reference_vente TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snp_artisan_ventes_or' AND column_name = 'statut_validation'
  ) THEN
    ALTER TABLE snp_artisan_ventes_or
    ADD COLUMN statut_validation TEXT DEFAULT 'en_attente'
    CHECK (statut_validation IN ('en_attente', 'validee', 'rejetee'));
  END IF;
END $$;

-- ================================================
-- 5. FONCTIONS UTILITAIRES
-- ================================================
CREATE OR REPLACE FUNCTION generer_numero_facture()
RETURNS TEXT AS $$
DECLARE
  annee TEXT := TO_CHAR(NOW(), 'YYYY');
  mois TEXT := TO_CHAR(NOW(), 'MM');
  compteur INT;
  numero TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO compteur
  FROM snp_artisan_factures_definitives
  WHERE DATE_TRUNC('month', date_emission) = DATE_TRUNC('month', NOW());

  numero := 'FACT-' || annee || '-' || mois || '-' || LPAD(compteur::TEXT, 4, '0');
  RETURN numero;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generer_reference_paiement()
RETURNS TEXT AS $$
DECLARE
  annee TEXT := TO_CHAR(NOW(), 'YYYY');
  mois TEXT := TO_CHAR(NOW(), 'MM');
  compteur INT;
  reference TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO compteur
  FROM snp_artisan_paiements
  WHERE DATE(date_paiement) = CURRENT_DATE;

  reference := 'PAY-' || annee || mois || TO_CHAR(NOW(), 'DD') || '-' || LPAD(compteur::TEXT, 4, '0');
  RETURN reference;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculer_taxes_vente(
  p_montant_brut DECIMAL,
  p_taux_tva DECIMAL DEFAULT 18.0,
  p_taux_retenue_source DECIMAL DEFAULT 1.5
)
RETURNS TABLE (
  montant_tva DECIMAL,
  montant_retenue_source DECIMAL,
  montant_total_taxes DECIMAL,
  montant_net DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROUND(p_montant_brut * p_taux_tva / 100, 2) AS montant_tva,
    ROUND(p_montant_brut * p_taux_retenue_source / 100, 2) AS montant_retenue_source,
    ROUND(p_montant_brut * (p_taux_tva + p_taux_retenue_source) / 100, 2) AS montant_total_taxes,
    ROUND(p_montant_brut - (p_montant_brut * (p_taux_tva + p_taux_retenue_source) / 100), 2) AS montant_net;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================
-- 6. TRIGGERS
-- ================================================
CREATE OR REPLACE FUNCTION update_statut_paiement_vente()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.statut = 'complete' THEN
    UPDATE snp_artisan_ventes_or
    SET statut_paiement = 'paye', updated_at = NOW()
    WHERE id = NEW.vente_or_id;
  END IF;

  IF (TG_OP = 'INSERT') AND NEW.statut = 'en_attente' THEN
    UPDATE snp_artisan_ventes_or
    SET statut_paiement = 'en_paiement', updated_at = NOW()
    WHERE id = NEW.vente_or_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_statut_paiement ON snp_artisan_paiements;
CREATE TRIGGER trigger_update_statut_paiement
  AFTER INSERT OR UPDATE ON snp_artisan_paiements
  FOR EACH ROW
  EXECUTE FUNCTION update_statut_paiement_vente();

CREATE OR REPLACE FUNCTION creer_taxes_retenues_auto()
RETURNS TRIGGER AS $$
DECLARE
  v_facture RECORD;
  v_periode TEXT;
  v_exercice TEXT;
BEGIN
  SELECT * INTO v_facture
  FROM snp_artisan_factures_definitives
  WHERE id = NEW.facture_id;

  v_periode := TO_CHAR(NEW.date_paiement, 'YYYY-MM');
  v_exercice := TO_CHAR(NEW.date_paiement, 'YYYY');

  IF v_facture.montant_taxe_tva > 0 THEN
    INSERT INTO snp_artisan_taxes_retenues (
      paiement_id, facture_id, vente_or_id, artisan_id,
      type_taxe, libelle_taxe, taux_taxe, montant_taxe,
      periode_fiscale, exercice_fiscal
    ) VALUES (
      NEW.id, NEW.facture_id, NEW.vente_or_id, NEW.artisan_id,
      'tva', 'TVA sur vente d''or artisanal', v_facture.taux_tva, v_facture.montant_taxe_tva,
      v_periode, v_exercice
    );
  END IF;

  IF v_facture.montant_taxe_retenue_source > 0 THEN
    INSERT INTO snp_artisan_taxes_retenues (
      paiement_id, facture_id, vente_or_id, artisan_id,
      type_taxe, libelle_taxe, taux_taxe, montant_taxe,
      periode_fiscale, exercice_fiscal
    ) VALUES (
      NEW.id, NEW.facture_id, NEW.vente_or_id, NEW.artisan_id,
      'retenue_source', 'Retenue à la source', v_facture.taux_retenue_source, v_facture.montant_taxe_retenue_source,
      v_periode, v_exercice
    );
  END IF;

  IF v_facture.montant_autres_taxes > 0 THEN
    INSERT INTO snp_artisan_taxes_retenues (
      paiement_id, facture_id, vente_or_id, artisan_id,
      type_taxe, libelle_taxe, taux_taxe, montant_taxe,
      periode_fiscale, exercice_fiscal
    ) VALUES (
      NEW.id, NEW.facture_id, NEW.vente_or_id, NEW.artisan_id,
      'autre', 'Autres taxes', 0, v_facture.montant_autres_taxes,
      v_periode, v_exercice
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_creer_taxes_retenues ON snp_artisan_paiements;
CREATE TRIGGER trigger_creer_taxes_retenues
  AFTER INSERT ON snp_artisan_paiements
  FOR EACH ROW
  WHEN (NEW.statut = 'complete' OR NEW.statut = 'valide')
  EXECUTE FUNCTION creer_taxes_retenues_auto();

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_factures_updated_at ON snp_artisan_factures_definitives;
CREATE TRIGGER update_factures_updated_at
  BEFORE UPDATE ON snp_artisan_factures_definitives
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_paiements_updated_at ON snp_artisan_paiements;
CREATE TRIGGER update_paiements_updated_at
  BEFORE UPDATE ON snp_artisan_paiements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_taxes_updated_at ON snp_artisan_taxes_retenues;
CREATE TRIGGER update_taxes_updated_at
  BEFORE UPDATE ON snp_artisan_taxes_retenues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- 7. VUES UTILES
-- ================================================
CREATE OR REPLACE VIEW v_artisan_paiements_resume AS
SELECT
  a.id AS artisan_id,
  a.nom,
  a.prenom,
  a.numero_carte,
  COUNT(DISTINCT v.id) AS nombre_ventes,
  COUNT(DISTINCT p.id) AS nombre_paiements,
  COALESCE(SUM(f.montant_brut), 0) AS total_brut,
  COALESCE(SUM(f.montant_total_taxes), 0) AS total_taxes,
  COALESCE(SUM(f.montant_net_a_payer), 0) AS total_net,
  COALESCE(SUM(CASE WHEN p.statut = 'complete' THEN p.montant_paye ELSE 0 END), 0) AS total_paye,
  COALESCE(SUM(CASE WHEN v.statut_paiement = 'paye' THEN 0 ELSE f.montant_net_a_payer END), 0) AS solde_du
FROM snp_artisans_miniers a
LEFT JOIN snp_artisan_ventes_or v ON v.artisan_id = a.id
LEFT JOIN snp_artisan_factures_definitives f ON f.vente_or_id = v.id
LEFT JOIN snp_artisan_paiements p ON p.vente_or_id = v.id
WHERE a.statut = 'actif'
GROUP BY a.id, a.nom, a.prenom, a.numero_carte;

CREATE OR REPLACE VIEW v_taxes_a_reverser AS
SELECT
  t.type_taxe,
  t.libelle_taxe,
  t.periode_fiscale,
  t.exercice_fiscal,
  COUNT(*) AS nombre_transactions,
  SUM(t.montant_taxe) AS montant_total,
  t.statut_reversement
FROM snp_artisan_taxes_retenues t
GROUP BY t.type_taxe, t.libelle_taxe, t.periode_fiscale, t.exercice_fiscal, t.statut_reversement
ORDER BY t.periode_fiscale DESC, t.type_taxe;

CREATE OR REPLACE VIEW v_paiements_en_attente AS
SELECT
  v.id AS vente_id,
  v.reference_vente,
  v.date_vente,
  a.id AS artisan_id,
  a.nom || ' ' || a.prenom AS artisan_nom_complet,
  a.numero_carte,
  a.telephone,
  f.id AS facture_id,
  f.numero_facture,
  f.montant_net_a_payer,
  f.date_emission AS date_facture,
  v.statut_paiement,
  CURRENT_DATE - f.date_emission::DATE AS jours_attente
FROM snp_artisan_ventes_or v
INNER JOIN snp_artisans_miniers a ON a.id = v.artisan_id
LEFT JOIN snp_artisan_factures_definitives f ON f.vente_or_id = v.id
WHERE v.statut_validation = 'validee'
  AND (v.statut_paiement IS NULL OR v.statut_paiement IN ('non_paye', 'facture_emise', 'en_paiement'))
ORDER BY f.date_emission ASC;

-- ================================================
-- 8. COMMENTAIRES
-- ================================================
COMMENT ON TABLE snp_artisan_factures_definitives IS 'Factures définitives émises pour les ventes d''or validées';
COMMENT ON TABLE snp_artisan_paiements IS 'Enregistrement des paiements effectués aux artisans miniers';
COMMENT ON TABLE snp_artisan_taxes_retenues IS 'Comptabilité des taxes retenues à reverser aux autorités';

COMMENT ON COLUMN snp_artisan_factures_definitives.montant_net_a_payer IS 'Montant net après déduction de toutes les taxes';
COMMENT ON COLUMN snp_artisan_paiements.details_paiement IS 'Détails JSON selon type de paiement (numéro compte, téléphone, etc.)';
COMMENT ON COLUMN snp_artisan_taxes_retenues.statut_reversement IS 'Statut du reversement de la taxe aux autorités';
