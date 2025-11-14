# ⚠️ ACTION IMMÉDIATE REQUISE - APPLIQUER LA MIGRATION

## 🚨 PROBLÈME ACTUEL

L'erreur persiste car **la migration n'a pas été appliquée dans Supabase**.

```
invalid input value for enum shipping_preparation_status: "prepared"
```

## ✅ SOLUTION - ÉTAPES À SUIVRE

### Étape 1: Ouvrir Supabase Dashboard

1. Aller sur https://supabase.com
2. Se connecter à votre compte
3. Sélectionner votre projet
4. Aller dans **Database** → **SQL Editor**

### Étape 2: Vérifier l'État Actuel

Coller et exécuter ce SQL:

```sql
-- Afficher les valeurs actuelles de l'ENUM
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'shipping_preparation_status'::regtype
ORDER BY enumsortorder;
```

**Si vous voyez:**
- `ready_for_customs`
- `approved_by_customs`
- `ready_for_expedition`

**Alors l'ENUM est INCORRECT (ancien)!**

### Étape 3: Appliquer la Migration

Dans le **SQL Editor** de Supabase, exécuter TOUT le contenu du fichier:
`supabase/migrations/20251114_009_fix_shipping_workflow_statuses.sql`

**OU copier-coller le SQL ci-dessous:**

```sql
/*
  # Fix Shipping Preparation Workflow - Statuses Corrects

  ## Nouveau Workflow:
  1. waiting_for_customs_approval (Statut initial à la création)
  2. approved_by_customs (Après approbation manuelle)
  3. ready_for_expedition (Prêt pour expédition finale)
*/

-- =====================================================
-- ÉTAPE 1: Recréer l'ENUM avec les bonnes valeurs
-- =====================================================

DO $$
BEGIN
  -- Supprimer l'ancien enum
  DROP TYPE IF EXISTS shipping_preparation_status CASCADE;

  -- Créer le nouveau avec le workflow correct
  CREATE TYPE shipping_preparation_status AS ENUM (
    'waiting_for_customs_approval',  -- EN ATTENTE APPROBATION DOUANE (Initial)
    'approved_by_customs',            -- APPROUVÉ PAR LA DOUANE
    'ready_for_expedition'            -- PRÊT POUR EXPÉDITION (Final)
  );

  RAISE NOTICE '✅ ENUM shipping_preparation_status recréé avec workflow correct';
  RAISE NOTICE '   1. waiting_for_customs_approval (initial)';
  RAISE NOTICE '   2. approved_by_customs';
  RAISE NOTICE '   3. ready_for_expedition (final)';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Erreur lors de la recréation de l''ENUM: %', SQLERRM;
END $$;

-- =====================================================
-- ÉTAPE 2: Réappliquer l'ENUM à la table
-- =====================================================

DO $$
DECLARE
  v_has_status boolean;
BEGIN
  -- Vérifier si la colonne status existe
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'shipping_preparations'
    AND column_name = 'status'
  ) INTO v_has_status;

  IF v_has_status THEN
    -- Supprimer la colonne existante
    ALTER TABLE shipping_preparations DROP COLUMN status CASCADE;
    RAISE NOTICE '✅ Ancienne colonne status supprimée';
  END IF;

  -- Ajouter la colonne avec le nouveau type et DEFAULT correct
  ALTER TABLE shipping_preparations
    ADD COLUMN status shipping_preparation_status DEFAULT 'waiting_for_customs_approval' NOT NULL;

  RAISE NOTICE '✅ Colonne status ajoutée avec DEFAULT: waiting_for_customs_approval';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Erreur lors de la modification de la table: %', SQLERRM;
END $$;

-- =====================================================
-- ÉTAPE 3: Ajouter commentaires
-- =====================================================

COMMENT ON TYPE shipping_preparation_status IS
'Workflow d''expédition avec approbation douanière:
1. waiting_for_customs_approval → En attente approbation douane (INITIAL)
2. approved_by_customs → Douane approuvée (via bouton manuel)
3. ready_for_expedition → Prêt pour expédition (FINAL)';

COMMENT ON COLUMN shipping_preparations.status IS
'Statut de l''expédition.
IMPORTANT:
- Création = waiting_for_customs_approval (automatique)
- Transition manuelle via bouton "Customs Approved"
- Peut rester en waiting_for_customs_approval plusieurs jours';

-- =====================================================
-- ÉTAPE 4: Vérification finale
-- =====================================================

DO $$
DECLARE
  v_enum_values text[];
  v_default_value text;
BEGIN
  -- Vérifier les valeurs de l'ENUM
  SELECT array_agg(enumlabel ORDER BY enumsortorder)
  INTO v_enum_values
  FROM pg_enum
  WHERE enumtypid = 'shipping_preparation_status'::regtype;

  -- Vérifier la valeur DEFAULT
  SELECT column_default
  INTO v_default_value
  FROM information_schema.columns
  WHERE table_name = 'shipping_preparations'
  AND column_name = 'status';

  RAISE NOTICE '====================================';
  RAISE NOTICE 'VÉRIFICATION FINALE';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'ENUM shipping_preparation_status:';
  RAISE NOTICE '  Valeurs: %', v_enum_values;
  RAISE NOTICE 'Table shipping_preparations:';
  RAISE NOTICE '  DEFAULT: %', v_default_value;
  RAISE NOTICE '====================================';
  RAISE NOTICE '✅ Migration terminée avec succès';
  RAISE NOTICE '====================================';

END $$;
```

### Étape 4: Vérifier que ça a Marché

Exécuter ce SQL pour vérifier:

```sql
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'shipping_preparation_status'::regtype
ORDER BY enumsortorder;
```

**Vous DEVEZ voir:**
- `waiting_for_customs_approval`
- `approved_by_customs`
- `ready_for_expedition`

### Étape 5: Rafraîchir l'Application

1. Dans le navigateur, appuyer sur **Ctrl + Shift + R** (hard refresh)
2. Ou vider le cache:
   - Ouvrir DevTools (F12)
   - Onglet "Application"
   - "Clear storage"
   - Recharger la page

### Étape 6: Tester

1. Aller dans "Shipping Preparation" → "Nouvelle Expédition"
2. Remplir le formulaire
3. Cliquer "Sauvegarder"
4. ✅ L'expédition doit être créée SANS ERREUR
5. ✅ Statut doit être "En Attente Douane" (jaune)

---

## 🔍 DIAGNOSTIC SI ÇA NE MARCHE TOUJOURS PAS

### Problème Possible #1: Table Existe Déjà avec Données

Si vous avez des expéditions existantes avec l'ancien statut:

```sql
-- Voir les enregistrements existants
SELECT id, status FROM shipping_preparations;

-- Si vous voyez des statuts invalides, vous devez les migrer ou les supprimer
```

**Solution A: Supprimer les données de test**
```sql
DELETE FROM shipping_preparations;
```

**Solution B: Migrer les données** (si vous voulez les garder)
```sql
-- Cette approche nécessite de recréer la colonne SANS supprimer les données
-- C'est plus complexe, demandez de l'aide si nécessaire
```

### Problème Possible #2: Contraintes de Clé Étrangère

Si d'autres tables référencent `shipping_preparations.status`:

```sql
-- Lister les contraintes
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'shipping_preparations';
```

### Problème Possible #3: Permissions Insuffisantes

Si vous obtenez une erreur de permission:
- Assurez-vous d'être connecté comme **Owner** du projet Supabase
- Ou utilisez le **service_role** key

---

## 📞 BESOIN D'AIDE?

Si après avoir suivi TOUTES ces étapes l'erreur persiste:

1. Prendre une capture d'écran du résultat de:
   ```sql
   SELECT enumlabel FROM pg_enum
   WHERE enumtypid = 'shipping_preparation_status'::regtype
   ORDER BY enumsortorder;
   ```

2. Prendre une capture d'écran de l'erreur dans la console du navigateur

3. Vérifier dans le Network tab (F12) quelle requête exacte est envoyée à Supabase

---

**IMPORTANT: La migration DOIT être appliquée dans Supabase Dashboard SQL Editor!**

Le code frontend est 100% correct. Le problème est que la base de données utilise encore l'ancien ENUM.
