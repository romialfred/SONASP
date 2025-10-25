/*
  # Add created_by Foreign Key to Batches Table

  1. Changes
    - Add foreign key constraint from batches.created_by to user_profiles(id)
    - This allows proper joins in batch queries

  2. Security
    - No RLS changes needed - foreign key for data integrity only
*/

-- Add foreign key for batches.created_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'batches_created_by_fkey'
  ) THEN
    ALTER TABLE batches 
    ADD CONSTRAINT batches_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
