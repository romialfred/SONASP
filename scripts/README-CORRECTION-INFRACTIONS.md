# Correction Script Infractions - Respect Conventions

## Problème Identifié

Le script `CREATE-ARTISAN-INFRACTIONS-TABLE.sql` ne respectait pas les conventions de nommage obligatoires du projet.

### Erreurs Trouvées

1. **Nom de table incorrect**
   - ❌ `artisan_infractions`
   - ✅ `snp_artisan_infractions`

2. **Référence FK incorrecte**
   - ❌ `artisans_miniers`
   - ✅ `snp_artisans_miniers`

3. **Bucket storage incorrect**
   - ❌ `infraction-documents`
   - ✅ `snp-infraction-documents`

4. **Types enum incorrects**
   - ❌ `statut_traitement_infraction`
   - ✅ `snp_statut_traitement_infraction`

5. **Fonction trigger incorrecte**
   - ❌ `update_artisan_infractions_updated_at()`
   - ✅ `update_snp_artisan_infractions_updated_at()`

## Convention SNP_ Obligatoire

**RÈGLE #1:** TOUTES les **NOUVELLES** tables du système Gold Shipper doivent avoir le préfixe **snp_**

**SNP = SONASP** (Société Nationale d'Achat et de Stabilisation des Produits)

### ⚠️ IMPORTANT: Tables Existantes vs Nouvelles Tables

- **Tables EXISTANTES:** Garder le nom actuel (avec ou sans préfixe snp_)
  - Ne PAS renommer les tables déjà en production
  - Exemples: `mining_companies`, `user_profiles`, etc.

- **Tables NOUVELLES:** Préfixe `snp_` OBLIGATOIRE
  - Toute nouvelle table créée doit commencer par `snp_`
  - Exemple: `snp_artisan_infractions` (nouvelle table)

### Pourquoi cette convention ?

1. **Namespace isolation:** Évite les conflits avec d'autres systèmes
2. **Identification claire:** Les nouvelles tables sont facilement identifiables
3. **Migration progressive:** Permet d'ajouter des fonctionnalités sans casser l'existant
4. **Conformité:** Standard imposé par la checklist qualité SQL pour les nouveaux développements

## Corrections Appliquées

### 1. Script SQL

**Fichier:** `scripts/CREATE-ARTISAN-INFRACTIONS-TABLE.sql`

Modifications:
- Table: `artisan_infractions` → `snp_artisan_infractions`
- Référence FK: `artisans_miniers` → `snp_artisans_miniers`
- Bucket: `infraction-documents` → `snp-infraction-documents`
- Enum types: Préfixe `snp_` ajouté
- Fonction trigger: Préfixe `snp_` ajouté
- Indexes: Préfixe `idx_snp_` ajouté
- Structure du script: Organisée en 10 parties avec RAISE NOTICE
- Résumé final: Vérification automatique de la création

### 2. Service TypeScript

**Fichier:** `src/services/artisanInfractionsService.ts`

Modifications:
- `.from('artisan_infractions')` → `.from('snp_artisan_infractions')`
- `.from('infraction-documents')` → `.from('snp-infraction-documents')`

**Aucun changement** dans les interfaces TypeScript car elles reflètent les colonnes, pas les tables.

## Structure du Script Corrigé

```sql
-- ============================================================================
-- PARTIE 1: VÉRIFICATIONS
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Début création table snp_artisan_infractions';
END $$;

-- ============================================================================
-- PARTIE 2: CREATE ENUM TYPES
-- ============================================================================
DO $$
BEGIN
  CREATE TYPE snp_statut_traitement_infraction AS ENUM (...);
  RAISE NOTICE '✅ Type créé';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '⚠️  Type existe déjà';
END $$;

-- ... Parties 3-9 ...

-- ============================================================================
-- PARTIE 10: RÉSUMÉ
-- ============================================================================
DO $$
DECLARE
  v_table_exists boolean;
  v_bucket_exists boolean;
BEGIN
  -- Vérifications
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RÉSUMÉ DE LA CRÉATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Table snp_artisan_infractions: %', ...;
  RAISE NOTICE 'Bucket snp-infraction-documents: %', ...;
END $$;
```

## Checklist de Validation

Avant d'exécuter le script, vérifier:

- [x] Nom de table commence par `snp_`
- [x] Référence FK utilise `snp_artisans_miniers`
- [x] Bucket storage commence par `snp-`
- [x] Tous les enum types ont le préfixe `snp_`
- [x] Toutes les fonctions ont le préfixe approprié
- [x] Tous les indexes ont le préfixe `idx_snp_`
- [x] RAISE NOTICE encapsulés dans DO $$ blocks
- [x] Structure organisée en parties numérotées
- [x] Résumé final avec vérification

## Comment Exécuter le Script

### Via Supabase Dashboard (Recommandé)

1. Allez dans **SQL Editor**
2. Copiez tout le contenu de `CREATE-ARTISAN-INFRACTIONS-TABLE.sql`
3. Collez dans l'éditeur
4. Cliquez sur **Run**
5. Vérifiez les NOTICE messages dans la console

### Via outil de migration

```bash
node scripts/run-migration.js scripts/CREATE-ARTISAN-INFRACTIONS-TABLE.sql
```

## Résultats Attendus

Après exécution réussie, vous devriez voir:

```
NOTICE:  ========================================
NOTICE:  Début création table snp_artisan_infractions
NOTICE:  ========================================
NOTICE:  ✅ Type snp_statut_traitement_infraction créé
NOTICE:  ✅ Type snp_conclusion_infraction créé
NOTICE:  ✅ Table snp_artisan_infractions créée
NOTICE:  ✅ Indexes créés
NOTICE:  ✅ RLS activé sur snp_artisan_infractions
NOTICE:  ✅ Policies RLS créées (4 policies)
NOTICE:  ✅ Trigger updated_at créé
NOTICE:  ✅ Bucket storage snp-infraction-documents créé
NOTICE:  ⚠️  Anciennes policies storage supprimées
NOTICE:  ✅ Policies storage créées (4 policies)
NOTICE:  ========================================
NOTICE:  RÉSUMÉ DE LA CRÉATION
NOTICE:  ========================================
NOTICE:  Table snp_artisan_infractions: ✅
NOTICE:  Bucket snp-infraction-documents: ✅
NOTICE:  ========================================
NOTICE:  Script terminé avec succès
NOTICE:  ========================================
```

## Vérification Post-Exécution

### 1. Vérifier la table

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'snp_artisan_infractions';
```

### 2. Vérifier le bucket

```sql
SELECT id, name, public
FROM storage.buckets
WHERE id = 'snp-infraction-documents';
```

### 3. Vérifier les policies RLS

```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename = 'snp_artisan_infractions';
```

Devrait retourner 4 policies:
- Users can view all infractions
- Users can create infractions
- Users can update infractions
- Admins can delete infractions

### 4. Tester dans l'application

1. Aller sur la page d'un artisan minier
2. Cliquer sur l'onglet **Infractions**
3. Cliquer sur **Nouvelle Infraction**
4. Remplir et sauvegarder
5. Upload des documents
6. Vérifier que tout fonctionne

## Fichiers de Référence

Pour tous les futurs scripts SQL, toujours consulter:

1. **scripts/SQL-QUALITY-CHECKLIST.md** - Checklist qualité obligatoire
2. **scripts/README-SQL-QUALITY.md** - Guide d'utilisation
3. **scripts/GUIDE-POSTGRESQL-NAMING.md** - Conventions de nommage PostgreSQL
4. **scripts/DATABASE-SCHEMA.md** - Schéma complet de la base

## Règle d'Or

> **TOUS les scripts SQL doivent passer par la checklist qualité**
>
> **NOUVELLES tables uniquement: préfixe snp_ obligatoire**
>
> **Tables EXISTANTES: NE PAS renommer, garder tel quel**
>
> **TOUJOURS vérifier DATABASE-SCHEMA.md avant d'écrire du SQL**

---

**Date de correction:** 28 Décembre 2024
**Version:** 1.0
**Statut:** ✅ Corrigé et Validé
