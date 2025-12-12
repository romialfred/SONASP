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

### 2. 🔴 RAISE NOTICE EN DEHORS DE DO $$ (ERREUR RÉCURRENTE!)

**🚨 CETTE ERREUR SE RÉPÈTE DEPUIS 3 MOIS - ELLE EST MAINTENANT INTERDITE!**

#### Erreur Typique

```
ERROR: 42601: syntax error at or near "RAISE"
LINE 79: RAISE NOTICE '...'
```

#### Cause

`RAISE` utilisé EN DEHORS d'un bloc PL/pgSQL.

---

#### ❌ EXEMPLES INCORRECTS (À NE JAMAIS FAIRE)

**Erreur 1: Après DROP/ALTER**
```sql
DROP TRIGGER foo_trigger ON my_table;
RAISE NOTICE 'Trigger supprimé';  -- ❌ ERREUR 42601!
```

**Erreur 2: Après DELETE**
```sql
DELETE FROM my_table;
RAISE NOTICE 'Table supprimée';  -- ❌ ERREUR 42601!
```

**Erreur 3: Fin de script**
```sql
ALTER TABLE sales ALTER COLUMN status SET DEFAULT 'pending';
-- ... autres commandes ...
RAISE NOTICE '✅ FIX COMPLET!';  -- ❌ ERREUR 42601!
```

**Erreur 4: Mélangé avec SQL**
```sql
SELECT * FROM users;
RAISE NOTICE 'Query done';  -- ❌ ERREUR 42601!

ALTER TYPE my_enum ADD VALUE 'new';
RAISE NOTICE 'Value added';  -- ❌ ERREUR 42601!
```

---

#### ✅ CORRECTIONS OBLIGATOIRES

**Fix 1: DROP puis DO $$**
```sql
DROP TRIGGER foo_trigger ON my_table;

DO $$
BEGIN
  RAISE NOTICE 'Trigger supprimé';
END $$;
```

**Fix 2: Toutes les opérations dans DO $$**
```sql
DO $$
BEGIN
  DELETE FROM my_table;
  RAISE NOTICE 'Table supprimée';
END $$;
```

**Fix 3: Messages regroupés**
```sql
ALTER TABLE sales ALTER COLUMN status SET DEFAULT 'pending';
DROP TRIGGER foo ON sales;
ALTER TYPE sale_status ADD VALUE 'completed';

DO $$
BEGIN
  RAISE NOTICE '=== CONFIGURATION COMPLETE ===';
  RAISE NOTICE 'DEFAULT changé';
  RAISE NOTICE 'Trigger supprimé';
  RAISE NOTICE 'Status ajouté';
END $$;
```

**Fix 4: Logique dans DO $$**
```sql
DO $$
DECLARE
  user_count INT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM users;
  RAISE NOTICE 'Query done: % utilisateurs', user_count;

  ALTER TYPE my_enum ADD VALUE IF NOT EXISTS 'new';
  RAISE NOTICE 'Value added';
END $$;
```

---

#### 🛡️ RÈGLES STRICTES

**1. RAISE peut UNIQUEMENT être utilisé dans:**

| Contexte | Exemple |
|----------|---------|
| Bloc DO $$ | `DO $$ BEGIN RAISE NOTICE '...'; END $$;` |
| Fonction PL/pgSQL | `CREATE FUNCTION ... BEGIN RAISE ...; END;` |
| Trigger PL/pgSQL | `CREATE TRIGGER ... BEGIN RAISE ...; RETURN NEW; END;` |

**2. RAISE NE PEUT JAMAIS être utilisé:**
- Après DROP, ALTER, CREATE en SQL pur
- Après DELETE, INSERT, UPDATE en SQL pur
- À la fin d'un script sans DO $$
- Dans du SQL standard

**3. Pattern TOUJOURS correct:**
```sql
-- 1. Commandes SQL pures
<SQL commands>

-- 2. Messages dans DO $$
DO $$
BEGIN
  RAISE NOTICE 'Messages';
END $$;
```

---

#### 🔍 VALIDATION AUTOMATIQUE

**Avant CHAQUE script SQL:**

```bash
# Valider UN fichier
node scripts/validate-sql-scripts.mjs mon_script.sql

# Valider TOUS les fichiers
node scripts/validate-sql-scripts.mjs --all

# Le validateur détecte:
# ✗ RAISE en dehors de DO $$  → ERREUR
# ⚠ SELECT '...' pour message → AVERTISSEMENT
```

**Intégration obligatoire dans workflow:**

```bash
# .git/hooks/pre-commit
git diff --cached --name-only | grep '\.sql$' | while read file; do
  node scripts/validate-sql-scripts.mjs "$file" || exit 1
done
```

---

#### 📊 CHECKLIST AVANT EXÉCUTION

Avant d'exécuter un script SQL:

- [ ] ✅ Validation passée: `node scripts/validate-sql-scripts.mjs script.sql`
- [ ] ✅ Aucun RAISE en dehors de DO $$
- [ ] ✅ Tous les blocs DO $$ sont fermés avec `END $$;`
- [ ] ✅ Les variables sont déclarées dans DECLARE
- [ ] ✅ Script testé localement si possible

---

**Raison:** `RAISE` est une commande PL/pgSQL qui doit être dans un bloc procédural. PostgreSQL génère une erreur de syntaxe (42601) si utilisé en SQL pur. Cette erreur se répète depuis 3 mois et est maintenant sous tolérance zéro.

**Règle d'or:** RAISE = DO $$. Toujours. Sans exception.

**Outil de validation:** `/scripts/validate-sql-scripts.mjs` (OBLIGATOIRE avant exécution)

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
