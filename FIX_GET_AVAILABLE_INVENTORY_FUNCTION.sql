/*
  # Correction de la fonction get_available_inventory

  Cette migration corrige la fonction get_available_inventory pour utiliser
  la nouvelle structure avec gold_inventory au lieu de l'ancienne table batches.

  ## Changements

  1. Supprime l'ancienne fonction qui utilise la table batches
  2. Crée une nouvelle fonction utilisant gold_inventory
  3. Retourne l'inventaire disponible basé sur quantity_available_oz
*/

-- Supprimer l'ancienne fonction si elle existe
DROP FUNCTION IF EXISTS get_available_inventory();
DROP FUNCTION IF EXISTS get_available_inventory(integer);

-- Créer la nouvelle fonction corrigée
CREATE OR REPLACE FUNCTION get_available_inventory(p_site_id integer DEFAULT NULL)
RETURNS TABLE (
  inventory_id uuid,
  refining_record_id uuid,
  available_ounces numeric,
  weight_ounces numeric,
  name text,
  entry_date timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    gi.id as inventory_id,
    gi.refining_record_id,
    COALESCE(gi.quantity_available_oz, 0) as available_ounces,
    gi.final_fine_oz as weight_ounces,
    COALESCE(
      gi.notes,
      gi.certificate_number,
      'Inventaire #' || gi.id::text
    ) as name,
    gi.entry_date::timestamp with time zone
  FROM gold_inventory gi
  WHERE gi.transaction_type = 'entry'
    AND COALESCE(gi.quantity_available_oz, 0) > 0
  ORDER BY gi.entry_date ASC NULLS LAST;
END;
$$;

-- Ajouter un commentaire explicatif
COMMENT ON FUNCTION get_available_inventory(integer) IS
'Retourne l''inventaire d''or disponible pour la vente.
Filtre les entrées avec quantity_available_oz > 0.
Le paramètre p_site_id est conservé pour compatibilité mais non utilisé actuellement.';
