-- Le schéma historique de production conserve remaining_quantity_grams comme
-- colonne ordinaire. Sans synchronisation, une licence créée depuis le portail
-- reçoit un reliquat NULL et disparaît du sélecteur des expéditions.

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.export_licenses') IS NULL THEN
    RAISE EXCEPTION 'La table export_licenses doit exister avant la synchronisation des reliquats';
  END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION public.snp_sync_export_license_remaining()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.used_quantity_grams := COALESCE(NEW.used_quantity_grams, 0);
  NEW.remaining_quantity_grams := GREATEST(
    NEW.authorized_quantity_grams - NEW.used_quantity_grams,
    0
  );
  RETURN NEW;
END;
$function$;

DO $sync$
DECLARE
  v_generation text;
BEGIN
  SELECT is_generated
  INTO v_generation
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'export_licenses'
    AND column_name = 'remaining_quantity_grams';

  IF v_generation IS NULL THEN
    RAISE EXCEPTION 'La colonne export_licenses.remaining_quantity_grams est absente';
  END IF;

  -- Sur un environnement plus récent où la colonne serait déjà générée, le
  -- moteur maintient lui-même le reliquat : aucun trigger ne doit l'écraser.
  IF v_generation = 'NEVER' THEN
    UPDATE public.export_licenses
    SET used_quantity_grams = COALESCE(used_quantity_grams, 0),
        remaining_quantity_grams = GREATEST(
          authorized_quantity_grams - COALESCE(used_quantity_grams, 0),
          0
        )
    WHERE used_quantity_grams IS NULL
       OR remaining_quantity_grams IS NULL
       OR remaining_quantity_grams <> GREATEST(
         authorized_quantity_grams - COALESCE(used_quantity_grams, 0),
         0
       );

    ALTER TABLE public.export_licenses
      ALTER COLUMN used_quantity_grams SET DEFAULT 0,
      ALTER COLUMN used_quantity_grams SET NOT NULL,
      ALTER COLUMN remaining_quantity_grams SET NOT NULL;

    DROP TRIGGER IF EXISTS snp_sync_export_license_remaining
      ON public.export_licenses;
    CREATE TRIGGER snp_sync_export_license_remaining
      BEFORE INSERT OR UPDATE OF authorized_quantity_grams, used_quantity_grams
      ON public.export_licenses
      FOR EACH ROW
      EXECUTE FUNCTION public.snp_sync_export_license_remaining();
  ELSE
    DROP TRIGGER IF EXISTS snp_sync_export_license_remaining
      ON public.export_licenses;
  END IF;
END
$sync$;

COMMENT ON FUNCTION public.snp_sync_export_license_remaining() IS
  'Maintient le reliquat d une licence égal au volume autorisé moins le volume consommé.';

COMMIT;
