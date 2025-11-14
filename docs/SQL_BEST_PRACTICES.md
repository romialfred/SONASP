# SQL Best Practices - PostgreSQL/Supabase

## ⚠️ ERREURS COMMUNES À NE JAMAIS RÉPÉTER

### 1. L'opérateur || dans COMMENT ON COLUMN

**❌ INCORRECT - NE JAMAIS FAIRE:**
```sql
COMMENT ON COLUMN table_name.column_name IS
  'Première partie du commentaire ' ||
  'Deuxième partie du commentaire';
```

**✅ CORRECT - TOUJOURS FAIRE:**
```sql
COMMENT ON COLUMN table_name.column_name IS 'Première partie du commentaire. Deuxième partie du commentaire';
```

**Raison:** L'instruction `COMMENT ON` attend une chaîne littérale simple, pas une expression. L'opérateur `||` n'est pas supporté dans ce contexte.

---

### 2. Modification d'ENUM avec des colonnes dépendantes

**❌ INCORRECT:**
```sql
ALTER TYPE my_enum ADD VALUE 'new_value';
```
(Sans vérifier les dépendances)

**✅ CORRECT:**
```sql
-- 1. Identifier les dépendances
DROP TRIGGER IF EXISTS trigger_using_enum ON table_name;
DROP FUNCTION IF EXISTS function_using_enum() CASCADE;

-- 2. Modifier l'enum ou le recréer
DROP TYPE IF EXISTS my_enum CASCADE;
CREATE TYPE my_enum AS ENUM ('value1', 'new_value', 'value2');

-- 3. Recréer la colonne
ALTER TABLE table_name
  ADD COLUMN IF NOT EXISTS column_name my_enum DEFAULT 'value1';

-- 4. Recréer les dépendances
CREATE FUNCTION function_using_enum() ...
CREATE TRIGGER trigger_using_enum ...
```

---

### 3. Références de colonnes dans les sous-requêtes

**❌ INCORRECT:**
```sql
SELECT id FROM shipping_preparations
WHERE production_id IS NOT NULL;
```
(Quand la colonne n'existe pas dans cette table)

**✅ CORRECT:**
```sql
-- Vérifier d'abord la structure
\d table_name

-- Utiliser la bonne table de liaison
SELECT DISTINCT daily_production_id
FROM shipping_production_items
WHERE daily_production_id IS NOT NULL;
```

---

### 4. Gestion des ENUMs dans les migrations

**✅ APPROCHE RECOMMANDÉE:**

```sql
-- Toujours dans un bloc DO $$ pour capturer les erreurs
DO $$
BEGIN
  -- Vérifier si la valeur existe déjà
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'my_enum'
    AND e.enumlabel = 'new_value'
  ) THEN
    ALTER TYPE my_enum ADD VALUE 'new_value' AFTER 'existing_value';
    RAISE NOTICE '✅ Valeur ajoutée';
  ELSE
    RAISE NOTICE '✅ Valeur existe déjà';
  END IF;
END $$;
```

---

### 5. CASCADE avec DROP TYPE

**⚠️ ATTENTION:**
```sql
DROP TYPE IF EXISTS my_enum CASCADE;
```

**Impact:** Supprime **TOUTES** les colonnes utilisant ce type!

**Action requise:**
- Sauvegarder les données avant
- Recréer les colonnes après
- Recréer tous les triggers/fonctions dépendants

---

### 6. Commentaires multi-lignes dans SQL

**✅ TOUJOURS UTILISER:**
```sql
/*
  Commentaires multi-lignes
  dans un bloc de commentaires
*/

-- Ou commentaires sur une ligne
```

**❌ NE JAMAIS:**
```sql
-- Essayer de concaténer avec ||
-- dans des instructions SQL standards
```

---

## 📋 CHECKLIST AVANT CHAQUE MIGRATION

- [ ] Vérifier la structure actuelle des tables avec `\d table_name`
- [ ] Identifier toutes les dépendances (triggers, fonctions, vues)
- [ ] Tester la syntaxe des COMMENT ON (pas de ||)
- [ ] Vérifier les noms de colonnes dans les sous-requêtes
- [ ] Utiliser des blocs DO $$ pour les modifications d'ENUM
- [ ] Prévoir la recréation des objets dépendants après CASCADE
- [ ] Tester la migration sur un environnement de test
- [ ] Ajouter des RAISE NOTICE pour le suivi

---

## 🔍 COMMANDES DE VÉRIFICATION UTILES

```sql
-- Lister les valeurs d'un ENUM
SELECT e.enumlabel
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'my_enum'
ORDER BY e.enumsortorder;

-- Vérifier la structure d'une table
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'my_table';

-- Trouver les dépendances d'un type
SELECT DISTINCT
  c.relname as table_name,
  a.attname as column_name
FROM pg_attribute a
JOIN pg_class c ON a.attrelid = c.oid
JOIN pg_type t ON a.atttypid = t.oid
WHERE t.typname = 'my_enum';
```

---

## 📚 RESSOURCES

- PostgreSQL Documentation: https://www.postgresql.org/docs/
- Supabase Documentation: https://supabase.com/docs

---

**Dernière mise à jour:** 2025-11-14
**Maintenu par:** L'équipe de développement Gold Shipper
