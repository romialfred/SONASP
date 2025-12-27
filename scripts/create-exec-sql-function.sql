/*
  Fonction utilitaire pour exécuter du SQL dynamique
  Cette fonction permet d'exécuter des migrations depuis le code
*/

CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Exécuter la requête SQL
  EXECUTE sql_query;

  -- Retourner un résultat de succès
  result := jsonb_build_object(
    'success', true,
    'message', 'Query executed successfully'
  );

  RETURN result;
EXCEPTION WHEN OTHERS THEN
  -- En cas d'erreur, lever l'exception avec les détails
  RAISE EXCEPTION 'SQL execution failed: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION exec_sql IS 'Exécute du SQL dynamique (usage administratif uniquement)';
