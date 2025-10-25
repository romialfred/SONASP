/*
  # Add Field-Level Permissions Support

  1. Changes
    - Add `field_permissions` JSONB column to `user_permissions` table
    - This column stores field-level read/write permissions for each module
    - Format: { "field_name": { "read": true, "write": false }, ... }

  2. Security
    - Maintains existing RLS policies
    - Field permissions are additive to module permissions
*/

-- Add field_permissions column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_permissions' AND column_name = 'field_permissions'
  ) THEN
    ALTER TABLE user_permissions ADD COLUMN field_permissions JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN user_permissions.field_permissions IS 'Field-level permissions stored as JSON: { "field_name": { "read": boolean, "write": boolean } }';
