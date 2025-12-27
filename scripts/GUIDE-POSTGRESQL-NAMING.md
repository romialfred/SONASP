# Guide des Conventions de Nommage PostgreSQL

## Pourquoi l'Erreur s'est Produite

L'erreur rencontrée était :
```
ERROR: 42P01: relation "public.SNP_artisans_miniers" does not exist
```

### Cause Racine

PostgreSQL gère les noms de tables de deux manières différentes selon l'utilisation ou non de guillemets :

#### 1. Sans Guillemets (Recommandé)
```sql
CREATE TABLE artisans_miniers (...);
```
- PostgreSQL convertit automatiquement en **minuscules**
- La table créée est : `artisans_miniers`
- On peut y accéder sans guillemets : `SELECT * FROM artisans_miniers`

#### 2. Avec Guillemets (Sensible à la Casse)
```sql
CREATE TABLE "Artisans_Miniers" (...);
```
- PostgreSQL préserve **exactement** la casse
- La table créée est : `Artisans_Miniers` (avec majuscules)
- On DOIT toujours utiliser les guillemets : `SELECT * FROM "Artisans_Miniers"`

### Problème dans Notre Cas

Dans les migrations, on trouve une **incohérence** :

**Migration 1** (`20251227_001_create_artisans_miniers_system.sql`) :
```sql
CREATE TABLE IF NOT EXISTS "SNP_artisans_miniers" (...)
```
Crée : `SNP_artisans_miniers` (avec casse mixte)

**Migration 2** (`20251227_002_add_missing_columns_artisans.sql`) :
```sql
ALTER TABLE public.snp_artisans_miniers ADD COLUMN ...
```
Recherche : `snp_artisans_miniers` (tout en minuscules) ❌

Cette incohérence cause l'erreur car PostgreSQL ne trouve pas la table.

## Comment Éviter Cette Erreur

### Règle #1 : Utilisez TOUJOURS les Minuscules Sans Guillemets

**Recommandation PostgreSQL officielle** :
```sql
-- ✅ BON
CREATE TABLE artisans_miniers (...);
ALTER TABLE artisans_miniers ADD COLUMN ...;
SELECT * FROM artisans_miniers;

-- ❌ MAUVAIS
CREATE TABLE "Artisans_Miniers" (...);
CREATE TABLE "ARTISANS_MINIERS" (...);
```

### Règle #2 : Soyez Cohérent

Si vous DEVEZ utiliser des majuscules (pour des raisons de convention), soyez **100% cohérent** :

```sql
-- Si vous créez ainsi :
CREATE TABLE "SNP_artisans_miniers" (...);

-- Vous DEVEZ toujours utiliser :
ALTER TABLE "SNP_artisans_miniers" ADD COLUMN ...;
SELECT * FROM "SNP_artisans_miniers";
-- Pas : snp_artisans_miniers (sans guillemets)
```

### Règle #3 : Vérifiez les Noms Existants

Avant d'écrire un script SQL, vérifiez le nom exact de la table :

```sql
-- Lister toutes les tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Vérifier le nom exact avec la casse
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%artisan%';
```

## Convention Recommandée pour Ce Projet

### ✅ Nouvelle Convention (À Adopter)

Pour tous les futurs scripts et migrations :

```sql
-- Noms de tables : minuscules, snake_case, sans guillemets
CREATE TABLE artisans_miniers (...);
CREATE TABLE cartes_professionnelles (...);

-- Noms de colonnes : minuscules, snake_case
ALTER TABLE artisans_miniers ADD COLUMN quantite_or_vendu_grammes numeric;

-- Index : minuscules, préfixe descriptif
CREATE INDEX idx_artisans_chiffre_affaires ON artisans_miniers (...);

-- Fonctions : minuscules, snake_case
CREATE FUNCTION update_artisan_metrics(...) RETURNS void;
```

### 🔧 Migration des Tables Existantes (Si Nécessaire)

Si vous voulez uniformiser les tables existantes avec majuscules :

```sql
-- 1. Renommer la table (si elle existe avec majuscules)
ALTER TABLE IF EXISTS "SNP_artisans_miniers"
RENAME TO snp_artisans_miniers;

-- 2. Renommer la table des cartes (si elle existe)
ALTER TABLE IF EXISTS "SNP_cartes_professionnelles"
RENAME TO snp_cartes_professionnelles;

-- 3. Mettre à jour les références de clés étrangères
-- (PostgreSQL le fait automatiquement dans la plupart des cas)
```

⚠️ **ATTENTION** : Cette migration doit être testée en développement d'abord !

## Checklist pour Nouveaux Scripts SQL

Avant d'exécuter un nouveau script SQL :

- [ ] Vérifier le nom exact des tables existantes
- [ ] Utiliser des minuscules sans guillemets pour tous les nouveaux objets
- [ ] Être cohérent dans tout le script
- [ ] Tester d'abord en développement
- [ ] Vérifier que les migrations précédentes sont cohérentes

## Script Corrigé

Le script `ADD-ARTISAN-METRICS-COLUMNS.sql` a été corrigé pour utiliser :

```sql
-- ✅ Correct
ALTER TABLE public.snp_artisans_miniers ADD COLUMN ...;

-- Au lieu de :
-- ❌ Incorrect (casse mixte)
ALTER TABLE public."SNP_artisans_miniers" ADD COLUMN ...;
```

## Ressources

- [PostgreSQL Naming Conventions](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS)
- [Best Practices for Naming](https://wiki.postgresql.org/wiki/Don%27t_Do_This#Don.27t_use_upper_case_table_or_column_names)

## Résumé

**Règle d'Or** : Utilisez toujours des minuscules et snake_case sans guillemets pour tous les noms d'objets PostgreSQL (tables, colonnes, fonctions, index). C'est la convention la plus simple et la moins source d'erreurs.
