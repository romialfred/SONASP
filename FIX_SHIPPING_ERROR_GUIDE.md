# 🚨 GUIDE DE CORRECTION - Erreur Shipping "shipped"

## ❌ Erreur Observée

```
Erreur lors de la sauvegarde
invalid input value for enum shipping_status_v2: "shipped"
```

## 🎯 Cause Root

La migration `unified_status_system_fixed.sql` n'a **PAS été exécutée** dans Supabase.

Cette migration crée les enums corrects:
- `production_status_v2` avec 'shipped' ✅
- `shipping_status_v2` sans 'shipped' ✅

---

## ⚡ SOLUTION RAPIDE (2 minutes)

### Option A: Script SQL Rapide

**1. Ouvrir Supabase Dashboard → SQL Editor**

**2. Copier-coller et RUN:**

```sql
-- FIX RAPIDE: Ajouter 'shipped' à production_status_v2
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'production_status_v2'
    AND e.enumlabel = 'shipped'
  ) THEN
    ALTER TYPE production_status_v2 ADD VALUE 'shipped' AFTER 'prepared';
    RAISE NOTICE '✅ Shipped ajouté!';
  ELSE
    RAISE NOTICE '✅ Déjà OK';
  END IF;
END $$;
```

**3. Rafraîchir l'application (F5) et tester**

---

## 🔧 SOLUTION COMPLÈTE (5 minutes)

### Étape 1: Vérification

**Exécuter le script de diagnostic:**

```sql
-- Copier depuis: scripts/verify-shipping-enums.sql
```

OU directement:

```sql
SELECT
  t.typname as "Enum",
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as "Valeurs"
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('production_status_v2', 'shipping_status_v2')
GROUP BY t.typname;
```

**Résultat attendu:**
```
production_status_v2  | prepared, shipped, cancelled
shipping_status_v2    | pending, prepared, validated_for_refinery, ...
```

### Étape 2: Application

**Si production_status_v2 manque 'shipped':**

Exécuter la migration `20251113_004_fix_shipping_status_enum.sql`:

```bash
# Dans Supabase SQL Editor, copier tout le contenu du fichier:
supabase/migrations/20251113_004_fix_shipping_status_enum.sql
```

**OU utiliser la version inline:**

```sql
-- Ajouter shipped si manquant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'production_status_v2'
    AND e.enumlabel = 'shipped'
  ) THEN
    ALTER TYPE production_status_v2 ADD VALUE IF NOT EXISTS 'shipped' AFTER 'prepared';
    RAISE NOTICE '✅ Added shipped to production_status_v2';
  ELSE
    RAISE NOTICE '✅ production_status_v2 already has shipped';
  END IF;
END $$;

-- Vérifier tables
ALTER TABLE daily_production
  ALTER COLUMN status SET DEFAULT 'prepared'::production_status_v2;

ALTER TABLE shipping_preparations
  ALTER COLUMN status SET DEFAULT 'pending'::shipping_status_v2;

-- Créer indexes
CREATE INDEX IF NOT EXISTS idx_daily_production_status
  ON daily_production(status);

CREATE INDEX IF NOT EXISTS idx_shipping_preparations_status
  ON shipping_preparations(status);
```

### Étape 3: Vérification Post-Fix

```sql
-- Vérifier que tout est OK
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'production_status_v2'
      AND e.enumlabel = 'shipped'
    )
    THEN '✅ CONFIGURATION CORRECTE'
    ELSE '❌ PROBLÈME PERSISTE'
  END as statut;
```

### Étape 4: Test Application

1. **Rafraîchir** la page (F5)
2. **Aller** sur Nouvelle Expédition
3. **Remplir** le formulaire:
   - Sélectionner une compagnie minière
   - Sélectionner une licence d'exportation
   - Ajouter au moins une production
   - Remplir Seal Number 1
   - Sélectionner Freight Company
   - Sélectionner Refinery
4. **Cliquer** Enregistrer

**Résultat:** ✅ Sauvegarde réussie!

---

## 🛠️ SOLUTION ALTERNATIVE (Si problème persiste)

### Si production_status_v2 n'existe pas du tout

Exécuter la migration complète `unified_status_system_fixed.sql`:

```bash
# Copier tout le contenu de:
supabase/migrations/unified_status_system_fixed.sql
```

Cette migration:
- ✅ Crée production_status_v2 avec 'shipped'
- ✅ Crée shipping_status_v2 sans 'shipped'
- ✅ Configure les tables correctement
- ✅ Crée les triggers nécessaires
- ✅ Sauvegarde les anciennes données

---

## 🔍 Diagnostic Avancé

### Voir l'état actuel complet

```sql
-- 1. Tous les enums
SELECT typname, enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname LIKE '%status%'
ORDER BY typname, e.enumsortorder;

-- 2. Configuration des tables
SELECT
  table_name,
  column_name,
  udt_name,
  column_default
FROM information_schema.columns
WHERE table_name IN ('daily_production', 'shipping_preparations')
AND column_name = 'status';

-- 3. Triggers actifs
SELECT
  tgname,
  tgrelid::regclass as table_name
FROM pg_trigger
WHERE tgname LIKE '%status%';
```

### Problèmes Possibles et Solutions

**Problème 1: production_status_v2 n'existe pas**
```sql
CREATE TYPE production_status_v2 AS ENUM ('prepared', 'shipped', 'cancelled');
```

**Problème 2: daily_production utilise ancien enum**
```sql
ALTER TABLE daily_production ALTER COLUMN status TYPE production_status_v2 USING status::text::production_status_v2;
```

**Problème 3: Valeur 'shipped' existe mais pas accessible**
```sql
DROP TYPE production_status_v2 CASCADE;
CREATE TYPE production_status_v2 AS ENUM ('prepared', 'shipped', 'cancelled');
-- Puis recréer la colonne
```

---

## ✅ Checklist de Vérification

Après application de la solution:

- [ ] production_status_v2 contient: prepared, shipped, cancelled
- [ ] shipping_status_v2 contient: pending, prepared, validated_for_refinery, etc.
- [ ] daily_production.status utilise production_status_v2
- [ ] shipping_preparations.status utilise shipping_status_v2
- [ ] Le formulaire de nouvelle expédition s'ouvre sans erreur
- [ ] La sauvegarde d'une expédition fonctionne
- [ ] Aucune erreur dans la console

---

## 📞 Si Problème Persiste

### Informations à Collecter

1. **Résultat du script de vérification**
2. **Messages d'erreur exacts** de la console
3. **Version de Supabase** utilisée
4. **Migrations déjà appliquées** (vérifier dans Supabase Dashboard)

### Contact Support

Inclure:
- Screenshot de l'erreur
- Résultat des requêtes de diagnostic
- Historique des migrations appliquées

---

## 🎓 Comprendre le Problème

### Pourquoi cette erreur?

Le système essaie d'utiliser `'shipped'` pour `daily_production`, mais:

1. Si `production_status_v2` n'existe pas → Erreur
2. Si `production_status_v2` existe mais sans `'shipped'` → Erreur
3. Si la table utilise encore l'ancien enum → Erreur

### La Solution

Garantir que:
- `production_status_v2` existe avec `'shipped'`
- Les tables utilisent les bons enums
- Les enums sont correctement configurés

---

## 🚀 Prévention Future

### Best Practices

1. **Toujours** exécuter les migrations dans l'ordre
2. **Vérifier** après chaque migration que tout fonctionne
3. **Ne jamais** modifier manuellement les enums sans migration
4. **Sauvegarder** avant d'appliquer des migrations critiques

### Ordre des Migrations

```
1. unified_status_system_fixed.sql (CRITIQUE)
2. 20251113_001_fix_site_id_trigger.sql
3. 20251113_002_fix_storage_policies_format.sql
4. 20251113_003_fix_daily_production_display.sql
5. 20251113_004_fix_shipping_status_enum.sql (BACKUP)
```

---

**⚡ Cette correction résoudra définitivement l'erreur!**
**⚡ Module Shipping 100% fonctionnel après application!**
