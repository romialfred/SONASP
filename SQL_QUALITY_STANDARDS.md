# Standards de Qualité SQL - Gold Shipper

## 🎯 Objectif

Garantir que **TOUS les scripts SQL fonctionnent du premier coup** sans erreurs de syntaxe ou de logique.

---

## ❌ Erreurs Courantes à Éviter

### 1. **Type Mismatch dans les Variables**

#### ❌ MAUVAIS:
```sql
DECLARE
  duplicate_id UUID;  -- Variable UUID
BEGIN
  -- Essayer de mettre un COUNT (INTEGER) dans UUID
  SELECT COUNT(*) INTO duplicate_id  -- ERREUR!
  FROM table;
END;
```

**Erreur**: `invalid input syntax for type uuid: "2"`

#### ✅ BON:
```sql
DECLARE
  duplicate_count INTEGER;  -- Variable INTEGER pour COUNT
  record_id UUID;           -- Variable UUID pour ID
BEGIN
  -- COUNT dans INTEGER
  SELECT COUNT(*) INTO duplicate_count
  FROM table;

  -- UUID dans UUID
  SELECT id INTO record_id
  FROM table
  LIMIT 1;
END;
```

---

### 2. **Multiple Colonnes dans SELECT INTO**

#### ❌ MAUVAIS:
```sql
DECLARE
  var1 UUID;
  var2 TEXT;
BEGIN
  -- Ordre des colonnes et variables doit correspondre
  SELECT COUNT(*), name INTO var1, var2  -- ERREUR! COUNT est INTEGER, pas UUID
  FROM table;
END;
```

#### ✅ BON:
```sql
DECLARE
  record_count INTEGER;
  company_name TEXT;
BEGIN
  SELECT COUNT(*), name INTO record_count, company_name
  FROM table;
END;
```

---

### 3. **NULL Checks Manquants**

#### ❌ MAUVAIS:
```sql
DECLARE
  company_id UUID;
BEGIN
  SELECT id INTO company_id
  FROM companies
  WHERE name = 'Something';

  -- Utiliser sans vérifier NULL
  UPDATE table SET company_id = company_id;  -- Peut causer des problèmes
END;
```

#### ✅ BON:
```sql
DECLARE
  company_id UUID;
BEGIN
  SELECT id INTO company_id
  FROM companies
  WHERE name = 'Something'
  LIMIT 1;

  IF company_id IS NULL THEN
    RAISE NOTICE '❌ ERROR: Company not found';
    RETURN;  -- Sortir proprement
  END IF;

  UPDATE table SET company_id = company_id
  WHERE condition;
END;
```

---

### 4. **Gestion d'Erreurs Manquante**

#### ❌ MAUVAIS:
```sql
BEGIN
  ALTER TABLE table ADD CONSTRAINT constraint_name UNIQUE (col1, col2);
  -- Échoue si contrainte existe ou si doublons présents
END;
```

#### ✅ BON:
```sql
BEGIN
  -- Vérifier si existe
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'constraint_name'
  ) THEN
    ALTER TABLE table DROP CONSTRAINT constraint_name;
  END IF;

  -- Ajouter avec gestion d'erreur
  ALTER TABLE table ADD CONSTRAINT constraint_name UNIQUE (col1, col2);

EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE '❌ Cannot add constraint - duplicates exist';
    RAISE NOTICE '   Run query to find duplicates...';
END;
```

---

## ✅ Checklist Obligatoire pour Chaque Script

### Avant d'Écrire le Script

- [ ] Identifier clairement le problème
- [ ] Lister les étapes nécessaires
- [ ] Identifier les types de variables nécessaires
- [ ] Planifier la gestion des cas limites

### Pendant l'Écriture

- [ ] **Typage correct**: INTEGER pour COUNT, UUID pour IDs
- [ ] **NULL checks**: Toujours vérifier avant d'utiliser
- [ ] **LIMIT 1**: Sur les SELECT INTO pour éviter too_many_rows
- [ ] **COALESCE**: Pour valeurs par défaut sur colonnes optionnelles
- [ ] **Exception handling**: EXCEPTION WHEN pour les opérations risquées
- [ ] **RAISE NOTICE**: Messages clairs à chaque étape

### Structure du Script

```sql
-- ============================================================================
-- SECTION: Description claire
-- ============================================================================

DO $$
DECLARE
  -- Variables avec types corrects
  var_uuid UUID;
  var_int INTEGER;
  var_text TEXT;
BEGIN
  -- Étape 1: Afficher ce qu'on fait
  RAISE NOTICE '--- Doing something ---';

  -- Étape 2: Requête avec vérification
  SELECT id INTO var_uuid
  FROM table
  WHERE condition
  LIMIT 1;

  -- Étape 3: NULL check
  IF var_uuid IS NULL THEN
    RAISE NOTICE '❌ ERROR: Not found';
    RETURN;
  END IF;

  -- Étape 4: Action
  UPDATE table SET field = value WHERE id = var_uuid;

  -- Étape 5: Confirmation
  RAISE NOTICE '✅ Successfully updated';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR: %', SQLERRM;
END $$;
```

---

## 📋 Types PostgreSQL Courants

| Type SQL | Usage | Exemple |
|----------|-------|---------|
| `UUID` | IDs uniques | `'550e8400-e29b-41d4-a716-446655440000'` |
| `INTEGER` | Nombres entiers, COUNT | `42`, `COUNT(*)` |
| `TEXT` | Chaînes de texte | `'Hello World'` |
| `BOOLEAN` | Vrai/Faux | `TRUE`, `FALSE` |
| `TIMESTAMP` | Dates avec heure | `NOW()`, `'2024-12-03 10:30:00'` |
| `NUMERIC` | Décimaux précis | `123.45` |

---

## 🧪 Validation du Script

### Test 1: Syntaxe Basique
```sql
-- Tester chaque bloc DO $$ séparément
DO $$
BEGIN
  RAISE NOTICE 'Test 1: OK';
END $$;
```

### Test 2: Variables
```sql
DO $$
DECLARE
  test_uuid UUID := '550e8400-e29b-41d4-a716-446655440000';
  test_int INTEGER := 42;
  test_text TEXT := 'Test';
BEGIN
  RAISE NOTICE 'UUID: %, INT: %, TEXT: %', test_uuid, test_int, test_text;
END $$;
```

### Test 3: Requête Simple
```sql
DO $$
DECLARE
  count_result INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_result FROM table_name;
  RAISE NOTICE 'Count: %', count_result;
END $$;
```

---

## 🔍 Debugging Tips

### Afficher les Variables
```sql
RAISE NOTICE 'Variable value: %', variable_name;
RAISE NOTICE 'Multiple values: %, %, %', var1, var2, var3;
```

### Afficher le Type d'une Colonne
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'your_table';
```

### Vérifier une Contrainte
```sql
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'table_name'::regclass;
```

---

## 📦 Template de Script Sûr

```sql
/*
  # Script Title

  PURPOSE:
    1. Clear objective 1
    2. Clear objective 2

  HOW TO APPLY:
    - Open Supabase SQL Editor
    - Copy entire script
    - Execute
    - Check NOTICE messages

  SAFETY:
    - All changes are logged
    - NULL checks included
    - Error handling present
    - Rollback on failure

  DATE: YYYY-MM-DD
*/

-- ============================================================================
-- STEP 1: Display current state
-- ============================================================================

DO $$
DECLARE
  rec RECORD;
  total INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== STEP 1: Current State ===';

  FOR rec IN
    SELECT * FROM table ORDER BY created_at
  LOOP
    total := total + 1;
    RAISE NOTICE 'Record %: %', total, rec.name;
  END LOOP;

  RAISE NOTICE 'Total: %', total;
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 2: Perform update with checks
-- ============================================================================

DO $$
DECLARE
  target_id UUID;
  rows_updated INTEGER;
BEGIN
  RAISE NOTICE '=== STEP 2: Update ===';

  -- Get target with NULL check
  SELECT id INTO target_id
  FROM table
  WHERE condition
  LIMIT 1;

  IF target_id IS NULL THEN
    RAISE NOTICE '❌ No record found';
    RETURN;
  END IF;

  RAISE NOTICE 'Found record: %', target_id;

  -- Update
  UPDATE table
  SET field = 'new_value'
  WHERE id = target_id;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE '✅ Updated % row(s)', rows_updated;
  RAISE NOTICE '';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR: %', SQLERRM;
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 3: Verify final state
-- ============================================================================

DO $$
DECLARE
  final_count INTEGER;
BEGIN
  RAISE NOTICE '=== STEP 3: Verification ===';

  SELECT COUNT(*) INTO final_count
  FROM table
  WHERE condition;

  RAISE NOTICE 'Final count: %', final_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ SCRIPT COMPLETED SUCCESSFULLY';
  RAISE NOTICE '';
END $$;
```

---

## 🎯 Règles d'Or

1. **JAMAIS de COUNT dans UUID** ✅
2. **TOUJOURS vérifier NULL** ✅
3. **TOUJOURS LIMIT 1 sur SELECT INTO** ✅
4. **TOUJOURS EXCEPTION WHEN** ✅
5. **TOUJOURS RAISE NOTICE pour feedback** ✅
6. **TOUJOURS tester la syntaxe d'abord** ✅
7. **TOUJOURS diviser en blocs DO $$ séparés** ✅
8. **TOUJOURS commenter clairement** ✅

---

## 📝 Exemples de Scripts Corrects

### Exemple 1: Mise à Jour Simple
```sql
DO $$
DECLARE
  target_id UUID;
BEGIN
  SELECT id INTO target_id
  FROM users
  WHERE email = 'user@example.com'
  LIMIT 1;

  IF target_id IS NULL THEN
    RAISE NOTICE 'User not found';
    RETURN;
  END IF;

  UPDATE users
  SET active = true
  WHERE id = target_id;

  RAISE NOTICE '✅ User activated';
END $$;
```

### Exemple 2: Ajout de Contrainte
```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_email'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT unique_email;
  END IF;

  ALTER TABLE users ADD CONSTRAINT unique_email UNIQUE (email);
  RAISE NOTICE '✅ Constraint added';

EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE '❌ Duplicates exist - fix them first';
END $$;
```

### Exemple 3: Comptage et Affichage
```sql
DO $$
DECLARE
  total_users INTEGER;
  active_users INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM users;
  SELECT COUNT(*) INTO active_users FROM users WHERE active = true;

  RAISE NOTICE 'Total users: %', total_users;
  RAISE NOTICE 'Active users: %', active_users;
  RAISE NOTICE 'Percentage: %', (active_users::NUMERIC / total_users * 100)::INTEGER;
END $$;
```

---

## 🚀 Amélioration Continue

### Après Chaque Erreur:
1. ✅ Documenter l'erreur
2. ✅ Identifier la cause racine
3. ✅ Ajouter à cette documentation
4. ✅ Créer un test pour éviter récidive

### Code Review Checklist:
- [ ] Tous les types sont corrects
- [ ] Tous les NULL sont gérés
- [ ] Tous les LIMIT 1 présents
- [ ] Toutes les exceptions gérées
- [ ] Tous les messages NOTICE clairs
- [ ] Script testé sur données réelles

---

## 📚 Ressources

- [PostgreSQL Data Types](https://www.postgresql.org/docs/current/datatype.html)
- [PL/pgSQL Guide](https://www.postgresql.org/docs/current/plpgsql.html)
- [Error Handling](https://www.postgresql.org/docs/current/plpgsql-control-structures.html#PLPGSQL-ERROR-TRAPPING)

---

**Rappel**: Un script SQL de qualité doit fonctionner **du premier coup**, avec des messages clairs, une gestion d'erreurs complète, et une logique robuste. Zero tolerance pour les erreurs évitables ! ✅
