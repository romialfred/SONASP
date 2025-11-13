# Best Practices pour les Migrations SQL Supabase

## Principe Fondamental: Idempotence

**Une migration doit pouvoir être exécutée plusieurs fois sans erreur.**

Cela signifie que chaque création d'objet de base de données doit vérifier l'existence de l'objet avant de le créer, ou le supprimer puis le recréer.

## ✅ Checklist de Vérification

Avant d'exécuter une migration, vérifiez que **TOUS** ces éléments sont couverts:

### 1. Types ENUM
```sql
-- ✅ BON - Utilise DO $$ avec gestion d'erreur
DO $$ BEGIN
  CREATE TYPE production_status AS ENUM ('prepared', 'shipped', 'refined', 'sold');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ❌ MAUVAIS - Erreur si le type existe déjà
CREATE TYPE production_status AS ENUM ('prepared', 'shipped', 'refined', 'sold');
```

### 2. Tables
```sql
-- ✅ BON - IF NOT EXISTS
CREATE TABLE IF NOT EXISTS production_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ... colonnes
);

-- ❌ MAUVAIS - Erreur si la table existe
CREATE TABLE production_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ... colonnes
);
```

### 3. Colonnes
```sql
-- ✅ BON - Vérification avec DO $$
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_production' AND column_name = 'status'
  ) THEN
    ALTER TABLE daily_production ADD COLUMN status production_status DEFAULT 'prepared' NOT NULL;
  END IF;
END $$;

-- ❌ MAUVAIS - Erreur si la colonne existe
ALTER TABLE daily_production ADD COLUMN status production_status DEFAULT 'prepared' NOT NULL;
```

### 4. Indexes
```sql
-- ✅ BON - IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_daily_production_status
  ON daily_production(status);

-- ❌ MAUVAIS - Erreur si l'index existe
CREATE INDEX idx_daily_production_status
  ON daily_production(status);
```

### 5. Policies RLS
```sql
-- ✅ BON - DROP puis CREATE
DROP POLICY IF EXISTS "Users can view status history" ON production_status_history;

CREATE POLICY "Users can view status history"
  ON production_status_history
  FOR SELECT
  TO authenticated
  USING (true);

-- ❌ MAUVAIS - Erreur si la policy existe
CREATE POLICY "Users can view status history"
  ON production_status_history
  FOR SELECT
  TO authenticated
  USING (true);
```

### 6. Functions
```sql
-- ✅ BON - CREATE OR REPLACE
CREATE OR REPLACE FUNCTION log_production_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- ... code
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ❌ MAUVAIS - CREATE sans OR REPLACE
CREATE FUNCTION log_production_status_change()
RETURNS TRIGGER AS $$
-- ... erreur si existe
```

### 7. Triggers
```sql
-- ✅ BON - DROP puis CREATE
DROP TRIGGER IF EXISTS production_status_change_trigger ON daily_production;

CREATE TRIGGER production_status_change_trigger
  AFTER INSERT OR UPDATE ON daily_production
  FOR EACH ROW
  EXECUTE FUNCTION log_production_status_change();

-- ❌ MAUVAIS - CREATE sans DROP
CREATE TRIGGER production_status_change_trigger
  AFTER INSERT OR UPDATE ON daily_production
  FOR EACH ROW
  EXECUTE FUNCTION log_production_status_change();
```

### 8. Views
```sql
-- ✅ BON - DROP puis CREATE (ou CREATE OR REPLACE)
DROP VIEW IF EXISTS production_summary;

CREATE VIEW production_summary AS
SELECT ...;

-- Ou directement:
CREATE OR REPLACE VIEW production_summary AS
SELECT ...;

-- ❌ MAUVAIS - CREATE sans vérification
CREATE VIEW production_summary AS
SELECT ...;
```

### 9. Contraintes (Constraints)
```sql
-- ✅ BON - Vérification avec DO $$
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_production_mining_company'
    AND table_name = 'daily_production'
  ) THEN
    ALTER TABLE daily_production
    ADD CONSTRAINT fk_production_mining_company
    FOREIGN KEY (mining_company_id) REFERENCES mining_companies(id);
  END IF;
END $$;

-- ❌ MAUVAIS - ADD CONSTRAINT sans vérification
ALTER TABLE daily_production
ADD CONSTRAINT fk_production_mining_company
FOREIGN KEY (mining_company_id) REFERENCES mining_companies(id);
```

### 10. Extensions
```sql
-- ✅ BON - IF NOT EXISTS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ❌ MAUVAIS - Sans vérification
CREATE EXTENSION "uuid-ossp";
```

## 📋 Template de Migration Complète

```sql
/*
  # [Nom descriptif de la migration]

  1. Changements
    - Liste détaillée des changements
    - En format Markdown clair

  2. Nouvelles Tables
    - `table_name`
      - `column1` (type) - Description
      - `column2` (type) - Description

  3. Sécurité
    - RLS activé sur table_name
    - Policies créées pour ...
*/

-- ========================================
-- 1. TYPES ENUM
-- ========================================

DO $$ BEGIN
  CREATE TYPE your_enum_type AS ENUM ('value1', 'value2');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ========================================
-- 2. TABLES
-- ========================================

CREATE TABLE IF NOT EXISTS your_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- colonnes...
  created_at timestamptz DEFAULT now()
);

-- ========================================
-- 3. COLONNES (si ajout à table existante)
-- ========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'your_table' AND column_name = 'new_column'
  ) THEN
    ALTER TABLE your_table ADD COLUMN new_column text;
  END IF;
END $$;

-- ========================================
-- 4. INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_your_table_column
  ON your_table(column_name);

-- ========================================
-- 5. RLS
-- ========================================

ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Policy name 1" ON your_table;
DROP POLICY IF EXISTS "Policy name 2" ON your_table;

-- Create policies
CREATE POLICY "Policy name 1"
  ON your_table
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Policy name 2"
  ON your_table
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ========================================
-- 6. FUNCTIONS
-- ========================================

CREATE OR REPLACE FUNCTION your_function()
RETURNS TRIGGER AS $$
BEGIN
  -- code
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 7. TRIGGERS
-- ========================================

DROP TRIGGER IF EXISTS your_trigger ON your_table;

CREATE TRIGGER your_trigger
  AFTER INSERT OR UPDATE ON your_table
  FOR EACH ROW
  EXECUTE FUNCTION your_function();

-- ========================================
-- 8. DATA UPDATES (si nécessaire)
-- ========================================

-- Initialiser les données existantes
UPDATE your_table
SET new_column = 'default_value'
WHERE new_column IS NULL;

-- ========================================
-- 9. COMMENTS
-- ========================================

COMMENT ON TABLE your_table IS 'Description de la table';
COMMENT ON COLUMN your_table.column_name IS 'Description de la colonne';
```

## 🚨 Erreurs Communes à Éviter

### Erreur 1: "already exists"
```
ERROR: 42710: policy "Policy name" for table "table_name" already exists
```
**Solution:** Ajouter `DROP POLICY IF EXISTS` avant `CREATE POLICY`

### Erreur 2: "duplicate key value"
```
ERROR: 23505: duplicate key value violates unique constraint
```
**Solution:** Ajouter `ON CONFLICT DO NOTHING` ou vérifier l'existence avant l'insertion

### Erreur 3: "column already exists"
```
ERROR: 42701: column "column_name" of relation "table_name" already exists
```
**Solution:** Utiliser le pattern `DO $$ IF NOT EXISTS`

### Erreur 4: "type already exists"
```
ERROR: 42710: type "type_name" already exists
```
**Solution:** Utiliser le pattern `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object`

## 🧪 Testing des Migrations

### Test 1: Première Exécution
```sql
-- Exécuter la migration
\i migration_file.sql

-- Vérifier que tout est créé
SELECT * FROM information_schema.tables WHERE table_name = 'your_table';
```

### Test 2: Deuxième Exécution (Test d'Idempotence)
```sql
-- Ré-exécuter la MÊME migration
\i migration_file.sql

-- ✅ SUCCÈS: Aucune erreur
-- ❌ ÉCHEC: Erreur "already exists"
```

### Test 3: Vérification des Données
```sql
-- Vérifier que les données ne sont pas dupliquées
SELECT COUNT(*) FROM your_table;
-- Le count doit être identique avant et après la 2ème exécution
```

## 📝 Checklist Avant Commit

Avant de committer une migration, vérifiez:

- [ ] Commentaire de migration détaillé en haut du fichier
- [ ] Tous les `CREATE TYPE` utilisent `DO $$ BEGIN ... EXCEPTION`
- [ ] Tous les `CREATE TABLE` utilisent `IF NOT EXISTS`
- [ ] Tous les `ALTER TABLE ADD COLUMN` utilisent le pattern `DO $$ IF NOT EXISTS`
- [ ] Tous les `CREATE INDEX` utilisent `IF NOT EXISTS`
- [ ] Toutes les `CREATE POLICY` sont précédées de `DROP POLICY IF EXISTS`
- [ ] Toutes les `CREATE FUNCTION` utilisent `CREATE OR REPLACE`
- [ ] Tous les `CREATE TRIGGER` sont précédés de `DROP TRIGGER IF EXISTS`
- [ ] Les données existantes sont mises à jour si nécessaire
- [ ] La migration a été testée 2 fois consécutives sans erreur
- [ ] Les RLS policies sont appropriées et sécurisées

## 🎯 Exemple Réel: Notre Migration

**Fichier:** `add_production_status_tracking.sql`

### Avant (Non-Idempotent)
```sql
-- ❌ Erreur à la 2ème exécution
CREATE POLICY "Users can view status history"
  ON production_status_history
  FOR SELECT
  TO authenticated
  USING (true);
```

### Après (Idempotent)
```sql
-- ✅ Peut être exécuté plusieurs fois
DROP POLICY IF EXISTS "Users can view status history" ON production_status_history;

CREATE POLICY "Users can view status history"
  ON production_status_history
  FOR SELECT
  TO authenticated
  USING (true);
```

## 🔄 Workflow de Migration

1. **Développement Local**
   - Écrire la migration en suivant les best practices
   - Tester 2 fois consécutives
   - Vérifier qu'aucune erreur "already exists"

2. **Commit**
   - Commit uniquement si le test d'idempotence passe
   - Message de commit explicite

3. **Production**
   - Backup de la base de données
   - Exécuter la migration
   - Vérifier les logs
   - Rollback si nécessaire

## 📚 Ressources

- [Supabase Migrations Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [PostgreSQL IF EXISTS Documentation](https://www.postgresql.org/docs/current/sql-createtable.html)
- [Row Level Security Policies](https://supabase.com/docs/guides/auth/row-level-security)

---

**Règle d'Or:** Une migration doit être exécutable N fois avec le même résultat (idempotence).

## ⚠️ PROBLÈME CRITIQUE: RAISE NOTICE

### **ERREUR TRÈS COURANTE**

```sql
-- ❌ INCORRECT - Provoque TOUJOURS une erreur de syntaxe
CREATE INDEX IF NOT EXISTS idx_example ON table_name(column);

RAISE NOTICE '✅ Index créé';  -- ERREUR: syntax error at or near "RAISE"
```

**Message d'erreur typique:**
```
ERROR: 42601: syntax error at or near "RAISE"
LINE XX: RAISE NOTICE '✅ Index créé';
```

### **RAISON DU PROBLÈME**

`RAISE NOTICE` ne peut **JAMAIS** être utilisé directement dans le corps d'une migration SQL.
Il doit **OBLIGATOIREMENT** être à l'intérieur d'un bloc `DO $$ ... END $$` ou d'une fonction PL/pgSQL.

### **✅ SOLUTION 1: Utiliser un bloc DO $$**

```sql
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_example ON table_name(column);
  RAISE NOTICE '✅ Index créé';
END $$;
```

### **✅ SOLUTION 2: Supprimer RAISE (RECOMMANDÉ)**

**La meilleure pratique est de NE PAS utiliser RAISE NOTICE dans les migrations:**

```sql
-- ✅ SIMPLE ET SANS ERREUR
CREATE INDEX IF NOT EXISTS idx_example ON table_name(column);

-- Les commentaires SQL suffisent pour la documentation
COMMENT ON INDEX idx_example IS 'Index créé pour améliorer les performances';
```

### **Règle d'Or**

> **Si vous voyez `RAISE` en dehors d'un bloc `DO $$`, c'est une ERREUR!**

### **Vérification Rapide**

```bash
# Rechercher les RAISE problématiques
grep -n "^RAISE" migration.sql

# Si cette commande retourne quelque chose, SUPPRIMEZ les RAISE ou mettez-les dans DO $$
```

### **Commandes Nécessitant un Bloc DO $$**

Ces commandes **NE PEUVENT PAS** être utilisées directement:

- `RAISE NOTICE`
- `RAISE WARNING`
- `RAISE EXCEPTION`
- `DECLARE` (variables)
- `IF ... THEN ... END IF`
- `FOR ... LOOP`
- `GET DIAGNOSTICS`

### **Commandes Utilisables Directement**

Ces commandes **PEUVENT** être utilisées directement (sans bloc):

- `CREATE TABLE`
- `ALTER TABLE`
- `DROP TABLE`
- `CREATE INDEX`
- `CREATE VIEW`
- `INSERT`
- `UPDATE`
- `DELETE`
- `GRANT`
- `COMMENT`

### **Exemple Complet Corrigé**

```sql
/*
  # Migration Example - Sans RAISE (Recommandé)
*/

-- ========================================
-- 1. CRÉER DES COLONNES
-- ========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'example' AND column_name = 'new_col'
  ) THEN
    ALTER TABLE example ADD COLUMN new_col TEXT;
  END IF;
END $$;

-- ========================================
-- 2. CRÉER DES INDEX
-- ========================================

CREATE INDEX IF NOT EXISTS idx_example ON example(new_col);

-- ========================================
-- 3. MIGRER LES DONNÉES
-- ========================================

UPDATE example SET new_col = 'default' WHERE new_col IS NULL;

-- ========================================
-- 4. DOCUMENTATION
-- ========================================

COMMENT ON COLUMN example.new_col IS 'Nouvelle colonne ajoutée le 2025-11-13';
```

---

**Important:** Cette section a été ajoutée suite à des erreurs récurrentes avec `RAISE NOTICE`.
**Date:** 2025-11-13
