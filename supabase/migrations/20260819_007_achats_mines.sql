-- ============================================================================
-- Achats d'or de la SONASP auprès des sociétés minières industrielles
--
-- Le circuit métier comporte deux ventes distinctes, que le schéma confondait :
--
--   1. La mine déclare sa production journalière, qui constitue son stock. En
--      fin de mois, la SONASP lui achète tout ou partie de ce stock. C'est un
--      achat national, au même titre que celui fait aux artisans miniers.
--
--   2. La SONASP revend hors du Burkina à des raffineurs internationaux, avec
--      l'or acheté aux mines et aux artisans.
--
-- La table `sales` ne connaissait que le second cas, et y inscrivait la mine
-- comme vendeur (`seller_type = 'mining_company'`) : la SONASP n'apparaissait
-- nulle part, et l'or passait de la mine au raffineur sans jamais lui
-- appartenir. Le premier cas n'existait pas.
--
-- Cette table porte le premier cas. Le second reste dans `sales`, dont le
-- vendeur devient la SONASP.
--
-- Retour arrière : DROP TABLE IF EXISTS snp_achats_mines;
-- ============================================================================

CREATE TABLE IF NOT EXISTS snp_achats_mines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  numero_achat text UNIQUE,
  mining_company_id uuid NOT NULL REFERENCES mining_companies(id),

  -- Période de production couverte par l'achat, généralement un mois.
  periode_debut date NOT NULL,
  periode_fin date NOT NULL,
  date_achat date NOT NULL DEFAULT CURRENT_DATE,

  -- Quantité achetée, qui peut être partielle : la SONASP décide de tout ou
  -- partie du stock constitué sur la période.
  quantite_oz numeric(14, 4) NOT NULL CHECK (quantite_oz > 0),
  quantite_grammes numeric(16, 3),

  -- Valorisation, en FCFA comme pour les artisans.
  prix_once_fcfa numeric(16, 2) NOT NULL CHECK (prix_once_fcfa >= 0),
  cours_once_usd numeric(12, 2),
  taux_usd_xof numeric(12, 4),
  montant_brut_fcfa numeric(18, 2) NOT NULL DEFAULT 0,

  tva_taux numeric(6, 3) NOT NULL DEFAULT 0,
  tva_montant_fcfa numeric(18, 2) NOT NULL DEFAULT 0,
  taxe_dev_comm_taux numeric(6, 3) NOT NULL DEFAULT 0,
  taxe_dev_comm_montant_fcfa numeric(18, 2) NOT NULL DEFAULT 0,
  montant_total_fcfa numeric(18, 2) NOT NULL DEFAULT 0,

  statut text NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'validee', 'payee', 'annulee')),

  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,

  CONSTRAINT snp_achats_mines_periode_coherente CHECK (periode_fin >= periode_debut)
);

COMMENT ON TABLE snp_achats_mines IS
  'Achats d''or de la SONASP aupres des societes minieres industrielles, sur le '
  'stock de production declare. Pendant industriel de snp_artisan_ventes_or.';

CREATE INDEX IF NOT EXISTS idx_achats_mines_societe ON snp_achats_mines (mining_company_id);
CREATE INDEX IF NOT EXISTS idx_achats_mines_periode ON snp_achats_mines (periode_debut, periode_fin);
CREATE INDEX IF NOT EXISTS idx_achats_mines_statut ON snp_achats_mines (statut);

ALTER TABLE snp_achats_mines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture des achats aux mines" ON snp_achats_mines;
CREATE POLICY "Lecture des achats aux mines"
  ON snp_achats_mines FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Ecriture des achats aux mines" ON snp_achats_mines;
CREATE POLICY "Ecriture des achats aux mines"
  ON snp_achats_mines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Numérotation : AC-MI-AAAA-NNNNN, compteur annuel, sur le modèle des ventes
-- d'or artisanales.
CREATE OR REPLACE FUNCTION generate_numero_achat_mine()
RETURNS TRIGGER AS $$
DECLARE
  prefixe text;
  prochain int;
BEGIN
  prefixe := 'AC-MI-' || to_char(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(NULLIF(regexp_replace(numero_achat, '^.*-', ''), '')::int), 0) + 1
  INTO prochain
  FROM snp_achats_mines
  WHERE numero_achat LIKE prefixe || '-%';

  NEW.numero_achat := prefixe || '-' || LPAD(prochain::text, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_numero_achat_mine ON snp_achats_mines;
CREATE TRIGGER trigger_numero_achat_mine
  BEFORE INSERT ON snp_achats_mines
  FOR EACH ROW
  WHEN (NEW.numero_achat IS NULL)
  EXECUTE FUNCTION generate_numero_achat_mine();
