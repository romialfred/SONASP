/*
  # Add Title Field to License Requests

  1. Changes
    - Add `title` column to `license_requests` table
    - Title is required and helps identify the purpose of the license request

  2. Notes
    - Non-breaking change - existing records will need title populated
    - Title provides better context and searchability
*/

-- Add title column to license_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'license_requests' AND column_name = 'title'
  ) THEN
    ALTER TABLE license_requests
    ADD COLUMN title text NOT NULL DEFAULT 'Untitled License Request';

    -- Remove default after adding column
    ALTER TABLE license_requests
    ALTER COLUMN title DROP DEFAULT;

    RAISE NOTICE '✓ Added title column to license_requests table';
  ELSE
    RAISE NOTICE '  Title column already exists in license_requests table';
  END IF;
END $$;
