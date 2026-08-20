-- ============================================================================
-- Règlements aux mines : comptes bancaires, cycle de vie, preuves
--
-- CE QUE L'ANALYSE DE L'EXISTANT A ÉTABLI
--
-- 1. `stakeholder_bank_accounts` existe déjà (polymorphe) mais était VIDE et
--    incomplète : ni code banque, ni clé RIB, ni période de validité, ni statut
--    de vérification. Elle est étendue, non remplacée.
-- 2. `snp_reglements_achat.statut` ne connaissait que quatre états. Ils
--    confondaient la validation interne, l'émission de l'ordre, l'exécution par
--    la banque et le rapprochement — quatre moments distincts en trésorerie.
-- 3. Le montant payé d'une facture comptait TOUTE affectation active : un
--    simple brouillon soldait donc une facture avant que la banque n'ait rien
--    exécuté. Corrigé au fichier suivant (engagé ≠ payé).
--
-- Retour arrière : les colonnes ajoutées se retirent par ALTER TABLE ; les
-- anciens statuts se rétablissent en inversant la correspondance.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Comptes bancaires : ce qu'un virement burkinabè exige réellement
-- ---------------------------------------------------------------------------
ALTER TABLE stakeholder_bank_accounts
  ADD COLUMN IF NOT EXISTS bank_code text,
  ADD COLUMN IF NOT EXISTS rib_key text,
  ADD COLUMN IF NOT EXISTS account_holder text,
  ADD COLUMN IF NOT EXISTS valid_from date,
  ADD COLUMN IF NOT EXISTS valid_to date,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'a_verifier',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS justificatif_url text,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DO $bloc$ BEGIN
  ALTER TABLE stakeholder_bank_accounts
    ADD CONSTRAINT stakeholder_bank_verification_check
    CHECK (verification_status IN ('a_verifier', 'verifie', 'rejete'));
EXCEPTION WHEN duplicate_object THEN NULL; END $bloc$;

DO $bloc$ BEGIN
  ALTER TABLE stakeholder_bank_accounts
    ADD CONSTRAINT stakeholder_bank_validite_check
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from);
EXCEPTION WHEN duplicate_object THEN NULL; END $bloc$;

-- Un seul compte principal actif par bénéficiaire et par devise : deux comptes
-- « principaux » rendraient la présélection arbitraire.
CREATE UNIQUE INDEX IF NOT EXISTS idx_stakeholder_bank_principal
  ON stakeholder_bank_accounts(stakeholder_type, stakeholder_id, account_currency)
  WHERE is_primary AND is_active;

CREATE INDEX IF NOT EXISTS idx_stakeholder_bank_proprietaire
  ON stakeholder_bank_accounts(stakeholder_type, stakeholder_id) WHERE is_active;

-- ---------------------------------------------------------------------------
-- 2. Cycle de vie du règlement
-- ---------------------------------------------------------------------------
ALTER TABLE snp_reglements_achat DROP CONSTRAINT IF EXISTS snp_reglements_achat_statut_check;

-- `enregistre` désignait un règlement saisi mais non contrôlé : un brouillon.
UPDATE snp_reglements_achat SET statut = 'brouillon' WHERE statut = 'enregistre';

ALTER TABLE snp_reglements_achat
  ADD CONSTRAINT snp_reglements_achat_statut_check CHECK (statut IN (
    'brouillon',          -- en préparation, rien n'est engagé auprès de la banque
    'soumis',             -- transmis pour validation interne
    'valide',             -- validé par un habilité, ordre à émettre
    'en_execution',       -- ordre transmis à la banque, exécution attendue
    'execute',            -- exécution confirmée : la dette s'éteint
    'rapproche',          -- rapproché avec le relevé bancaire
    'rejete', 'annule'));

ALTER TABLE snp_reglements_achat
  ADD COLUMN IF NOT EXISTS compte_bancaire_id uuid REFERENCES stakeholder_bank_accounts(id) ON DELETE RESTRICT,
  -- Copie figée des coordonnées au moment de la préparation. Si la fiche de la
  -- société change ensuite, le règlement garde la trace de ce qui a servi :
  -- c'est la condition de l'auditabilité.
  ADD COLUMN IF NOT EXISTS coordonnees_utilisees jsonb,
  ADD COLUMN IF NOT EXISTS objet text,
  ADD COLUMN IF NOT EXISTS reference_interne text,
  ADD COLUMN IF NOT EXISTS date_execution_prevue date,
  ADD COLUMN IF NOT EXISTS prepare_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_preparation timestamptz,
  ADD COLUMN IF NOT EXISTS soumis_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_soumission timestamptz,
  ADD COLUMN IF NOT EXISTS execute_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_execution timestamptz,
  ADD COLUMN IF NOT EXISTS rapproche_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_rapprochement timestamptz;

COMMENT ON COLUMN snp_reglements_achat.coordonnees_utilisees IS
  'Coordonnées bancaires figées à la préparation. Une modification ultérieure de la fiche société ne réécrit pas un règlement déjà exécuté.';

-- Une référence interne ne se réutilise pas : protection contre le double ordre.
CREATE UNIQUE INDEX IF NOT EXISTS idx_snp_reglement_reference_interne
  ON snp_reglements_achat(reference_interne)
  WHERE reference_interne IS NOT NULL AND statut <> 'annule';

-- ---------------------------------------------------------------------------
-- 3. Pièces justificatives du règlement
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snp_reglements_preuves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reglement_id uuid NOT NULL REFERENCES snp_reglements_achat(id) ON DELETE CASCADE,
  type_document text NOT NULL CHECK (type_document IN (
    'mt103', 'avis_swift', 'avis_debit', 'confirmation_virement',
    'bordereau_bancaire', 'releve_bancaire', 'autre')),
  fichier_url text NOT NULL,
  nom_origine text NOT NULL,
  type_mime text NOT NULL,
  taille_octets bigint NOT NULL CHECK (taille_octets > 0),
  empreinte_sha256 text,
  reference_document text,
  date_emission date,
  banque_emettrice text,
  commentaire text,
  statut_verification text NOT NULL DEFAULT 'a_verifier'
    CHECK (statut_verification IN ('a_verifier', 'verifiee', 'rejetee')),
  motif_rejet text,
  ajoute_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ajoute_le timestamptz NOT NULL DEFAULT now(),
  verifiee_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verifiee_le timestamptz,
  CONSTRAINT snp_preuve_rejet_motive CHECK (
    statut_verification <> 'rejetee'
    OR (motif_rejet IS NOT NULL AND length(trim(motif_rejet)) >= 5)),
  -- Deux fois le même fichier sur le même règlement n'apporte rien et brouille
  -- la vérification.
  CONSTRAINT snp_preuve_unique UNIQUE (reglement_id, empreinte_sha256)
);

CREATE INDEX IF NOT EXISTS idx_snp_preuves_reglement ON snp_reglements_preuves(reglement_id);

ALTER TABLE snp_reglements_preuves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Preuves lisibles par la SONASP ou la mine" ON snp_reglements_preuves;
CREATE POLICY "Preuves lisibles par la SONASP ou la mine" ON snp_reglements_preuves
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM snp_reglements_achat r
    WHERE r.id = reglement_id
      AND (snp_est_agent_sonasp() OR r.mining_company_id = snp_societe_utilisateur())));

DROP POLICY IF EXISTS "Preuves ecrites par la SONASP" ON snp_reglements_preuves;
CREATE POLICY "Preuves ecrites par la SONASP" ON snp_reglements_preuves
  FOR ALL TO authenticated
  USING (snp_est_agent_sonasp()) WITH CHECK (snp_est_agent_sonasp());

DROP TRIGGER IF EXISTS trg_snp_reglements_preuves_audit ON snp_reglements_preuves;
CREATE TRIGGER trg_snp_reglements_preuves_audit
  AFTER INSERT OR UPDATE OR DELETE ON snp_reglements_preuves
  FOR EACH ROW EXECUTE FUNCTION snp_auditer();
