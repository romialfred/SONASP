-- ============================================================================
-- Moyens de paiement des artisans miniers
--
-- Les coordonnées de règlement — numéro mobile money, RIB, titulaire — étaient
-- saisies **au moment de payer**, sur l'écran de paiement. Deux conséquences :
--   * la même coordonnée était ressaisie à chaque règlement, avec le risque de
--     frappe que cela comporte sur un virement ;
--   * rien ne garantissait que le compte crédité appartienne bien à l'artisan.
--
-- Elles sont désormais rattachées à la fiche de l'artisan, saisies une fois et
-- vérifiées une fois. L'écran de paiement se contente de les choisir.
--
-- Retour arrière :
--   DROP TABLE IF EXISTS snp_artisan_moyens_paiement;
-- ============================================================================

CREATE TABLE IF NOT EXISTS snp_artisan_moyens_paiement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid NOT NULL REFERENCES snp_artisans_miniers(id) ON DELETE CASCADE,

  -- Aligné sur les moyens proposés à l'écran de paiement.
  type text NOT NULL CHECK (type IN (
    'orange_money', 'moov_money', 'wave', 'mobile_money',
    'virement_bancaire', 'cheque', 'especes'
  )),

  libelle text,

  -- Mobile money : numéro et titulaire du compte.
  numero_telephone text,

  -- Virement et chèque : coordonnées bancaires.
  banque text,
  numero_compte text,
  code_swift text,

  -- Commun : nom porté sur le compte, comparé à l'identité de l'artisan.
  titulaire text NOT NULL,

  est_principal boolean NOT NULL DEFAULT false,
  actif boolean NOT NULL DEFAULT true,

  -- Vérification de la coordonnée par un agent, avant tout règlement.
  verifie_le timestamptz,
  verifie_par uuid,

  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

COMMENT ON TABLE snp_artisan_moyens_paiement IS
  'Coordonnées de règlement d''un artisan minier, saisies sur sa fiche et non '
  'au moment de payer.';

-- Un moyen mobile exige un numéro, un virement exige un compte : la contrainte
-- évite d'enregistrer une coordonnée inutilisable.
ALTER TABLE snp_artisan_moyens_paiement
  DROP CONSTRAINT IF EXISTS snp_moyen_paiement_coordonnee_requise;

ALTER TABLE snp_artisan_moyens_paiement
  ADD CONSTRAINT snp_moyen_paiement_coordonnee_requise CHECK (
    (type IN ('orange_money', 'moov_money', 'wave', 'mobile_money')
      AND numero_telephone IS NOT NULL AND length(trim(numero_telephone)) > 0)
    OR (type IN ('virement_bancaire', 'cheque')
      AND numero_compte IS NOT NULL AND length(trim(numero_compte)) > 0)
    OR type = 'especes'
  );

CREATE INDEX IF NOT EXISTS idx_moyens_paiement_artisan
  ON snp_artisan_moyens_paiement (artisan_id) WHERE actif;

-- Un seul moyen principal par artisan : l'écran de paiement le présélectionne.
CREATE UNIQUE INDEX IF NOT EXISTS idx_moyens_paiement_principal_unique
  ON snp_artisan_moyens_paiement (artisan_id)
  WHERE est_principal AND actif;

ALTER TABLE snp_artisan_moyens_paiement ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture des moyens de paiement" ON snp_artisan_moyens_paiement;
CREATE POLICY "Lecture des moyens de paiement"
  ON snp_artisan_moyens_paiement FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Ecriture des moyens de paiement" ON snp_artisan_moyens_paiement;
CREATE POLICY "Ecriture des moyens de paiement"
  ON snp_artisan_moyens_paiement FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Rattachement du règlement au moyen employé et à la facture présentée.
-- ----------------------------------------------------------------------------
ALTER TABLE snp_artisan_paiements
  ADD COLUMN IF NOT EXISTS moyen_paiement_id uuid REFERENCES snp_artisan_moyens_paiement(id);

COMMENT ON COLUMN snp_artisan_paiements.moyen_paiement_id IS
  'Coordonnée de règlement employée, prise sur la fiche de l''artisan.';

ALTER TABLE snp_artisan_paiements
  ADD COLUMN IF NOT EXISTS numero_facture text;

COMMENT ON COLUMN snp_artisan_paiements.numero_facture IS
  'Facture présentée au règlement. La certification DGI n''étant pas raccordée, '
  'elle référence pour l''instant un spécimen.';
