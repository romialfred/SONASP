-- ================================================================
-- CORRECTION URGENTE: Ajouter colonne status à gold_sales
-- ================================================================
-- PROBLÈME TROUVÉ: La table gold_sales n'a PAS de colonne status!
-- SOLUTION: Ajouter la colonne + trigger pour historique
-- ================================================================

-- 1. Ajouter la colonne status à gold_sales
ALTER TABLE gold_sales
ADD COLUMN IF NOT EXISTS status sale_status
DEFAULT 'pending_management_approval'::sale_status
NOT NULL;

-- 2. Créer l'index pour performance
CREATE INDEX IF NOT EXISTS idx_gold_sales_status
ON gold_sales(status);

-- 3. Mettre à jour les ventes existantes (si elles existent)
UPDATE gold_sales
SET status = 'pending_management_approval'::sale_status
WHERE status IS NULL;

-- 4. Créer la fonction de trigger pour l'historique
CREATE OR REPLACE FUNCTION log_gold_sales_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Insérer dans l'historique uniquement si le statut change
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR TG_OP = 'INSERT' THEN
    INSERT INTO unified_history (
      entity_type,
      entity_id,
      status,
      changed_by,
      metadata
    ) VALUES (
      'gold_sales',
      NEW.id,
      NEW.status::text,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      jsonb_build_object(
        'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status::text ELSE NULL END,
        'new_status', NEW.status::text,
        'sale_number', NEW.sale_number,
        'customer_id', NEW.customer_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS gold_sales_status_history_trigger ON gold_sales;

-- 6. Créer le nouveau trigger
CREATE TRIGGER gold_sales_status_history_trigger
  AFTER INSERT OR UPDATE OF status ON gold_sales
  FOR EACH ROW
  EXECUTE FUNCTION log_gold_sales_status_change();

-- 7. Vérification finale
DO $$
DECLARE
  col_exists BOOLEAN;
  trig_exists BOOLEAN;
  default_val TEXT;
BEGIN
  -- Vérifier colonne
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gold_sales'
    AND column_name = 'status'
    AND udt_name = 'sale_status'
  ) INTO col_exists;

  -- Vérifier trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'gold_sales_status_history_trigger'
    AND tgrelid = 'gold_sales'::regclass
  ) INTO trig_exists;

  -- Vérifier valeur par défaut
  SELECT column_default INTO default_val
  FROM information_schema.columns
  WHERE table_name = 'gold_sales'
  AND column_name = 'status';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VÉRIFICATION FINALE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Colonne status existe: %', CASE WHEN col_exists THEN 'OUI' ELSE 'NON' END;
  RAISE NOTICE 'Trigger existe: %', CASE WHEN trig_exists THEN 'OUI' ELSE 'NON' END;
  RAISE NOTICE 'Valeur par défaut: %', default_val;
  RAISE NOTICE '';

  IF col_exists AND trig_exists THEN
    RAISE NOTICE 'CORRECTION APPLIQUEE AVEC SUCCES!';
    RAISE NOTICE 'La table gold_sales est maintenant prete';
  ELSE
    RAISE WARNING 'ATTENTION: Probleme detecte dans la configuration';
  END IF;
  RAISE NOTICE '========================================';
END $$;
