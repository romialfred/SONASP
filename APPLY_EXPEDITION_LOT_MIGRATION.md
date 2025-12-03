# Migration Expedition/Lot Number - À Appliquer

## 📋 Nom du Fichier

`20251203_001_add_expedition_lot_counter_system.sql`

## 📝 Contenu de la Migration

Copiez le SQL ci-dessous et appliquez-le dans **Supabase SQL Editor** :

```sql
/*
  # Add Expedition Lot Counter System

  1. Changes
    - Add `abbreviation` column to `mining_companies` table for expedition lot numbering
    - Create `expedition_lot_counters` table to track incremental numbers per mine/year
    - Create function to generate expedition lot numbers in format: HUM-{abbreviation}-XXXX/YYYY
    - Add triggers to auto-increment counters

  2. Security
    - Enable RLS on `expedition_lot_counters` table
    - Add policies for authenticated users

  ## Expedition Lot Number Format

  Format: `HUM-{ABBREVIATION}-{COUNTER}/YEAR`

  Examples:
  - HUM-KGM-0001/2024 (Kouroussa Gold Mines)
  - HUM-SMK-0001/2024 (Société des Mines de Komana)
  - HUM-DGB-0001/2024 (Dugbe)
  - HUM-YFL-0001/2024 (Yanfolila)

  Where:
  - HUM: Fixed prefix (Hummingbird Resources)
  - ABBREVIATION: 3-letter code from mining_companies.abbreviation
  - COUNTER: 4-digit incremental number (0001-9999), resets each year per mine
  - YEAR: 4-digit year
*/

-- Add abbreviation column to mining_companies if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mining_companies' AND column_name = 'abbreviation'
  ) THEN
    ALTER TABLE mining_companies ADD COLUMN abbreviation VARCHAR(10);
  END IF;
END $$;

-- Create expedition_lot_counters table if it doesn't exist
CREATE TABLE IF NOT EXISTS expedition_lot_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mining_company_id UUID NOT NULL REFERENCES mining_companies(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT expedition_lot_counters_mining_company_year_unique UNIQUE (mining_company_id, year)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS expedition_lot_counters_company_year_idx
  ON expedition_lot_counters(mining_company_id, year);

-- Enable RLS
ALTER TABLE expedition_lot_counters ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expedition_lot_counters
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'expedition_lot_counters' AND policyname = 'Users can view expedition lot counters'
  ) THEN
    CREATE POLICY "Users can view expedition lot counters"
      ON expedition_lot_counters FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'expedition_lot_counters' AND policyname = 'System can insert expedition lot counters'
  ) THEN
    CREATE POLICY "System can insert expedition lot counters"
      ON expedition_lot_counters FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'expedition_lot_counters' AND policyname = 'System can update expedition lot counters'
  ) THEN
    CREATE POLICY "System can update expedition lot counters"
      ON expedition_lot_counters FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Function to get next expedition lot number
CREATE OR REPLACE FUNCTION get_next_expedition_lot_number(
  p_mining_company_id UUID,
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_counter INTEGER;
  v_abbreviation TEXT;
  v_expedition_lot_number TEXT;
BEGIN
  -- Get mining company abbreviation
  SELECT abbreviation INTO v_abbreviation
  FROM mining_companies
  WHERE id = p_mining_company_id AND is_active = true;

  IF v_abbreviation IS NULL OR v_abbreviation = '' THEN
    RAISE EXCEPTION 'Mining company not found or abbreviation not set for company ID: %', p_mining_company_id;
  END IF;

  -- Get or create counter for this company/year
  INSERT INTO expedition_lot_counters (mining_company_id, year, counter)
  VALUES (p_mining_company_id, p_year, 1)
  ON CONFLICT (mining_company_id, year)
  DO UPDATE SET
    counter = expedition_lot_counters.counter + 1,
    updated_at = now()
  RETURNING counter INTO v_counter;

  -- Format: HUM-{ABBREVIATION}-{COUNTER}/YEAR
  -- Counter is padded to 4 digits
  v_expedition_lot_number := 'HUM-' || v_abbreviation || '-' || LPAD(v_counter::TEXT, 4, '0') || '/' || p_year::TEXT;

  RETURN v_expedition_lot_number;
END;
$$;

-- Update existing mining companies with abbreviations (if they exist)
DO $$
BEGIN
  -- Update known companies with their abbreviations
  UPDATE mining_companies
  SET abbreviation = 'KGM'
  WHERE (LOWER(name) LIKE '%kouroussa%' OR LOWER(name) LIKE '%kgm%')
    AND (abbreviation IS NULL OR abbreviation = '');

  UPDATE mining_companies
  SET abbreviation = 'SMK'
  WHERE (LOWER(name) LIKE '%komana%' OR LOWER(name) LIKE '%smk%')
    AND (abbreviation IS NULL OR abbreviation = '');

  UPDATE mining_companies
  SET abbreviation = 'DGB'
  WHERE LOWER(name) LIKE '%dugbe%'
    AND (abbreviation IS NULL OR abbreviation = '');

  UPDATE mining_companies
  SET abbreviation = 'YFL'
  WHERE LOWER(name) LIKE '%yanfolila%'
    AND (abbreviation IS NULL OR abbreviation = '');
END $$;
```

## 🚀 Instructions d'Application

### Méthode 1 : Via Supabase Dashboard (Recommandée)

1. Allez sur **Supabase Dashboard**
2. Ouvrez **SQL Editor**
3. Créez une nouvelle query
4. Copiez-collez tout le SQL ci-dessus
5. Cliquez sur **Run**
6. Vérifiez qu'il n'y a pas d'erreurs

### Méthode 2 : Créer le fichier de migration localement

1. Créez le fichier :
   ```bash
   supabase/migrations/20251203_001_add_expedition_lot_counter_system.sql
   ```

2. Copiez-y le contenu SQL ci-dessus

3. Le fichier sera versionné dans Git

## ✅ Vérifications Post-Migration

### 1. Vérifier la colonne `abbreviation`

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'mining_companies' AND column_name = 'abbreviation';
```

### 2. Vérifier la table `expedition_lot_counters`

```sql
SELECT * FROM expedition_lot_counters;
```

### 3. Vérifier la fonction

```sql
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'get_next_expedition_lot_number';
```

### 4. Vérifier les abbreviations des mines

```sql
SELECT id, name, abbreviation, is_active
FROM mining_companies
WHERE is_active = true
ORDER BY name;
```

**Résultat attendu** :
- Kouroussa → `KGM`
- Komana → `SMK`
- Dugbe → `DGB`
- Yanfolila → `YFL`

### 5. Tester la fonction

```sql
-- Remplacer <company-id> par l'ID réel d'une mine
SELECT get_next_expedition_lot_number('<company-id>', 2024);

-- Devrait retourner : HUM-XXX-0001/2024
-- (où XXX est l'abbreviation de la mine)
```

## 🐛 Dépannage

### Si une mine n'a pas d'abbreviation

```sql
-- Lister les mines sans abbreviation
SELECT id, name, abbreviation
FROM mining_companies
WHERE is_active = true
  AND (abbreviation IS NULL OR abbreviation = '');

-- Ajouter manuellement
UPDATE mining_companies
SET abbreviation = 'XXX'  -- Remplacer par le code voulu (3 lettres)
WHERE id = '<company-id>';
```

### Si la fonction échoue

Vérifier les logs d'erreur et s'assurer que :
1. La mine a une abbreviation
2. La mine est active (`is_active = true`)
3. L'ID de la mine est correct

## 📊 Structure Créée

### Table `expedition_lot_counters`

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | Primary key |
| mining_company_id | UUID | FK vers mining_companies |
| year | INTEGER | Année (2024, 2025, etc.) |
| counter | INTEGER | Compteur incrémental |
| created_at | TIMESTAMPTZ | Date de création |
| updated_at | TIMESTAMPTZ | Date de dernière mise à jour |

**Contrainte unique** : `(mining_company_id, year)` - Garantit un seul compteur par mine et par année.

### Fonction `get_next_expedition_lot_number`

**Paramètres** :
- `p_mining_company_id` : UUID de la mine
- `p_year` : Année (optionnel, défaut = année courante)

**Retour** : TEXT au format `HUM-XXX-NNNN/YYYY`

**Comportement** :
1. Récupère l'abbreviation de la mine
2. Trouve ou crée le compteur pour (mine, année)
3. Incrémente le compteur
4. Retourne le numéro formaté

## 🎯 Ce qui Change dans l'Application

### Avant
```
Format : HUM-{CODE}-MMDD/YYYY
Exemple : HUM-KGM-1203/2024
```

### Après
```
Format : HUM-{ABBREVIATION}-XXXX/YYYY
Exemple : HUM-KGM-0001/2024
         HUM-KGM-0002/2024
         HUM-SMK-0001/2024
```

**Avantages** :
✅ Numéros séquentiels et prévisibles
✅ Un compteur par mine
✅ Réinitialisation automatique chaque année
✅ Pas de collision entre mines
✅ Plus facile à suivre et auditer

---

**Une fois la migration appliquée, le nouveau système de numérotation sera opérationnel !** 🚀
