# 🚨 CORRECTION IMMÉDIATE - Erreur Shipping

## ❌ Erreur Actuelle

```
invalid input value for enum shipping_status_v2: "shipped"
```

## 🎯 Solution Immédiate

### ÉTAPE 1: Ouvrir Supabase Dashboard

1. Aller sur: https://supabase.com/dashboard
2. Sélectionner votre projet
3. Cliquer sur **SQL Editor** (dans le menu de gauche)

### ÉTAPE 2: Exécuter la Migration Critique

**Copier-coller ce SQL et cliquer RUN:**

```sql
-- ========================================
-- FIX URGENT: Add 'shipped' to production_status_v2
-- ========================================

-- Vérifier si production_status_v2 existe et contient 'shipped'
DO $$
BEGIN
  -- Ajouter 'shipped' à production_status_v2 si manquant
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'production_status_v2'
    AND e.enumlabel = 'shipped'
  ) THEN
    ALTER TYPE production_status_v2 ADD VALUE 'shipped' AFTER 'prepared';
    RAISE NOTICE '✅ Added shipped to production_status_v2';
  ELSE
    RAISE NOTICE '✅ production_status_v2 already has shipped';
  END IF;
END $$;

-- Vérifier la configuration finale
DO $$
DECLARE
  v_prod_enum text;
  v_ship_enum text;
  v_prod_values text[];
  v_ship_values text[];
BEGIN
  -- Get enum used by daily_production
  SELECT udt_name INTO v_prod_enum
  FROM information_schema.columns
  WHERE table_name = 'daily_production' AND column_name = 'status';

  -- Get enum used by shipping_preparations
  SELECT udt_name INTO v_ship_enum
  FROM information_schema.columns
  WHERE table_name = 'shipping_preparations' AND column_name = 'status';

  -- Get production_status_v2 values
  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
  INTO v_prod_values
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  WHERE t.typname = 'production_status_v2';

  -- Get shipping_status_v2 values
  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
  INTO v_ship_values
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  WHERE t.typname = 'shipping_status_v2';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'CONFIGURATION ACTUELLE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'daily_production.status uses: %', v_prod_enum;
  RAISE NOTICE 'production_status_v2 values: %', v_prod_values;
  RAISE NOTICE '';
  RAISE NOTICE 'shipping_preparations.status uses: %', v_ship_enum;
  RAISE NOTICE 'shipping_status_v2 values: %', v_ship_values;
  RAISE NOTICE '========================================';

  -- Vérifications
  IF v_prod_enum = 'production_status_v2' AND 'shipped' = ANY(v_prod_values) THEN
    RAISE NOTICE '✅ Configuration CORRECTE!';
  ELSE
    RAISE WARNING '⚠️  Configuration incorrecte détectée';
  END IF;
END $$;
```

### ÉTAPE 3: Vérifier le Résultat

Vous devriez voir dans les messages:

```
✅ Added shipped to production_status_v2
OU
✅ production_status_v2 already has shipped

========================================
CONFIGURATION ACTUELLE
========================================
daily_production.status uses: production_status_v2
production_status_v2 values: {prepared,shipped,cancelled}

shipping_preparations.status uses: shipping_status_v2
shipping_status_v2 values: {pending,prepared,validated_for_refinery,...}
========================================
✅ Configuration CORRECTE!
```

### ÉTAPE 4: Tester

1. Retourner sur votre application
2. Rafraîchir la page (F5)
3. Aller sur **Nouvelle Expédition**
4. Remplir le formulaire et **Enregistrer**

**Résultat attendu:** ✅ Sauvegarde réussie sans erreur!

---

## 🔍 Si Ça Ne Marche Toujours Pas

### Diagnostic Avancé

Exécuter ce SQL pour voir la configuration complète:

```sql
-- Voir TOUS les enums de status
SELECT
  t.typname as enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname LIKE '%status%'
GROUP BY t.typname
ORDER BY t.typname;

-- Voir quelle colonne utilise quel enum
SELECT
  table_name,
  column_name,
  udt_name as enum_type,
  column_default
FROM information_schema.columns
WHERE table_name IN ('daily_production', 'shipping_preparations')
AND column_name = 'status';
```

### Si production_status_v2 n'existe pas

Exécuter la migration complète:

```sql
-- Créer production_status_v2 avec shipped
DO $$ BEGIN
  DROP TYPE IF EXISTS production_status_v2 CASCADE;
  CREATE TYPE production_status_v2 AS ENUM (
    'prepared',
    'shipped',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Créer shipping_status_v2 sans shipped
DO $$ BEGIN
  DROP TYPE IF EXISTS shipping_status_v2 CASCADE;
  CREATE TYPE shipping_status_v2 AS ENUM (
    'pending',
    'prepared',
    'validated_for_refinery',
    'in_refining',
    'refined',
    'in_sale',
    'sold',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Assurer que daily_production utilise production_status_v2
DO $$
BEGIN
  -- Backup ancien status si existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_production' AND column_name = 'status'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_production' AND column_name = 'status_old_backup'
  ) THEN
    ALTER TABLE daily_production RENAME COLUMN status TO status_old_backup;
  END IF;

  -- Ajouter nouveau status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_production' AND column_name = 'status'
    AND udt_name = 'production_status_v2'
  ) THEN
    ALTER TABLE daily_production
      ADD COLUMN status production_status_v2 DEFAULT 'prepared' NOT NULL;
  END IF;
END $$;

-- Assurer que shipping_preparations utilise shipping_status_v2
DO $$
BEGIN
  -- Backup ancien status si existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations' AND column_name = 'status'
    AND udt_name != 'shipping_status_v2'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations' AND column_name = 'status_old_backup'
  ) THEN
    ALTER TABLE shipping_preparations ADD COLUMN status_old_backup TEXT;
    UPDATE shipping_preparations SET status_old_backup = status::text;
  END IF;

  -- Drop old column and add new
  ALTER TABLE shipping_preparations DROP COLUMN IF EXISTS status CASCADE;
  ALTER TABLE shipping_preparations
    ADD COLUMN status shipping_status_v2 DEFAULT 'pending' NOT NULL;
END $$;

RAISE NOTICE '✅ Migration complète appliquée!';
```

---

## 📞 Support

Si l'erreur persiste après ces étapes:

1. Vérifier les migrations déjà appliquées
2. Contacter le support avec le résultat des requêtes de diagnostic
3. Partager les messages d'erreur exacts

---

**⚡ Cette correction doit résoudre l'erreur immédiatement!**
