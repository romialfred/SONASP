# Checklist Qualité SQL - Scripts Supabase

## 🚨 ERREURS RÉCURRENTES À ÉVITER ABSOLUMENT

### ❌ ERREUR #1 : RAISE NOTICE hors d'un bloc PL/pgSQL
**Symptôme:** `ERROR: 42601: syntax error at or near "RAISE"`

**Problème:** `RAISE NOTICE` ne peut être utilisé que dans un bloc `DO $$...$$`

**❌ MAUVAIS:**
```sql
DELETE FROM ma_table;
RAISE NOTICE 'Données supprimées';  -- ❌ ERREUR SYNTAXE
```

**✅ CORRECT:**
```sql
DELETE FROM ma_table;

-- Utiliser un bloc DO pour RAISE NOTICE
DO $$
BEGIN
  RAISE NOTICE 'Données supprimées';
END $$;
```

**OU utiliser des commentaires simples:**
```sql
DELETE FROM ma_table;
-- Données supprimées (commentaire simple)
```

---

### ❌ ERREUR #2 : Utiliser des noms de colonnes qui n'existent pas

**Problème:** Écrire un script sans vérifier la structure réelle de la table

**RÈGLE OBLIGATOIRE:**
1. **TOUJOURS** exporter le DDL complet de la table avant d'écrire un script
2. Vérifier les noms exacts des colonnes (casse, orthographe)
3. Vérifier les types de données (TEXT vs JSONB, DATE vs TIMESTAMP, etc.)
4. Vérifier les contraintes (NOT NULL, CHECK, FOREIGN KEY)

**Exemple:**
```sql
-- ❌ MAUVAIS: Supposer que la colonne s'appelle "date_delivrance"
INSERT INTO snp_cartes_professionnelles (date_delivrance, ...)

-- ✅ CORRECT: Vérifier le DDL et utiliser le vrai nom
INSERT INTO snp_cartes_professionnelles (date_emission, ...)
```

---

## ✅ CHECKLIST AVANT D'ÉCRIRE UN SCRIPT SQL

### 1. ANALYSE DE LA STRUCTURE (OBLIGATOIRE)

- [ ] Exporter le DDL complet de toutes les tables concernées
- [ ] Lister tous les noms de colonnes exacts
- [ ] Noter les types de données pour chaque colonne
- [ ] Identifier les colonnes NOT NULL
- [ ] Identifier les valeurs par défaut (DEFAULT)
- [ ] Identifier les contraintes CHECK
- [ ] Identifier les clés étrangères (FOREIGN KEY)
- [ ] Identifier les index existants
- [ ] Vérifier les politiques RLS existantes

**Template d'analyse:**
```sql
-- ANALYSE DE LA TABLE: [nom_table]
-- Colonnes existantes:
--   - id: uuid (PK, DEFAULT gen_random_uuid())
--   - date_emission: date (NOT NULL, DEFAULT CURRENT_DATE)
--   - statut: text (NOT NULL, DEFAULT 'en_cours', CHECK)
--   - qr_code_data: text (nullable)
-- Relations:
--   - artisan_id → snp_artisans_miniers(id) ON DELETE CASCADE
-- Index:
--   - idx_cartes_statut ON (statut)
-- RLS: ENABLED
```

---

### 2. SYNTAXE PL/pgSQL

- [ ] Tous les `RAISE NOTICE` sont dans des blocs `DO $$...$$`
- [ ] Les blocs `DO $$` ont `BEGIN` et `END $$`
- [ ] Les variables sont déclarées dans `DECLARE`
- [ ] Pas de `;` après `END $$ avant le dernier point-virgule
- [ ] Les chaînes de caractères utilisent des apostrophes simples `'texte'`
- [ ] Les apostrophes dans les chaînes sont doublées `''` : `'L''artisan'`

**✅ Structure correcte:**
```sql
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Code ici
  SELECT COUNT(*) INTO v_count FROM ma_table;
  RAISE NOTICE 'Nombre: %', v_count;
END $$;
```

---

### 3. AJOUT DE COLONNES

- [ ] Utiliser `IF NOT EXISTS` pour vérifier l'existence
- [ ] Toujours dans un bloc `DO $$`
- [ ] Spécifier le type exact
- [ ] Ajouter les contraintes si nécessaire
- [ ] Tester avec `information_schema.columns`

**✅ Template correct:**
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ma_table'
      AND column_name = 'nouvelle_colonne'
  ) THEN
    ALTER TABLE ma_table
    ADD COLUMN nouvelle_colonne text;

    RAISE NOTICE 'Colonne nouvelle_colonne ajoutée';
  ELSE
    RAISE NOTICE 'Colonne nouvelle_colonne existe déjà';
  END IF;
END $$;
```

---

### 4. MODIFICATION DE CONTRAINTES

- [ ] Supprimer l'ancienne contrainte avec `IF EXISTS`
- [ ] Créer la nouvelle contrainte
- [ ] Gérer les exceptions (`EXCEPTION WHEN duplicate_object`)
- [ ] Dans un bloc `DO $$`

**✅ Template correct:**
```sql
DO $$
BEGIN
  -- Supprimer l'ancienne
  ALTER TABLE ma_table
  DROP CONSTRAINT IF EXISTS ma_contrainte;

  -- Créer la nouvelle
  ALTER TABLE ma_table
  ADD CONSTRAINT ma_contrainte
  CHECK (statut IN ('valeur1', 'valeur2'));

  RAISE NOTICE 'Contrainte mise à jour';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Contrainte existe déjà';
END $$;
```

---

### 5. INSERTION DE DONNÉES

- [ ] Lister explicitement toutes les colonnes
- [ ] Utiliser les vrais noms de colonnes (vérifiés dans le DDL)
- [ ] Respecter les types de données
- [ ] Respecter les contraintes NOT NULL
- [ ] Utiliser les bons types pour les dates/timestamps
- [ ] Gérer les clés étrangères existantes

**✅ Template correct:**
```sql
-- Vérifier d'abord la structure
-- Table: snp_cartes_professionnelles
-- Colonnes: artisan_id (uuid, NOT NULL), numero_carte (text, NOT NULL),
--           date_emission (date, NOT NULL, DEFAULT CURRENT_DATE)

INSERT INTO snp_cartes_professionnelles (
  artisan_id,
  numero_carte,
  date_emission,
  statut
) VALUES (
  'uuid-valide-ici',
  'CARTE-001',
  CURRENT_DATE,
  'en_cours'
);
```

---

### 6. BOUCLES ET CURSEURS

- [ ] Déclarer les variables dans `DECLARE`
- [ ] Utiliser `FOR ... IN ... LOOP`
- [ ] Fermer avec `END LOOP`
- [ ] Utiliser `RECORD` pour les résultats de requêtes
- [ ] Tester les valeurs NULL avant utilisation

**✅ Template correct:**
```sql
DO $$
DECLARE
  v_record RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_record IN
    SELECT id, nom FROM ma_table
  LOOP
    v_count := v_count + 1;
    -- Traitement ici
  END LOOP;

  RAISE NOTICE 'Traité % enregistrements', v_count;
END $$;
```

---

### 7. SUPPRESSIONS DE DONNÉES

- [ ] Commenter clairement l'intention
- [ ] Respecter l'ordre (tables enfants avant parents)
- [ ] Vérifier les contraintes CASCADE
- [ ] Ajouter un message de confirmation

**✅ Template correct:**
```sql
-- Supprimer toutes les données pour réinitialisation
-- ATTENTION: Ceci supprime TOUTES les données

-- D'abord les tables enfants
DELETE FROM snp_artisan_activities;
DELETE FROM snp_carte_statistics;

-- Ensuite les tables parents
DELETE FROM snp_cartes_professionnelles;

DO $$
BEGIN
  RAISE NOTICE 'Données supprimées avec succès';
END $$;
```

---

### 8. GESTION DES TYPES DE DONNÉES

- [ ] TEXT pour les chaînes (pas VARCHAR sauf taille fixe nécessaire)
- [ ] UUID pour les identifiants
- [ ] TIMESTAMPTZ pour les dates/heures (pas TIMESTAMP)
- [ ] DATE pour les dates seules
- [ ] NUMERIC(p,s) pour les montants (pas FLOAT)
- [ ] BOOLEAN pour les vrais/faux
- [ ] JSONB pour les données structurées (pas JSON)

---

### 9. CONVENTIONS DE NOMMAGE

- [ ] Tables: snake_case, pluriel `snp_artisans_miniers`
- [ ] Colonnes: snake_case, singulier `date_emission`
- [ ] Contraintes: `table_column_type` ex: `snp_cartes_statut_check`
- [ ] Index: `idx_table_column` ex: `idx_cartes_statut`
- [ ] Foreign keys: `table_column_fkey` ex: `cartes_artisan_id_fkey`
- [ ] Politiques RLS: Description en français entre guillemets

---

### 10. ROW LEVEL SECURITY (RLS)

- [ ] Activer RLS: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] Créer des politiques pour SELECT, INSERT, UPDATE, DELETE
- [ ] Utiliser `auth.uid()` pour l'identification utilisateur
- [ ] Politiques restrictives par défaut
- [ ] Tester les politiques avec différents rôles

---

## 📝 TEMPLATE COMPLET DE SCRIPT SÉCURISÉ

```sql
/*
  # Titre du script

  ## Description
  Explication claire de ce que fait le script

  ## Tables affectées
  - snp_table1: modifications...
  - snp_table2: ajout colonnes...

  ## Structure des tables (vérifiée)
  ### snp_table1
  - colonne1: type (contraintes)
  - colonne2: type (contraintes)
*/

-- ============================================================================
-- PARTIE 1: ANALYSE ET VÉRIFICATION
-- ============================================================================

-- Lister la structure actuelle pour validation
DO $$
DECLARE
  v_columns TEXT;
BEGIN
  SELECT string_agg(column_name || ': ' || data_type, ', ')
  INTO v_columns
  FROM information_schema.columns
  WHERE table_name = 'ma_table'
    AND table_schema = 'public';

  RAISE NOTICE 'Structure actuelle: %', v_columns;
END $$;

-- ============================================================================
-- PARTIE 2: MODIFICATIONS DE STRUCTURE
-- ============================================================================

-- Ajout de colonnes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ma_table'
    AND column_name = 'nouvelle_colonne'
  ) THEN
    ALTER TABLE ma_table ADD COLUMN nouvelle_colonne text;
    RAISE NOTICE 'Colonne ajoutée';
  ELSE
    RAISE NOTICE 'Colonne existe déjà';
  END IF;
END $$;

-- ============================================================================
-- PARTIE 3: MODIFICATIONS DE DONNÉES
-- ============================================================================

-- Suppressions (si nécessaire)
DELETE FROM table_enfant;
DELETE FROM table_parent;

DO $$
BEGIN
  RAISE NOTICE 'Données supprimées';
END $$;

-- Insertions
DO $$
DECLARE
  v_record RECORD;
BEGIN
  FOR v_record IN SELECT * FROM source_table LOOP
    INSERT INTO destination_table (col1, col2)
    VALUES (v_record.col1, v_record.col2);
  END LOOP;

  RAISE NOTICE 'Insertion terminée';
END $$;

-- ============================================================================
-- PARTIE 4: VÉRIFICATION FINALE
-- ============================================================================

DO $$
DECLARE
  v_stats RECORD;
BEGIN
  SELECT COUNT(*) as total
  INTO v_stats
  FROM ma_table;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RÉSUMÉ';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total enregistrements: %', v_stats.total;
  RAISE NOTICE '========================================';
END $$;
```

---

## 🔍 CHECKLIST FINALE AVANT EXÉCUTION

- [ ] Le script compile sans erreur de syntaxe
- [ ] Tous les RAISE NOTICE sont dans des blocs DO $$
- [ ] Tous les noms de colonnes correspondent au DDL réel
- [ ] Tous les types de données sont corrects
- [ ] Les contraintes NOT NULL sont respectées
- [ ] Les clés étrangères pointent vers des enregistrements existants
- [ ] L'ordre des suppressions respecte les dépendances
- [ ] Le script est idempotent (peut être rejoué sans erreur)
- [ ] Des messages de confirmation sont présents
- [ ] Un résumé final est affiché

---

## 📚 RESSOURCES

- Documentation PostgreSQL: https://www.postgresql.org/docs/
- Documentation Supabase: https://supabase.com/docs/guides/database
- PL/pgSQL: https://www.postgresql.org/docs/current/plpgsql.html

---

## 🎯 RÈGLE D'OR

**AVANT d'écrire une seule ligne de SQL:**
1. Exporter le DDL de TOUTES les tables concernées
2. Lire et comprendre la structure complète
3. Noter les noms exacts des colonnes
4. Vérifier les types de données
5. PUIS écrire le script en respectant cette structure

**Ne JAMAIS supposer qu'une colonne existe ou s'appelle d'une certaine façon sans vérifier le DDL!**
