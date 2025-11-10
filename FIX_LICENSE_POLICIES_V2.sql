/*
  Script de Correction: Colonnes Manquantes dans license_requests
  
  Problème: 
  - La migration 20251111020000 référence des colonnes qui n'existent pas
  - justification → n'existe pas (utiliser comments)
  - approved_at → n'existe pas (à ajouter)
  - approved_by → n'existe pas (à ajouter)
  
  Solution:
  Ce script ajoute les colonnes manquantes et corrige les références
*/

-- 1. Ajouter les colonnes d'approbation à license_requests
DO $$
BEGIN
  -- Ajouter approved_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'license_requests' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE license_requests ADD COLUMN approved_at timestamptz;
    RAISE NOTICE 'Colonne approved_at ajoutée à license_requests';
  ELSE
    RAISE NOTICE 'Colonne approved_at existe déjà';
  END IF;

  -- Ajouter approved_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'license_requests' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE license_requests ADD COLUMN approved_by uuid REFERENCES auth.users(id);
    RAISE NOTICE 'Colonne approved_by ajoutée à license_requests';
  ELSE
    RAISE NOTICE 'Colonne approved_by existe déjà';
  END IF;
END $$;

-- 2. Ajouter le lien request_id à licenses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'licenses' AND column_name = 'request_id'
  ) THEN
    ALTER TABLE licenses ADD COLUMN request_id uuid REFERENCES license_requests(id);
    RAISE NOTICE 'Colonne request_id ajoutée à licenses';
  ELSE
    RAISE NOTICE 'Colonne request_id existe déjà';
  END IF;
END $$;

-- 3. Vérifier les colonnes
SELECT 
  'license_requests' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'license_requests'
  AND column_name IN ('title', 'comments', 'priority', 'approved_at', 'approved_by')
ORDER BY column_name;

SELECT 
  'licenses' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'licenses'
  AND column_name = 'request_id'
ORDER BY column_name;

-- 4. Résultat attendu
/*
Vous devriez voir:

license_requests:
- approved_at (timestamptz, YES)
- approved_by (uuid, YES)
- comments (text, YES)
- priority (text, YES)
- title (text, NO)

licenses:
- request_id (uuid, YES)
*/
