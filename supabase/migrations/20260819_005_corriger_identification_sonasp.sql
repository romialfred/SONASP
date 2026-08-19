-- ============================================================================
-- Correctif : identification de SONASP par son code
--
-- `get_sonasp_id()` et `set_sonasp_as_buyer()` comparaient
-- `company_type = 'sonasp'`. Cette valeur n'existe pas dans `company_type_enum`,
-- qui ne connaît que `production_mine`, `institution` et `parent_company`.
-- Postgres convertit le littéral vers le type de la colonne, échoue, et lève
-- `22P02 invalid input value for enum company_type_enum: "sonasp"`.
--
-- Le déclencheur `trigger_set_sonasp_buyer` s'exécutant BEFORE INSERT OR UPDATE
-- sur `snp_artisan_ventes_or`, **aucune vente d'or artisanale ne pouvait être
-- créée ni modifiée**. Le défaut a été mis au jour par la migration
-- `20260819_002`, dont la renumérotation était rejetée par ce déclencheur.
--
-- SONASP figure au référentiel avec `code = 'SONASP'` et
-- `company_type = 'institution'`. C'est donc le code qui l'identifie ; aucune
-- valeur d'énumération n'a besoin d'être ajoutée, et l'écran de création d'une
-- société n'a pas à proposer un type supplémentaire.
--
-- Retour arrière :
--   Restaurer les deux fonctions avec `company_type = 'sonasp'`, ce qui
--   rétablirait le blocage : à ne faire que pour reproduire l'anomalie.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_sonasp_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  sonasp_id uuid;
BEGIN
  SELECT id INTO sonasp_id
  FROM mining_companies
  WHERE upper(code) = 'SONASP'
    AND is_active = true
  LIMIT 1;

  IF sonasp_id IS NULL THEN
    RAISE EXCEPTION 'SONASP n''est pas configurée dans le référentiel des sociétés (code SONASP attendu)';
  END IF;

  RETURN sonasp_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_sonasp_as_buyer()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.acheteur_id IS NULL THEN
    NEW.acheteur_id := get_sonasp_id();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mining_companies
    WHERE id = NEW.acheteur_id
      AND upper(code) = 'SONASP'
  ) THEN
    RAISE EXCEPTION 'Les artisans miniers peuvent vendre uniquement à SONASP';
  END IF;

  RETURN NEW;
END;
$function$;
