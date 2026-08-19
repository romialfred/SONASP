-- Photos des sites artisanaux (3 au maximum par site).
-- Migration idempotente et non destructive.

ALTER TABLE public.artisanal_sites
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.artisanal_sites.photos IS
  'URLs des photos du site (bucket artisanal-sites) ou données encodées en repli hors ligne. Trois entrées au maximum.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'artisanal_sites_photos_max_3'
  ) THEN
    ALTER TABLE public.artisanal_sites
      ADD CONSTRAINT artisanal_sites_photos_max_3
      CHECK (array_length(photos, 1) IS NULL OR array_length(photos, 1) <= 3);
  END IF;
END $$;

-- Bucket privé dédié aux photos de site (accès par URL signée).
INSERT INTO storage.buckets (id, name, public)
VALUES ('artisanal-sites', 'artisanal-sites', false)
ON CONFLICT (id) DO NOTHING;

-- Rollback :
--   ALTER TABLE public.artisanal_sites DROP CONSTRAINT IF EXISTS artisanal_sites_photos_max_3;
--   ALTER TABLE public.artisanal_sites DROP COLUMN IF EXISTS photos;
--   DELETE FROM storage.buckets WHERE id = 'artisanal-sites';
