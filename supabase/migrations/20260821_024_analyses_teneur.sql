-- ---------------------------------------------------------------------------
-- Analyses de teneur : aucun résultat initial n'est écrasé
--
-- Le cahier des charges est explicite : la teneur déclarée par la mine, le
-- résultat du premier laboratoire, celui de la contre-analyse et celui du
-- laboratoire indépendant se conservent SÉPARÉMENT, avec leurs dates, leurs
-- certificats et leurs responsables.
--
-- La garantie n'est pas laissée à la bonne volonté de l'écran : les résultats
-- vivent dans une table propre, et un déclencheur y refuse toute modification
-- ou suppression isolée. Un résultat faux se corrige en enregistrant le
-- suivant, pas en effaçant le précédent.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS snp_analyses_teneur (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,

  mining_company_id uuid REFERENCES mining_companies(id) ON DELETE RESTRICT,
  contrat_id uuid REFERENCES snp_contrats(id) ON DELETE SET NULL,
  requisition_id uuid REFERENCES snp_requisitions(id) ON DELETE SET NULL,
  enlevement_id uuid REFERENCES snp_requisitions_enlevements(id) ON DELETE SET NULL,
  achat_id uuid REFERENCES snp_achats_mines(id) ON DELETE SET NULL,

  numero_echantillon text,
  date_prelevement date,
  masse_echantillon_g numeric(18, 3),
  masse_lot_oz numeric(18, 4),
  methode_echantillonnage text,
  lieu_prelevement text,

  -- Ce que la mine déclare. Cette valeur ne bouge plus une fois posée.
  teneur_declaree_pct numeric(6, 3) NOT NULL,
  declaree_par text,
  date_declaration date,

  -- Ce que la SONASP retient, après instruction.
  teneur_retenue_pct numeric(6, 3),
  justification_retenue text,
  retenue_par uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  retenue_le timestamptz,

  decision text,
  statut text NOT NULL DEFAULT 'en_attente',
  motif_statut text,
  observations text,

  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_analyse_teneur_declaree CHECK (
    teneur_declaree_pct > 0 AND teneur_declaree_pct <= 100),
  CONSTRAINT snp_analyse_teneur_retenue CHECK (
    teneur_retenue_pct IS NULL OR (teneur_retenue_pct > 0 AND teneur_retenue_pct <= 100)),
  CONSTRAINT snp_analyse_statut CHECK (statut IN
    ('en_attente', 'analysee', 'contre_analyse_requise', 'laboratoire_independant_requis',
     'tranchee', 'non_conforme', 'annulee')),
  CONSTRAINT snp_analyse_decision CHECK (decision IS NULL OR decision IN
    ('acceptee', 'contre_analyse', 'laboratoire_independant', 'non_conformite')),
  -- Trancher, c'est justifier : une teneur retenue sans motif serait un choix
  -- sans trace, et c'est elle qui sert à facturer.
  CONSTRAINT snp_analyse_tranchee_motivee CHECK (
    statut <> 'tranchee'
    OR (teneur_retenue_pct IS NOT NULL AND justification_retenue IS NOT NULL
        AND length(trim(justification_retenue)) >= 10)
  ),
  CONSTRAINT snp_analyse_rattachee CHECK (
    contrat_id IS NOT NULL OR requisition_id IS NOT NULL
    OR achat_id IS NOT NULL OR mining_company_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_snp_analyses_contrat ON snp_analyses_teneur (contrat_id);
CREATE INDEX IF NOT EXISTS idx_snp_analyses_requisition ON snp_analyses_teneur (requisition_id);
CREATE INDEX IF NOT EXISTS idx_snp_analyses_statut ON snp_analyses_teneur (statut);

COMMENT ON TABLE snp_analyses_teneur IS
  'Instruction de la teneur d''un lot : déclaration de la mine, analyses successives, teneur finalement retenue.';


CREATE TABLE IF NOT EXISTS snp_analyses_resultats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analyse_id uuid NOT NULL REFERENCES snp_analyses_teneur(id) ON DELETE CASCADE,
  rang integer NOT NULL,
  origine text NOT NULL,
  laboratoire text NOT NULL,
  laboratoire_independant boolean NOT NULL DEFAULT false,
  methode text,
  teneur_pct numeric(6, 3) NOT NULL,
  argent_pct numeric(6, 3),
  certificat_reference text,
  date_analyse date,
  analyste text,
  document_chemin text,
  observations text,
  enregistre_par uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_resultat_teneur CHECK (teneur_pct > 0 AND teneur_pct <= 100),
  CONSTRAINT snp_resultat_origine CHECK (origine IN
    ('analyse_initiale', 'contre_analyse', 'laboratoire_independant', 'arbitrage')),
  CONSTRAINT snp_resultat_rang UNIQUE (analyse_id, rang)
);

CREATE INDEX IF NOT EXISTS idx_snp_resultats_analyse ON snp_analyses_resultats (analyse_id, rang);

COMMENT ON TABLE snp_analyses_resultats IS
  'Résultats successifs d''une analyse de teneur. Un résultat ne se modifie ni ne s''efface isolément.';


-- La garantie structurelle. Elle laisse passer la cascade — reconnaissable au
-- fait que la ligne mère a déjà disparu — parce que retirer l'instruction
-- entière est un autre geste : réservé aux agents de la SONASP par RLS, et
-- tracé en entier par `snp_auditer` sur la ligne mère.
CREATE OR REPLACE FUNCTION snp_resultat_immuable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF TG_OP = 'DELETE'
     AND NOT EXISTS (SELECT 1 FROM snp_analyses_teneur WHERE id = OLD.analyse_id) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION
    'Un resultat d''analyse ne se % pas : enregistrez le resultat suivant, l''historique doit rester entier.',
    CASE WHEN TG_OP = 'DELETE' THEN 'supprime' ELSE 'modifie' END;
END $fn$;

DROP TRIGGER IF EXISTS trg_snp_resultats_immuables ON snp_analyses_resultats;
CREATE TRIGGER trg_snp_resultats_immuables BEFORE UPDATE OR DELETE ON snp_analyses_resultats
  FOR EACH ROW EXECUTE FUNCTION snp_resultat_immuable();

DROP TRIGGER IF EXISTS trg_snp_analyses_touch ON snp_analyses_teneur;
CREATE TRIGGER trg_snp_analyses_touch BEFORE UPDATE ON snp_analyses_teneur
  FOR EACH ROW EXECUTE FUNCTION snp_touch_updated_at();

DROP TRIGGER IF EXISTS trg_snp_analyses_audit ON snp_analyses_teneur;
CREATE TRIGGER trg_snp_analyses_audit AFTER INSERT OR UPDATE OR DELETE ON snp_analyses_teneur
  FOR EACH ROW EXECUTE FUNCTION snp_auditer();

DROP TRIGGER IF EXISTS trg_snp_resultats_audit ON snp_analyses_resultats;
CREATE TRIGGER trg_snp_resultats_audit AFTER INSERT ON snp_analyses_resultats
  FOR EACH ROW EXECUTE FUNCTION snp_auditer();


CREATE OR REPLACE FUNCTION snp_numeroter_analyse()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
BEGIN
  IF NEW.reference IS NULL OR length(trim(NEW.reference)) = 0 THEN
    NEW.reference := snp_numero_suivant('ANA',
      extract(year FROM COALESCE(NEW.date_prelevement, CURRENT_DATE))::int,
      'snp_analyses_teneur'::regclass, 'reference');
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_snp_analyses_numero ON snp_analyses_teneur;
CREATE TRIGGER trg_snp_analyses_numero BEFORE INSERT ON snp_analyses_teneur
  FOR EACH ROW EXECUTE FUNCTION snp_numeroter_analyse();


ALTER TABLE snp_analyses_teneur ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_analyses_resultats ENABLE ROW LEVEL SECURITY;

-- La mine voit l'instruction qui la concerne : c'est sa matière, et le résultat
-- décide de ce qu'elle sera payée.
DROP POLICY IF EXISTS "Analyses lisibles par la SONASP ou la mine" ON snp_analyses_teneur;
CREATE POLICY "Analyses lisibles par la SONASP ou la mine" ON snp_analyses_teneur
  FOR SELECT USING (snp_est_agent_sonasp() OR mining_company_id = snp_societe_utilisateur());

DROP POLICY IF EXISTS "Analyses ecrites par la SONASP" ON snp_analyses_teneur;
CREATE POLICY "Analyses ecrites par la SONASP" ON snp_analyses_teneur
  FOR ALL USING (snp_est_agent_sonasp()) WITH CHECK (snp_est_agent_sonasp());

DROP POLICY IF EXISTS "Resultats lisibles avec leur analyse" ON snp_analyses_resultats;
CREATE POLICY "Resultats lisibles avec leur analyse" ON snp_analyses_resultats
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM snp_analyses_teneur a WHERE a.id = snp_analyses_resultats.analyse_id
  ));

DROP POLICY IF EXISTS "Resultats ecrits par la SONASP" ON snp_analyses_resultats;
CREATE POLICY "Resultats ecrits par la SONASP" ON snp_analyses_resultats
  FOR INSERT WITH CHECK (snp_est_agent_sonasp());


/* ═════════════════════════════════════════════════════════ Opérations ══ */

-- Le rang se calcule : première analyse, contre-analyse, laboratoire
-- indépendant. La décision qui suit vient du contrat quand il y en a un, et
-- reste à l'appréciation motivée sinon — un lot acheté au comptant n'a pas de
-- contrat, et il faut tout de même pouvoir trancher.
CREATE OR REPLACE FUNCTION snp_enregistrer_resultat_analyse(
  p_analyse_id uuid, p_laboratoire text, p_teneur_pct numeric,
  p_methode text DEFAULT NULL, p_certificat text DEFAULT NULL,
  p_date_analyse date DEFAULT NULL, p_analyste text DEFAULT NULL,
  p_laboratoire_independant boolean DEFAULT false, p_argent_pct numeric DEFAULT NULL,
  p_document_chemin text DEFAULT NULL, p_observations text DEFAULT NULL)
RETURNS snp_analyses_resultats
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  a snp_analyses_teneur%ROWTYPE;
  res snp_analyses_resultats%ROWTYPE;
  v_rang int; v_origine text; v_eval record; v_statut text;
BEGIN
  IF NOT snp_est_agent_sonasp() THEN
    RAISE EXCEPTION 'Seul un agent de la SONASP peut enregistrer un resultat d''analyse.';
  END IF;

  SELECT * INTO a FROM snp_analyses_teneur WHERE id = p_analyse_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Analyse introuvable.'; END IF;

  IF a.statut IN ('tranchee', 'annulee') THEN
    RAISE EXCEPTION 'Cette analyse est %: elle ne recoit plus de resultat.',
      CASE a.statut WHEN 'tranchee' THEN 'tranchee' ELSE 'annulee' END;
  END IF;

  IF p_laboratoire IS NULL OR length(trim(p_laboratoire)) = 0 THEN
    RAISE EXCEPTION 'Nommez le laboratoire qui a produit ce resultat.';
  END IF;
  IF NOT (p_teneur_pct > 0 AND p_teneur_pct <= 100) THEN
    RAISE EXCEPTION 'La teneur doit etre comprise entre 0 et 100 %%.';
  END IF;

  SELECT COALESCE(max(rang), 0) + 1 INTO v_rang
  FROM snp_analyses_resultats WHERE analyse_id = p_analyse_id;

  v_origine := CASE
    WHEN p_laboratoire_independant THEN 'laboratoire_independant'
    WHEN v_rang = 1 THEN 'analyse_initiale'
    WHEN v_rang = 2 THEN 'contre_analyse'
    ELSE 'arbitrage' END;

  INSERT INTO snp_analyses_resultats (
    analyse_id, rang, origine, laboratoire, laboratoire_independant, methode,
    teneur_pct, argent_pct, certificat_reference, date_analyse, analyste,
    document_chemin, observations, enregistre_par)
  VALUES (
    p_analyse_id, v_rang, v_origine, trim(p_laboratoire), p_laboratoire_independant, p_methode,
    p_teneur_pct, p_argent_pct, p_certificat, COALESCE(p_date_analyse, CURRENT_DATE), p_analyste,
    p_document_chemin, p_observations, auth.uid())
  RETURNING * INTO res;

  IF a.contrat_id IS NOT NULL THEN
    SELECT * INTO v_eval FROM snp_evaluer_teneur(a.contrat_id, a.teneur_declaree_pct, p_teneur_pct);
    v_statut := CASE v_eval.decision
      WHEN 'acceptee' THEN 'analysee'
      WHEN 'contre_analyse' THEN 'contre_analyse_requise'
      WHEN 'laboratoire_independant' THEN 'laboratoire_independant_requis'
      ELSE 'non_conforme' END;
    -- Un laboratoire indépendant a déjà tranché le fond : on ne redemande pas
    -- une expertise après l'expertise.
    IF p_laboratoire_independant
       AND v_statut IN ('contre_analyse_requise', 'laboratoire_independant_requis') THEN
      v_statut := 'analysee';
    END IF;
    UPDATE snp_analyses_teneur
    SET decision = v_eval.decision, statut = v_statut, updated_by = auth.uid()
    WHERE id = p_analyse_id;
  ELSE
    UPDATE snp_analyses_teneur SET statut = 'analysee', updated_by = auth.uid()
    WHERE id = p_analyse_id;
  END IF;

  RETURN res;
END $fn$;

REVOKE ALL ON FUNCTION snp_enregistrer_resultat_analyse(uuid, text, numeric, text, text, date, text, boolean, numeric, text, text) FROM public;
GRANT EXECUTE ON FUNCTION snp_enregistrer_resultat_analyse(uuid, text, numeric, text, text, date, text, boolean, numeric, text, text) TO authenticated;


-- Trancher : la teneur retenue et sa justification. C'est elle qui servira à
-- facturer, et c'est pourquoi elle demande une habilitation de validation.
CREATE OR REPLACE FUNCTION snp_trancher_teneur(
  p_analyse_id uuid, p_teneur_retenue numeric, p_justification text)
RETURNS snp_analyses_teneur
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE
  a snp_analyses_teneur%ROWTYPE;
  v_resultats int;
BEGIN
  IF NOT snp_peut_valider() THEN
    RAISE EXCEPTION 'Votre role ne permet pas d''arreter la teneur retenue.';
  END IF;

  SELECT * INTO a FROM snp_analyses_teneur WHERE id = p_analyse_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Analyse introuvable.'; END IF;
  IF a.statut = 'annulee' THEN RAISE EXCEPTION 'Cette analyse est annulee.'; END IF;
  IF a.statut = 'tranchee' THEN
    RAISE EXCEPTION 'La teneur de cette analyse est deja arretee.';
  END IF;

  SELECT count(*)::int INTO v_resultats FROM snp_analyses_resultats WHERE analyse_id = p_analyse_id;
  IF v_resultats = 0 THEN
    RAISE EXCEPTION 'Aucun resultat de laboratoire : il n''y a rien a trancher.';
  END IF;

  IF a.statut = 'contre_analyse_requise' THEN
    RAISE EXCEPTION 'L''ecart appelle une contre-analyse : enregistrez-la avant d''arreter la teneur.';
  END IF;
  IF a.statut = 'laboratoire_independant_requis' THEN
    RAISE EXCEPTION 'L''ecart appelle le laboratoire independant : enregistrez son resultat avant d''arreter la teneur.';
  END IF;

  IF p_justification IS NULL OR length(trim(p_justification)) < 10 THEN
    RAISE EXCEPTION 'La teneur retenue demande une justification d''au moins dix caracteres.';
  END IF;
  IF NOT (p_teneur_retenue > 0 AND p_teneur_retenue <= 100) THEN
    RAISE EXCEPTION 'La teneur retenue doit etre comprise entre 0 et 100 %%.';
  END IF;

  UPDATE snp_analyses_teneur SET
    teneur_retenue_pct = p_teneur_retenue,
    justification_retenue = trim(p_justification),
    retenue_par = auth.uid(), retenue_le = now(),
    statut = 'tranchee', updated_by = auth.uid()
  WHERE id = p_analyse_id
  RETURNING * INTO a;

  RETURN a;
END $fn$;

REVOKE ALL ON FUNCTION snp_trancher_teneur(uuid, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION snp_trancher_teneur(uuid, numeric, text) TO authenticated;


CREATE OR REPLACE FUNCTION snp_analyse_synthese(p_analyse_id uuid)
RETURNS TABLE (
  rang integer, origine text, laboratoire text, laboratoire_independant boolean,
  teneur_pct numeric, ecart_a_la_declaration numeric, certificat_reference text,
  date_analyse date, analyste text, observations text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT r.rang, r.origine, r.laboratoire, r.laboratoire_independant, r.teneur_pct,
         round(r.teneur_pct - a.teneur_declaree_pct, 3),
         r.certificat_reference, r.date_analyse, r.analyste, r.observations
  FROM snp_analyses_resultats r
  JOIN snp_analyses_teneur a ON a.id = r.analyse_id
  WHERE r.analyse_id = p_analyse_id
  ORDER BY r.rang;
$fn$;

REVOKE ALL ON FUNCTION snp_analyse_synthese(uuid) FROM public;
GRANT EXECUTE ON FUNCTION snp_analyse_synthese(uuid) TO authenticated;
