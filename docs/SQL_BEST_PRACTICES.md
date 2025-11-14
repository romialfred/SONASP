# SQL Best Practices - PostgreSQL/Supabase

## ⚠️ ERREURS COMMUNES À NE JAMAIS RÉPÉTER

### 🚨 0. ERREUR CRITIQUE: NE JAMAIS créer une migration sans vérifier la base de données

**❌ ERREUR FATALE - LA PLUS GRAVE DE TOUTES:**
```sql
-- Créer une migration qui référence des tables inexistantes
ALTER TABLE freight_customs ADD COLUMN ...;
-- ERROR: 42P01: relation "freight_customs" does not exist
```

**✅ PROCESSUS OBLIGATOIRE AVANT TOUTE MIGRATION:**

**Étape 1: Créer un script de vérification**
```javascript
// scripts/verify-database-structure.cjs
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function verifyDatabase() {
  const tablesToCheck = ['daily_production', 'shipping_preparations', 'freight_customs', 'sales'];

  for (const tableName of tablesToCheck) {
    const { error } = await supabase.from(tableName).select('*').limit(1);
    if (error?.code === '42P01') {
      console.log(`❌ ${tableName}: N'EXISTE PAS`);
    } else if (!error) {
      console.log(`✅ ${tableName}: Existe`);
    }
  }
}

verifyDatabase();
```

**Étape 2: TOUJOURS exécuter AVANT d'écrire la migration**
```bash
node scripts/verify-database-structure.cjs
```

**Étape 3: Vérifier l'existence DANS la migration**
```sql
DO $$
BEGIN
  -- Vérifier si la table existe
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'freight_customs'
  ) THEN
    ALTER TABLE freight_customs ADD COLUMN ...;
    RAISE NOTICE '✅ Colonne ajoutée à freight_customs';
  ELSE
    RAISE NOTICE '⚠️  Table freight_customs n''existe pas - modification ignorée';
  END IF;
END $$;
```

**Raison:** Référencer une table inexistante cause l'erreur 42P01 et fait échouer TOUTE la migration. C'est l'erreur la plus coûteuse car elle bloque tout le déploiement!

---

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

### 2. RAISE NOTICE et DELETE en dehors d'un bloc DO $$

**❌ INCORRECT - ERREUR DE SYNTAXE:**
```sql
-- Ceci cause: ERROR: 42601: syntax error at or near "RAISE"
DELETE FROM my_table;
RAISE NOTICE '✅ Table supprimée';
```

**✅ CORRECT - TOUJOURS dans un bloc DO $$:**
```sql
DO $$
BEGIN
  DELETE FROM my_table;
  RAISE NOTICE '✅ Table supprimée';
END $$;
```

**❌ INCORRECT - Mélange de code:**
```sql
-- Transaction ouverte
BEGIN;

DELETE FROM table1;
RAISE NOTICE 'Table 1 supprimée';  -- ❌ ERREUR!

DELETE FROM table2;
RAISE NOTICE 'Table 2 supprimée';  -- ❌ ERREUR!

COMMIT;
```

**✅ CORRECT - Chaque opération dans son bloc:**
```sql
-- Transaction ouverte
BEGIN;

DO $$
BEGIN
  DELETE FROM table1;
  RAISE NOTICE '✅ Table 1 supprimée';
END $$;

DO $$
BEGIN
  DELETE FROM table2;
  RAISE NOTICE '✅ Table 2 supprimée';
END $$;

COMMIT;
```

**OU ENCORE MIEUX - Toutes les opérations dans un seul bloc:**
```sql
BEGIN;

DO $$
BEGIN
  DELETE FROM table1;
  RAISE NOTICE '✅ Table 1 supprimée';

  DELETE FROM table2;
  RAISE NOTICE '✅ Table 2 supprimée';

  DELETE FROM table3;
  RAISE NOTICE '✅ Table 3 supprimée';

  RAISE NOTICE '';
  RAISE NOTICE '✅ Toutes les tables ont été supprimées avec succès';
END $$;

COMMIT;
```

**Raison:** `RAISE NOTICE` est une commande PL/pgSQL qui doit être utilisée dans un bloc anonyme `DO $$` ou dans une fonction. Elle ne peut pas être utilisée directement dans du SQL standard. PostgreSQL génère une erreur de syntaxe (42601) si on tente de l'utiliser en dehors d'un contexte procédural.

**Règle d'or:** Dès que vous utilisez `RAISE NOTICE`, `RAISE EXCEPTION`, ou toute autre commande PL/pgSQL, vous DEVEZ être dans un bloc `DO $$ BEGIN ... END $$;`

---

### 3. Modification d'ENUM avec des colonnes dépendantes

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

## 📋 CHECKLIST AVANT CHAQUE MIGRATION (OBLIGATOIRE)

### CRITIQUE - À FAIRE EN PREMIER:
- [ ] 🚨 **EXÉCUTER `node scripts/verify-database-structure.cjs`**
- [ ] 🚨 **Vérifier que TOUTES les tables référencées existent**
- [ ] 🚨 **Vérifier que TOUTES les colonnes référencées existent**

### ENSUITE:
- [ ] Identifier toutes les dépendances (triggers, fonctions, vues)
- [ ] Tester la syntaxe des COMMENT ON (pas de ||)
- [ ] Utiliser des blocs DO $$ avec EXCEPTION pour chaque modification
- [ ] Prévoir la recréation des objets dépendants après CASCADE
- [ ] Ajouter des RAISE NOTICE pour le suivi de chaque étape
- [ ] Tester la migration localement si possible

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
