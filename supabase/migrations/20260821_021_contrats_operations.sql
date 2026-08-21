-- ---------------------------------------------------------------------------
-- Contrats de fourniture : rattachement, exécution et transitions
--
-- Suite de `20260821_020_contrats_fourniture.sql`.
--
-- D2 (rappel) : aucune figure d'exécution n'est stockée. Tout se calcule depuis
-- les achats, seule source physique d'or acheté, et depuis les factures qui en
-- découlent. Une quantité ne peut donc pas être comptée deux fois.
-- ---------------------------------------------------------------------------

/* ═══════════════════════════ Rattachement des achats et des demandes ══ */

ALTER TABLE snp_achats_mines
  ADD COLUMN IF NOT EXISTS contrat_id uuid REFERENCES snp_contrats(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'hors_contrat',
  ADD COLUMN IF NOT EXISTS imputation_contractuelle text,
  ADD COLUMN IF NOT EXISTS quantite_imputee_oz numeric(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imputation_motif text,
  ADD COLUMN IF NOT EXISTS imputation_decidee_par uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS imputation_decidee_le timestamptz;

ALTER TABLE snp_achats_mines DROP CONSTRAINT IF EXISTS snp_achat_origine;
ALTER TABLE snp_achats_mines ADD CONSTRAINT snp_achat_origine
  CHECK (origine IN ('contrat', 'requisition', 'hors_contrat'));

ALTER TABLE snp_achats_mines DROP CONSTRAINT IF EXISTS snp_achat_imputation;
ALTER TABLE snp_achats_mines ADD CONSTRAINT snp_achat_imputation
  CHECK (imputation_contractuelle IS NULL OR imputation_contractuelle IN
    ('totale', 'partielle', 'hors_contrat', 'periode_future', 'avenant', 'exclue'));

-- On n'impute jamais plus que ce qui a été acheté, ni sans contrat.
ALTER TABLE snp_achats_mines DROP CONSTRAINT IF EXISTS snp_achat_imputee_plafonnee;
ALTER TABLE snp_achats_mines ADD CONSTRAINT snp_achat_imputee_plafonnee
  CHECK (quantite_imputee_oz >= 0 AND quantite_imputee_oz <= quantite_oz);

ALTER TABLE snp_achats_mines DROP CONSTRAINT IF EXISTS snp_achat_imputee_contrat;
ALTER TABLE snp_achats_mines ADD CONSTRAINT snp_achat_imputee_contrat
  CHECK (quantite_imputee_oz = 0 OR contrat_id IS NOT NULL);

ALTER TABLE snp_achats_mines DROP CONSTRAINT IF EXISTS snp_achat_imputation_motivee;
ALTER TABLE snp_achats_mines ADD CONSTRAINT snp_achat_imputation_motivee
  CHECK (imputation_contractuelle NOT IN ('partielle', 'periode_future', 'avenant', 'exclue')
    OR (imputation_motif IS NOT NULL AND length(trim(imputation_motif)) >= 5));

CREATE INDEX IF NOT EXISTS idx_snp_achats_contrat ON snp_achats_mines (contrat_id, origine);

ALTER TABLE snp_demandes_achat
  ADD COLUMN IF NOT EXISTS contrat_id uuid REFERENCES snp_contrats(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'plan';

ALTER TABLE snp_demandes_achat DROP CONSTRAINT IF EXISTS snp_demande_origine;
ALTER TABLE snp_demandes_achat ADD CONSTRAINT snp_demande_origine
  CHECK (origine IN ('plan', 'contrat', 'requisition', 'exceptionnelle'));

CREATE INDEX IF NOT EXISTS idx_snp_demandes_contrat ON snp_demandes_achat (contrat_id);

ALTER TABLE snp_plans_achat_lignes
  ADD COLUMN IF NOT EXISTS contrat_id uuid REFERENCES snp_contrats(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantite_contractuelle_oz numeric(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reliquat_anterieur_oz numeric(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depassement_oz numeric(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depassement_motif text;

CREATE INDEX IF NOT EXISTS idx_snp_plan_lignes_contrat ON snp_plans_achat_lignes (contrat_id);


/* ═══════════════════════════════════════════════════════ Numérotation ══ */

-- La référence se compose en base, jamais à l'écran.
CREATE OR REPLACE FUNCTION snp_numeroter_contrat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
BEGIN
  IF NEW.numero_contrat IS NULL OR length(trim(NEW.numero_contrat)) = 0 THEN
    NEW.numero_contrat := snp_numero_suivant(
      CASE WHEN NEW.type_contrat = 'avenant' THEN 'AV' ELSE 'CT' END,
      extract(year FROM COALESCE(NEW.date_debut, CURRENT_DATE))::int,
      'snp_contrats'::regclass, 'numero_contrat');
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_snp_contrats_numero ON snp_contrats;
CREATE TRIGGER trg_snp_contrats_numero BEFORE INSERT ON snp_contrats
  FOR EACH ROW EXECUTE FUNCTION snp_numeroter_contrat();

CREATE OR REPLACE FUNCTION snp_numeroter_defaut()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
BEGIN
  IF NEW.reference IS NULL OR length(trim(NEW.reference)) = 0 THEN
    NEW.reference := snp_numero_suivant('DEF',
      extract(year FROM COALESCE(NEW.date_detection, CURRENT_DATE))::int,
      'snp_contrats_defauts'::regclass, 'reference');
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_snp_defauts_numero ON snp_contrats_defauts;
CREATE TRIGGER trg_snp_defauts_numero BEFORE INSERT ON snp_contrats_defauts
  FOR EACH ROW EXECUTE FUNCTION snp_numeroter_defaut();


/* ═══════════════════════════════════════════════════════ Transitions ══ */

-- Un écran qui affiche un bouton impossible ment à son utilisateur : la liste
-- vient d'ici, et la fonction de changement la réapplique.
CREATE OR REPLACE FUNCTION snp_transitions_contrat(p_statut text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE p_statut
    WHEN 'brouillon' THEN ARRAY['soumis', 'annule']
    WHEN 'soumis' THEN ARRAY['revue_juridique', 'brouillon', 'rejete', 'annule']
    WHEN 'revue_juridique' THEN ARRAY['validation_metier', 'brouillon', 'rejete']
    WHEN 'validation_metier' THEN ARRAY['validation_financiere', 'brouillon', 'rejete']
    WHEN 'validation_financiere' THEN ARRAY['approuve', 'brouillon', 'rejete']
    WHEN 'approuve' THEN ARRAY['signe', 'rejete', 'annule']
    WHEN 'signe' THEN ARRAY['actif', 'annule']
    WHEN 'actif' THEN ARRAY['suspendu', 'echu', 'resilie', 'cloture']
    WHEN 'suspendu' THEN ARRAY['actif', 'resilie', 'cloture']
    WHEN 'echu' THEN ARRAY['cloture', 'actif']
    WHEN 'resilie' THEN ARRAY['cloture']
    WHEN 'rejete' THEN ARRAY['brouillon', 'annule']
    ELSE ARRAY[]::text[]
  END;
$fn$;

COMMENT ON FUNCTION snp_transitions_contrat(text) IS
  'États atteignables depuis un état donné. Clôturé et annulé sont terminaux.';


/* ═════════════════════════════════════════════════════════ Exécution ══ */

CREATE OR REPLACE FUNCTION snp_contrat_execution(p_contrat_id uuid)
RETURNS TABLE (
  quantite_totale numeric, quantite_planifiee numeric, quantite_livree numeric,
  quantite_imputee numeric, quantite_requisitionnee numeric,
  quantite_requisitionnee_imputee numeric, quantite_hors_contrat numeric,
  quantite_restante numeric, quantite_en_retard numeric, taux_execution numeric,
  montant_achats_fcfa numeric, montant_facture_fcfa numeric, montant_paye_fcfa numeric,
  solde_a_payer_fcfa numeric, nb_livraisons integer, nb_defauts_ouverts integer,
  prochaine_echeance date, prochaine_quantite numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
  WITH c AS (SELECT * FROM snp_contrats WHERE id = p_contrat_id),
  achats AS (
    SELECT a.* FROM snp_achats_mines a
    WHERE a.contrat_id = p_contrat_id AND a.statut <> 'annulee'
  ),
  factures AS (
    SELECT f.id, f.montant_ttc_fcfa FROM snp_factures_achat f
    WHERE f.statut <> 'annulee' AND (f.achat_id IN (SELECT id FROM achats))
  ),
  echeances AS (SELECT * FROM snp_contrats_echeancier WHERE contrat_id = p_contrat_id),
  -- Une échéance est en retard quand sa période est close et que les achats
  -- imputés sur cette période n'atteignent pas la quantité ferme prévue.
  retards AS (
    SELECT COALESCE(sum(GREATEST(0, e.quantite_prevue - COALESCE(l.livre, 0))), 0) AS quantite
    FROM echeances e
    LEFT JOIN LATERAL (
      SELECT sum(a.quantite_imputee_oz) AS livre FROM achats a
      WHERE a.periode_debut <= e.periode_fin AND a.periode_fin >= e.periode_debut
    ) l ON true
    WHERE e.nature = 'ferme' AND e.periode_fin < CURRENT_DATE
  ),
  suivante AS (
    SELECT e.periode_debut, e.quantite_prevue FROM echeances e
    WHERE e.periode_fin >= CURRENT_DATE ORDER BY e.periode_debut LIMIT 1
  )
  SELECT
    COALESCE((SELECT quantite_totale FROM c), 0),
    COALESCE((SELECT sum(quantite_prevue) FROM echeances), 0),
    COALESCE((SELECT sum(quantite_oz) FROM achats), 0),
    COALESCE((SELECT sum(quantite_imputee_oz) FROM achats), 0),
    COALESCE((SELECT sum(quantite_oz) FROM achats WHERE origine = 'requisition'), 0),
    COALESCE((SELECT sum(quantite_imputee_oz) FROM achats WHERE origine = 'requisition'), 0),
    COALESCE((SELECT sum(quantite_oz - quantite_imputee_oz) FROM achats), 0),
    GREATEST(0, COALESCE((SELECT quantite_totale FROM c), 0)
                - COALESCE((SELECT sum(quantite_imputee_oz) FROM achats), 0)),
    (SELECT quantite FROM retards),
    CASE WHEN COALESCE((SELECT quantite_totale FROM c), 0) > 0
      THEN round(COALESCE((SELECT sum(quantite_imputee_oz) FROM achats), 0) * 100
                 / (SELECT quantite_totale FROM c), 2)
      ELSE NULL END,
    COALESCE((SELECT sum(montant_total_fcfa) FROM achats), 0),
    COALESCE((SELECT sum(montant_ttc_fcfa) FROM factures), 0),
    COALESCE((SELECT sum(snp_facture_paye(id)) FROM factures), 0),
    GREATEST(0, COALESCE((SELECT sum(montant_ttc_fcfa) FROM factures), 0)
                - COALESCE((SELECT sum(snp_facture_paye(id)) FROM factures), 0)),
    (SELECT count(*)::int FROM achats),
    (SELECT count(*)::int FROM snp_contrats_defauts
      WHERE contrat_id = p_contrat_id AND statut NOT IN ('regularise', 'clos', 'annule')),
    (SELECT periode_debut FROM suivante),
    (SELECT quantite_prevue FROM suivante);
$fn$;

REVOKE ALL ON FUNCTION snp_contrat_execution(uuid) FROM public;
GRANT EXECUTE ON FUNCTION snp_contrat_execution(uuid) TO authenticated;


/* ═════════════════════════════════════════════════════════ Échéancier ══ */

CREATE OR REPLACE FUNCTION snp_generer_echeancier(p_contrat_id uuid, p_ecraser boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  v_contrat snp_contrats%ROWTYPE;
  v_pas interval; v_debut date; v_fin date;
  v_rang int := 0; v_nb int; v_quantite numeric;
BEGIN
  IF NOT snp_est_agent_sonasp() THEN
    RAISE EXCEPTION 'Seul un agent de la SONASP peut composer un echeancier.';
  END IF;

  SELECT * INTO v_contrat FROM snp_contrats WHERE id = p_contrat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrat introuvable.'; END IF;

  IF v_contrat.statut NOT IN ('brouillon', 'soumis', 'revue_juridique',
                              'validation_metier', 'validation_financiere') THEN
    RAISE EXCEPTION 'L''echeancier d''un contrat % ne se recompose plus.', v_contrat.statut;
  END IF;

  IF COALESCE(v_contrat.quantite_totale, 0) <= 0 THEN
    RAISE EXCEPTION 'Renseignez la quantite totale avant de composer l''echeancier.';
  END IF;

  IF EXISTS (SELECT 1 FROM snp_contrats_echeancier WHERE contrat_id = p_contrat_id) THEN
    IF NOT p_ecraser THEN
      RAISE EXCEPTION 'Un echeancier existe deja : demandez son remplacement pour le recomposer.';
    END IF;
    DELETE FROM snp_contrats_echeancier WHERE contrat_id = p_contrat_id;
  END IF;

  v_pas := CASE v_contrat.periodicite
    WHEN 'hebdomadaire' THEN interval '1 week'
    WHEN 'mensuelle' THEN interval '1 month'
    WHEN 'trimestrielle' THEN interval '3 months'
    ELSE NULL END;

  -- Une périodicité unique ou personnalisée ne se déduit pas : elle se saisit.
  IF v_pas IS NULL THEN
    INSERT INTO snp_contrats_echeancier (contrat_id, periode_debut, periode_fin, annee, mois, rang,
                                         quantite_prevue, quantite_minimale, nature)
    VALUES (p_contrat_id, v_contrat.date_debut, v_contrat.date_fin,
            extract(year FROM v_contrat.date_debut)::int,
            extract(month FROM v_contrat.date_debut)::int, 1,
            v_contrat.quantite_totale, v_contrat.quantite_minimale, 'ferme');
    RETURN 1;
  END IF;

  SELECT count(*)::int INTO v_nb
  FROM generate_series(v_contrat.date_debut, v_contrat.date_fin, v_pas) d;
  IF v_nb = 0 THEN RETURN 0; END IF;
  v_quantite := round(v_contrat.quantite_totale / v_nb, 4);

  FOR v_debut IN SELECT d::date FROM generate_series(v_contrat.date_debut, v_contrat.date_fin, v_pas) d
  LOOP
    v_rang := v_rang + 1;
    v_fin := LEAST(v_contrat.date_fin, (v_debut + v_pas - interval '1 day')::date);
    INSERT INTO snp_contrats_echeancier (contrat_id, periode_debut, periode_fin, annee, mois, rang,
                                         quantite_prevue, nature)
    VALUES (p_contrat_id, v_debut, v_fin,
            extract(year FROM v_debut)::int, extract(month FROM v_debut)::int, v_rang,
            -- Le reliquat d'arrondi se pose sur la dernière période : la somme
            -- des périodes doit faire la quantité totale.
            CASE WHEN v_rang = v_nb THEN v_contrat.quantite_totale - v_quantite * (v_nb - 1)
                 ELSE v_quantite END,
            'ferme');
  END LOOP;

  RETURN v_rang;
END $fn$;

REVOKE ALL ON FUNCTION snp_generer_echeancier(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION snp_generer_echeancier(uuid, boolean) TO authenticated;


/* ═══════════════════════════════════════════════ Changement d'état ══ */

-- Les contrôles sont ici, non à l'écran : masquer un bouton ne protège rien.
CREATE OR REPLACE FUNCTION snp_changer_statut_contrat(
  p_contrat_id uuid, p_statut text, p_motif text DEFAULT NULL, p_commentaire text DEFAULT NULL)
RETURNS snp_contrats LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  v_contrat snp_contrats%ROWTYPE;
  v_avant text; v_validateurs int; v_echeances int; v_signe int;
BEGIN
  IF NOT snp_est_agent_sonasp() THEN
    RAISE EXCEPTION 'Seul un agent de la SONASP peut faire evoluer un contrat.';
  END IF;

  SELECT * INTO v_contrat FROM snp_contrats WHERE id = p_contrat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrat introuvable.'; END IF;
  v_avant := v_contrat.statut;

  IF NOT (p_statut = ANY (snp_transitions_contrat(v_avant))) THEN
    RAISE EXCEPTION 'Un contrat % ne peut pas passer a l''etat %.', v_avant, p_statut;
  END IF;

  IF p_statut IN ('rejete', 'suspendu', 'resilie', 'annule')
     AND (p_motif IS NULL OR length(trim(p_motif)) < 5) THEN
    RAISE EXCEPTION 'Cette decision demande un motif d''au moins cinq caracteres.';
  END IF;

  IF p_statut IN ('approuve', 'actif', 'resilie') AND NOT snp_peut_valider() THEN
    RAISE EXCEPTION 'Votre role ne permet pas cette decision.';
  END IF;

  -- Séparation des fonctions : on n'approuve pas le contrat qu'on a préparé,
  -- sauf si la plateforme ne compte qu'un seul validateur connectable.
  IF p_statut = 'approuve' AND v_contrat.created_by = auth.uid() THEN
    SELECT count(*)::int INTO v_validateurs
    FROM user_profiles up JOIN auth.users au ON au.id = up.id
    WHERE up.is_active AND up.mining_company_id IS NULL
      AND up.role IN ('owner', 'admin', 'management');
    IF v_validateurs > 1 THEN
      RAISE EXCEPTION 'Le contrat doit etre approuve par une autre personne que celle qui l''a prepare.';
    END IF;
  END IF;

  -- Un contrat ne devient actif qu'une fois réellement en état de l'être.
  IF p_statut = 'actif' THEN
    IF v_contrat.date_signature IS NULL THEN
      RAISE EXCEPTION 'La date de signature manque : un contrat non signe ne s''execute pas.';
    END IF;
    IF COALESCE(v_contrat.quantite_totale, 0) <= 0 THEN
      RAISE EXCEPTION 'La quantite totale engagee n''est pas renseignee.';
    END IF;
    SELECT count(*)::int INTO v_echeances FROM snp_contrats_echeancier WHERE contrat_id = p_contrat_id;
    IF v_echeances = 0 THEN
      RAISE EXCEPTION 'L''echeancier est vide : composez-le avant d''activer le contrat.';
    END IF;
    SELECT count(*)::int INTO v_signe FROM snp_contrats_documents
    WHERE contrat_id = p_contrat_id AND categorie = 'contrat_signe' AND statut = 'actif';
    IF v_signe = 0 THEN
      RAISE EXCEPTION 'Le contrat signe n''est pas verse au dossier.';
    END IF;
  END IF;

  UPDATE snp_contrats SET
    statut = p_statut,
    motif_statut = CASE WHEN p_statut IN ('rejete', 'suspendu', 'resilie', 'annule')
                     THEN p_motif ELSE motif_statut END,
    date_soumission = CASE WHEN p_statut = 'soumis' THEN now() ELSE date_soumission END,
    date_approbation = CASE WHEN p_statut = 'approuve' THEN now() ELSE date_approbation END,
    approuve_par = CASE WHEN p_statut = 'approuve' THEN auth.uid() ELSE approuve_par END,
    date_activation = CASE WHEN p_statut = 'actif' AND date_activation IS NULL
                        THEN now() ELSE date_activation END,
    date_cloture = CASE WHEN p_statut IN ('cloture', 'resilie') THEN now() ELSE date_cloture END,
    updated_by = auth.uid()
  WHERE id = p_contrat_id
  RETURNING * INTO v_contrat;

  INSERT INTO snp_contrats_historique (contrat_id, statut_avant, statut_apres, motif, commentaire, acteur_id)
  VALUES (p_contrat_id, v_avant, p_statut, p_motif, p_commentaire, auth.uid());

  RETURN v_contrat;
END $fn$;

REVOKE ALL ON FUNCTION snp_changer_statut_contrat(uuid, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION snp_changer_statut_contrat(uuid, text, text, text) TO authenticated;


/* ══════════════════════════════════════ Teneur, dépassement et plan ══ */

-- Les seuils viennent du contrat, jamais du code : deux contrats du même mois
-- peuvent poser des tolérances différentes, et c'est le contrat qui fait foi.
CREATE OR REPLACE FUNCTION snp_evaluer_teneur(
  p_contrat_id uuid, p_teneur_declaree numeric, p_teneur_analysee numeric)
RETURNS TABLE (
  ecart_absolu numeric, ecart_relatif_pct numeric, dans_tolerance boolean,
  sous_minimum boolean, decision text, teneur_retenue numeric,
  prix_a_recalculer boolean, explication text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  c snp_contrats%ROWTYPE;
  v_ecart numeric; v_relatif numeric; v_tolerance numeric;
  v_retenue numeric; v_decision text; v_explication text;
BEGIN
  SELECT * INTO c FROM snp_contrats WHERE id = p_contrat_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrat introuvable.'; END IF;
  IF p_teneur_declaree IS NULL OR p_teneur_analysee IS NULL THEN
    RAISE EXCEPTION 'Les deux teneurs sont necessaires pour trancher.';
  END IF;

  v_tolerance := COALESCE(c.teneur_tolerance_pct, 0);
  v_ecart := abs(p_teneur_declaree - p_teneur_analysee);
  v_relatif := CASE WHEN p_teneur_declaree > 0
    THEN round(v_ecart * 100 / p_teneur_declaree, 4) ELSE NULL END;

  v_retenue := CASE c.teneur_faisant_foi
    WHEN 'analyse_fournisseur' THEN p_teneur_declaree
    WHEN 'moyenne' THEN round((p_teneur_declaree + p_teneur_analysee) / 2, 3)
    ELSE p_teneur_analysee END;

  IF c.teneur_minimale_pct IS NOT NULL AND p_teneur_analysee < c.teneur_minimale_pct THEN
    v_decision := 'non_conformite';
    v_explication := format(
      'Teneur analysee de %s %%, sous le minimum contractuel de %s %%. La livraison est retenue et un defaut doit etre ouvert.',
      trim(to_char(p_teneur_analysee, 'FM9990.999')),
      trim(to_char(c.teneur_minimale_pct, 'FM9990.999')));
  ELSIF v_ecart <= v_tolerance THEN
    v_decision := 'acceptee';
    v_explication := format('Ecart de %s point(s), dans la tolerance de %s. La livraison est acceptee.',
      trim(to_char(v_ecart, 'FM9990.999')), trim(to_char(v_tolerance, 'FM9990.999')));
  ELSIF v_ecart <= v_tolerance * 2 THEN
    v_decision := 'contre_analyse';
    v_explication := format(
      'Ecart de %s point(s), au-dela de la tolerance de %s. Une contre-analyse est requise avant facturation.',
      trim(to_char(v_ecart, 'FM9990.999')), trim(to_char(v_tolerance, 'FM9990.999')));
  ELSE
    v_decision := 'laboratoire_independant';
    v_explication := format(
      'Ecart de %s point(s), plus du double de la tolerance. Le laboratoire independant doit etre saisi ; les frais suivent la clause de contre-expertise.',
      trim(to_char(v_ecart, 'FM9990.999')));
  END IF;

  RETURN QUERY SELECT v_ecart, v_relatif, v_ecart <= v_tolerance,
    c.teneur_minimale_pct IS NOT NULL AND p_teneur_analysee < c.teneur_minimale_pct,
    v_decision, v_retenue,
    COALESCE(c.prix_ajuste_sur_teneur, false) AND v_retenue <> p_teneur_declaree,
    v_explication;
END $fn$;

REVOKE ALL ON FUNCTION snp_evaluer_teneur(uuid, numeric, numeric) FROM public;
GRANT EXECUTE ON FUNCTION snp_evaluer_teneur(uuid, numeric, numeric) TO authenticated;


-- Contrats actifs sur une période, avec ce qu'ils y engagent. C'est la source
-- du plan d'achat mensuel.
CREATE OR REPLACE FUNCTION snp_contrats_actifs_periode(p_debut date, p_fin date)
RETURNS TABLE (
  contrat_id uuid, numero_contrat text, intitule text, partenaire_type text,
  mining_company_id uuid, artisan_id uuid, site_id uuid, partenaire text, unite text,
  quantite_periode numeric, nature text, reliquat_anterieur numeric,
  deja_livre_periode numeric, restant_a_collecter numeric,
  tolerance_quantite_pct numeric, plafond_depassement_pct numeric,
  report_reliquat text, date_fin date
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT
    c.id, c.numero_contrat, c.intitule, c.partenaire_type,
    c.mining_company_id, c.artisan_id, c.site_id,
    COALESCE(mc.name, NULLIF(trim(COALESCE(am.raison_sociale, '')), ''),
             NULLIF(trim(COALESCE(am.nom, '') || ' ' || COALESCE(am.prenoms, '')), ''),
             s.name, c.partenaire_libelle, 'Partenaire non nomme'),
    c.unite,
    COALESCE(p.quantite, 0),
    COALESCE(p.nature, 'ferme'),
    -- Le reliquat ne se reporte que si le contrat l'autorise : une clause de
    -- non-report interdit de rattraper un mois manqué.
    CASE WHEN c.report_reliquat = 'interdit' THEN 0
         ELSE GREATEST(0, COALESCE(ant.prevu, 0) - COALESCE(ant.livre, 0)) END,
    COALESCE(liv.quantite, 0),
    GREATEST(0, COALESCE(p.quantite, 0)
                + CASE WHEN c.report_reliquat = 'interdit' THEN 0
                       ELSE GREATEST(0, COALESCE(ant.prevu, 0) - COALESCE(ant.livre, 0)) END
                - COALESCE(liv.quantite, 0)),
    c.tolerance_quantite_pct, c.plafond_depassement_pct, c.report_reliquat, c.date_fin
  FROM snp_contrats c
  LEFT JOIN mining_companies mc ON mc.id = c.mining_company_id
  LEFT JOIN snp_artisans_miniers am ON am.id = c.artisan_id
  LEFT JOIN sites s ON s.id = c.site_id
  LEFT JOIN LATERAL (
    SELECT sum(e.quantite_prevue) AS quantite, min(e.nature) AS nature
    FROM snp_contrats_echeancier e
    WHERE e.contrat_id = c.id AND e.periode_debut <= p_fin AND e.periode_fin >= p_debut
  ) p ON true
  LEFT JOIN LATERAL (
    SELECT sum(e.quantite_prevue) AS prevu,
           (SELECT COALESCE(sum(a.quantite_imputee_oz), 0) FROM snp_achats_mines a
             WHERE a.contrat_id = c.id AND a.statut <> 'annulee' AND a.periode_fin < p_debut) AS livre
    FROM snp_contrats_echeancier e
    WHERE e.contrat_id = c.id AND e.nature = 'ferme' AND e.periode_fin < p_debut
  ) ant ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(sum(a.quantite_oz), 0) AS quantite FROM snp_achats_mines a
    WHERE a.contrat_id = c.id AND a.statut <> 'annulee'
      AND a.periode_debut <= p_fin AND a.periode_fin >= p_debut
  ) liv ON true
  WHERE c.statut = 'actif' AND c.date_debut <= p_fin AND c.date_fin >= p_debut
  ORDER BY 8;
$fn$;

REVOKE ALL ON FUNCTION snp_contrats_actifs_periode(date, date) FROM public;
GRANT EXECUTE ON FUNCTION snp_contrats_actifs_periode(date, date) TO authenticated;


CREATE OR REPLACE FUNCTION snp_evaluer_depassement(
  p_contrat_id uuid, p_debut date, p_fin date, p_quantite numeric)
RETURNS TABLE (
  quantite_prevue numeric, reliquat_anterieur numeric, plafond numeric,
  depassement numeric, autorise boolean, report_possible boolean,
  decision text, explication text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  c snp_contrats%ROWTYPE; v record;
  v_plafond numeric; v_depassement numeric; v_reste_contrat numeric;
  v_report boolean; v_decision text; v_explication text;
BEGIN
  SELECT * INTO c FROM snp_contrats WHERE id = p_contrat_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrat introuvable.'; END IF;

  SELECT * INTO v FROM snp_contrats_actifs_periode(p_debut, p_fin) t WHERE t.contrat_id = p_contrat_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ce contrat n''est pas actif sur la periode demandee.'; END IF;

  v_plafond := (v.quantite_periode + v.reliquat_anterieur)
               * (1 + COALESCE(c.plafond_depassement_pct, 0) / 100);
  v_depassement := GREATEST(0, p_quantite - (v.quantite_periode + v.reliquat_anterieur));

  SELECT GREATEST(0, COALESCE(c.quantite_totale, 0) - COALESCE(e.quantite_imputee, 0))
  INTO v_reste_contrat FROM snp_contrat_execution(p_contrat_id) e;

  -- Un report ne vaut que s'il reste une période pour l'accueillir.
  v_report := c.report_reliquat <> 'interdit' AND p_fin < c.date_fin;

  IF v_depassement <= 0 THEN
    v_decision := 'conforme';
    v_explication := 'La quantite reste dans l''engagement de la periode.';
  ELSIF p_quantite > v_reste_contrat THEN
    v_decision := 'avenant_requis';
    v_explication := format('La quantite depasse de %s ce qui reste du contrat. Un avenant est necessaire.',
      trim(to_char(p_quantite - v_reste_contrat, 'FM999999990.9999')));
  ELSIF p_quantite <= v_plafond THEN
    v_decision := 'depassement_tolere';
    v_explication := format(
      'Depassement de %s, dans le plafond de %s %% que le contrat autorise. Une justification est demandee.',
      trim(to_char(v_depassement, 'FM999999990.9999')),
      trim(to_char(COALESCE(c.plafond_depassement_pct, 0), 'FM9990.999')));
  ELSIF v_report THEN
    v_decision := 'imputation_periode_suivante';
    v_explication := format(
      'Depassement de %s au-dela du plafond. Il s''impute sur la periode suivante, que le contrat autorise a reporter.',
      trim(to_char(v_depassement, 'FM999999990.9999')));
  ELSE
    v_decision := 'autorisation_exceptionnelle';
    v_explication := format(
      'Depassement de %s au-dela du plafond, sans report possible avant le %s. Une autorisation exceptionnelle est requise.',
      trim(to_char(v_depassement, 'FM999999990.9999')), to_char(c.date_fin, 'DD/MM/YYYY'));
  END IF;

  RETURN QUERY SELECT v.quantite_periode, v.reliquat_anterieur, v_plafond, v_depassement,
    v_depassement = 0 OR p_quantite <= v_plafond, v_report, v_decision, v_explication;
END $fn$;

REVOKE ALL ON FUNCTION snp_evaluer_depassement(uuid, date, date, numeric) FROM public;
GRANT EXECUTE ON FUNCTION snp_evaluer_depassement(uuid, date, date, numeric) TO authenticated;


-- Le plan mensuel reprend les engagements contractuels du mois. La répartition
-- existante n'est pas remplacée : cette fonction se pose par dessus et ne
-- touche qu'aux lignes des mines sous contrat actif.
CREATE OR REPLACE FUNCTION snp_appliquer_contrats_au_plan(
  p_plan_id uuid, p_ecraser_ajustements boolean DEFAULT false)
RETURNS TABLE (
  lignes_rattachees integer, lignes_creees integer, lignes_preservees integer,
  quantite_contractuelle numeric, quantite_reliquat numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  v_plan snp_plans_achat%ROWTYPE;
  v_debut date; v_fin date; v_contrat record; v_ligne_id uuid;
  v_assiette numeric; v_cible numeric; v_ajustee boolean;
  v_rattachees int := 0; v_creees int := 0; v_preservees int := 0;
  v_contractuelle numeric := 0; v_reliquat numeric := 0;
BEGIN
  IF NOT snp_est_agent_sonasp() THEN
    RAISE EXCEPTION 'Seul un agent de la SONASP peut appliquer les contrats a un plan.';
  END IF;

  SELECT * INTO v_plan FROM snp_plans_achat WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan introuvable.'; END IF;
  IF v_plan.statut NOT IN ('brouillon', 'pret_soumission') THEN
    RAISE EXCEPTION 'Un plan % ne se recompose plus.', v_plan.statut;
  END IF;

  v_debut := make_date(v_plan.annee, v_plan.mois, 1);
  v_fin := (v_debut + interval '1 month - 1 day')::date;

  FOR v_contrat IN
    SELECT * FROM snp_contrats_actifs_periode(v_debut, v_fin) WHERE mining_company_id IS NOT NULL
  LOOP
    v_contractuelle := v_contractuelle + COALESCE(v_contrat.quantite_periode, 0);
    v_reliquat := v_reliquat + COALESCE(v_contrat.reliquat_anterieur, 0);

    SELECT id, ajustee_manuellement INTO v_ligne_id, v_ajustee
    FROM snp_plans_achat_lignes
    WHERE plan_id = p_plan_id AND mining_company_id = v_contrat.mining_company_id;

    IF FOUND AND v_ajustee AND NOT p_ecraser_ajustements THEN
      -- On rattache tout de même le contrat : la ligne doit savoir d'où elle
      -- vient, même si sa quantité a été arbitrée à la main.
      UPDATE snp_plans_achat_lignes
      SET contrat_id = v_contrat.contrat_id,
          quantite_contractuelle_oz = COALESCE(v_contrat.quantite_periode, 0),
          reliquat_anterieur_oz = COALESCE(v_contrat.reliquat_anterieur, 0)
      WHERE id = v_ligne_id;
      v_preservees := v_preservees + 1;
      CONTINUE;
    END IF;

    SELECT COALESCE(a.eligible, 0) INTO v_assiette
    FROM snp_assiette_achat(v_debut, v_fin) a
    WHERE a.mining_company_id = v_contrat.mining_company_id;

    v_cible := COALESCE(v_contrat.quantite_periode, 0) + COALESCE(v_contrat.reliquat_anterieur, 0);
    v_cible := LEAST(v_cible, COALESCE(v_assiette, 0));

    IF v_ligne_id IS NOT NULL THEN
      UPDATE snp_plans_achat_lignes
      SET contrat_id = v_contrat.contrat_id,
          quantite_contractuelle_oz = COALESCE(v_contrat.quantite_periode, 0),
          reliquat_anterieur_oz = COALESCE(v_contrat.reliquat_anterieur, 0),
          quantite_proposee_oz = v_cible,
          prix_once_fcfa = COALESCE(v_plan.prix_once_global_fcfa, prix_once_fcfa),
          depassement_oz = GREATEST(0, v_cible
            - (COALESCE(v_contrat.quantite_periode, 0) + COALESCE(v_contrat.reliquat_anterieur, 0))),
          ajustee_manuellement = false
      WHERE id = v_ligne_id;
      v_rattachees := v_rattachees + 1;
    ELSE
      INSERT INTO snp_plans_achat_lignes (
        plan_id, mining_company_id, periode_debut, periode_fin,
        production_eligible_oz, quantite_proposee_oz, prix_once_fcfa, statut,
        contrat_id, quantite_contractuelle_oz, reliquat_anterieur_oz)
      VALUES (p_plan_id, v_contrat.mining_company_id, v_debut, v_fin,
        COALESCE(v_assiette, 0), v_cible, COALESCE(v_plan.prix_once_global_fcfa, 0), 'brouillon',
        v_contrat.contrat_id, COALESCE(v_contrat.quantite_periode, 0),
        COALESCE(v_contrat.reliquat_anterieur, 0));
      v_creees := v_creees + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_rattachees, v_creees, v_preservees, v_contractuelle, v_reliquat;
END $fn$;

REVOKE ALL ON FUNCTION snp_appliquer_contrats_au_plan(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION snp_appliquer_contrats_au_plan(uuid, boolean) TO authenticated;

COMMENT ON FUNCTION snp_appliquer_contrats_au_plan(uuid, boolean) IS
  'Porte les engagements contractuels du mois sur les lignes du plan d''achat, reliquat compris.';
