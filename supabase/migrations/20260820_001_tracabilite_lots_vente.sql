-- ============================================================================
-- Traçabilité : quelle vente à l'export est servie par quels achats
--
-- `sales` porte désormais la SONASP comme vendeuse et son stock exportable est
-- calculé, mais aucune écriture ne reliait une vente aux achats qui
-- l'approvisionnent : le stock ne se vérifiait qu'en masse, jamais pièce par
-- pièce. Il était donc impossible de dire de quelle mine ou de quel artisan
-- venait l'or d'une expédition — ce que la traçabilité nationale exige.
--
-- `sales_allocations` existe déjà mais rattache une vente à un enregistrement
-- d'affinage (`refining_record_id`) : elle décrit la chaîne d'affinage, pas la
-- chaîne d'acquisition. Elle est vide et n'est lue par aucun écran ; on la
-- laisse en place plutôt que d'en détourner le sens.
--
-- Une ligne = une fraction d'un lot d'achat affectée à une vente. Une vente se
-- compose de plusieurs lots ; un lot peut servir plusieurs ventes.
--
-- Retour arrière : DROP TABLE IF EXISTS snp_ventes_lots;
-- ============================================================================

CREATE TABLE IF NOT EXISTS snp_ventes_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,

  -- Origine du lot : achat à une mine industrielle ou achat à un artisan.
  source_type text NOT NULL CHECK (source_type IN ('achat_mine', 'achat_artisan')),
  achat_mine_id uuid REFERENCES snp_achats_mines(id) ON DELETE RESTRICT,
  artisan_vente_id uuid REFERENCES snp_artisan_ventes_or(id) ON DELETE RESTRICT,

  -- Quantité prélevée sur ce lot, en onces troy comme les ventes export.
  quantite_oz numeric(14, 4) NOT NULL CHECK (quantite_oz > 0),

  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,

  -- Une source, et une seule, cohérente avec le type déclaré.
  CONSTRAINT snp_ventes_lots_source_unique CHECK (
    (source_type = 'achat_mine' AND achat_mine_id IS NOT NULL AND artisan_vente_id IS NULL)
    OR
    (source_type = 'achat_artisan' AND artisan_vente_id IS NOT NULL AND achat_mine_id IS NULL)
  )
);

COMMENT ON TABLE snp_ventes_lots IS
  'Composition d''une vente a l''export : fractions de lots d''achat (mines '
  'industrielles ou artisans miniers) affectees a la vente. Chaine '
  'd''acquisition, distincte de sales_allocations qui porte l''affinage.';

CREATE INDEX IF NOT EXISTS idx_ventes_lots_vente ON snp_ventes_lots (sale_id);
CREATE INDEX IF NOT EXISTS idx_ventes_lots_achat_mine ON snp_ventes_lots (achat_mine_id);
CREATE INDEX IF NOT EXISTS idx_ventes_lots_artisan ON snp_ventes_lots (artisan_vente_id);

ALTER TABLE snp_ventes_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture des lots de vente" ON snp_ventes_lots;
CREATE POLICY "Lecture des lots de vente"
  ON snp_ventes_lots FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Ecriture des lots de vente" ON snp_ventes_lots;
CREATE POLICY "Ecriture des lots de vente"
  ON snp_ventes_lots FOR ALL TO authenticated USING (true) WITH CHECK (true);
