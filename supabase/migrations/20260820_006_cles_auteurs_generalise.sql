-- ============================================================================
-- Aucun compte supprimé ne doit geler une ligne — correction généralisée
--
-- La migration `20260820_003` avait traité cinq tables de production. Le
-- balayage complet en révèle **cinquante-sept** de plus : partout où une colonne
-- d'auteur (`created_by`, `approved_by`, `uploaded_by`, `valide_par`…) référence
-- `auth.users` en NO ACTION, PostgreSQL revalide la clé à chaque mise à jour.
-- Une seule référence orpheline suffit alors à rendre la ligne immodifiable — et
-- l'écran n'affiche qu'une violation de clé étrangère, incompréhensible pour qui
-- saisit.
--
-- Le défaut s'est manifesté sur `freight_shipments` en tentant de renuméroter
-- des expéditions : la mise à jour a échoué sur un `created_by` disparu.
--
-- Le traitement se fait **table par table**, et dans cet ordre :
--   1. toutes les clés concernées de la table sont retirées ;
--   2. les références orphelines de ses colonnes nullables passent à NULL ;
--   3. les clés reviennent en ON DELETE SET NULL.
--
-- L'ordre importe. Neutraliser une colonne avant d'avoir retiré les autres clés
-- de la même ligne échoue : la mise à jour revalide les clés voisines, elles
-- aussi orphelines. C'est exactement ce qui s'est produit sur
-- `freight_shipments.processing_started_by`.
--
-- La liste des clés à reposer est établie **avant** la suppression et conservée
-- dans une table temporaire. Une première rédaction la relisait après coup dans
-- `pg_constraint` : elle n'y trouvait plus rien, et les cinquante-sept clés
-- retirées n'étaient pas reposées — les colonnes d'auteur se retrouvaient sans
-- contrainte d'intégrité. Le relevé préalable évite ce piège.
--
-- Les colonnes obligatoires (NOT NULL) reviennent en NO ACTION : SET NULL y
-- serait contradictoire.
--
-- Retour arrière : rétablir NO ACTION sur les contraintes concernées. Les
-- auteurs effacés ne sont pas récupérables — ils ne l'étaient déjà plus.
-- ============================================================================

DO $$
DECLARE
  cible record;
  cle record;
  affectations text;
BEGIN
  -- Relevé préalable : ce que l'on s'apprête à retirer, on sait le reposer.
  CREATE TEMP TABLE a_reposer ON COMMIT DROP AS
    SELECT c.conrelid,
           c.conrelid::regclass::text AS nom_table,
           c.conname,
           a.attname AS colonne,
           a.attnotnull AS obligatoire
    FROM pg_constraint c
    JOIN LATERAL unnest(c.conkey) k(attnum) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND c.confdeltype = 'a'
      AND array_length(c.conkey, 1) = 1;

  FOR cible IN SELECT DISTINCT conrelid, nom_table FROM a_reposer ORDER BY nom_table
  LOOP
    -- 1. Retirer les clés de la table vers auth.users ------------------------
    FOR cle IN SELECT conname FROM a_reposer WHERE conrelid = cible.conrelid
    LOOP
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', cible.nom_table, cle.conname);
    END LOOP;

    -- 2. Neutraliser les références orphelines, toutes colonnes à la fois -----
    affectations := '';
    FOR cle IN
      SELECT DISTINCT colonne FROM a_reposer
      WHERE conrelid = cible.conrelid AND NOT obligatoire
    LOOP
      affectations := affectations
        || format('%I = CASE WHEN EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.%I)
                              THEN t.%I ELSE NULL END, ',
                  cle.colonne, cle.colonne, cle.colonne);
    END LOOP;

    IF affectations <> '' THEN
      EXECUTE format('UPDATE %s t SET %s', cible.nom_table, left(affectations, -2));
    END IF;

    -- 3. Reposer les clés, cette fois clémentes ------------------------------
    FOR cle IN SELECT conname, colonne, obligatoire FROM a_reposer
               WHERE conrelid = cible.conrelid
    LOOP
      EXECUTE format(
        'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I)
           REFERENCES auth.users(id) ON DELETE %s',
        cible.nom_table, cle.conname, cle.colonne,
        CASE WHEN cle.obligatoire THEN 'NO ACTION' ELSE 'SET NULL' END);
    END LOOP;
  END LOOP;
END $$;
