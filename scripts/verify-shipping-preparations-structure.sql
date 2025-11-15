-- =====================================================
-- VERIFICATION STRUCTURE: shipping_preparations
-- =====================================================
-- Affiche toutes les colonnes ACTUELLES de la table

DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'STRUCTURE DE shipping_preparations';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  FOR rec IN
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shipping_preparations'
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE '  %-35s %-20s %s',
      rec.column_name,
      rec.data_type,
      CASE WHEN rec.is_nullable = 'NO' THEN 'NOT NULL' ELSE 'NULL' END;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';

END $$;
