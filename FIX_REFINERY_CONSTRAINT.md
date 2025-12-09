# 🔧 Correction - Contrainte de Clé Étrangère Raffinerie

## 🚨 Problème Identifié

**Erreur lors de la sauvegarde d'une préparation de shipping:**

```
Erreur technique: insert or update on table "shipping_preparations"
violates foreign key constraint "shipping_preparations_refinery_id_fkey"

Code: 23503
Details: Key (refinery_id) is not present in table "refinery_plants".
```

**Cause Racine:**
- La table `shipping_preparations` a une contrainte de clé étrangère qui référence `refinery_plants`
- Mais l'application utilise la table `refineries` (pas `refinery_plants`)
- Conflit entre la structure de la base de données et le code de l'application

---

## ✅ Solution - Script SQL à Exécuter

### Étape 1: Ouvrir Supabase SQL Editor

1. Connectez-vous à **Supabase Dashboard**
2. Allez dans **SQL Editor**
3. Créez une nouvelle requête

### Étape 2: Exécuter Ce Script

Copiez et exécutez le script suivant:

```sql
/*
  # Fix Refinery Foreign Key Constraint

  1. Problem
    - shipping_preparations.refinery_id references refinery_plants(id)
    - But the application uses the 'refineries' table
    - Need to change the constraint to reference 'refineries' instead

  2. Solution
    - Drop the existing foreign key constraint
    - Add new constraint referencing 'refineries' table
*/

-- Drop the existing constraint that references refinery_plants
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'shipping_preparations_refinery_id_fkey'
    AND table_name = 'shipping_preparations'
  ) THEN
    ALTER TABLE shipping_preparations
    DROP CONSTRAINT shipping_preparations_refinery_id_fkey;

    RAISE NOTICE '✅ Dropped old constraint referencing refinery_plants';
  END IF;
END $$;

-- Add new constraint referencing refineries table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'shipping_preparations_refinery_id_fkey_refineries'
    AND table_name = 'shipping_preparations'
  ) THEN
    ALTER TABLE shipping_preparations
    ADD CONSTRAINT shipping_preparations_refinery_id_fkey_refineries
    FOREIGN KEY (refinery_id) REFERENCES refineries(id) ON DELETE SET NULL;

    RAISE NOTICE '✅ Added new constraint referencing refineries table';
  END IF;
END $$;
```

### Étape 3: Vérifier le Résultat

Vous devriez voir ces messages dans l'output:

```
✅ Dropped old constraint referencing refinery_plants
✅ Added new constraint referencing refineries table
```

---

## 🧪 Tester Après la Correction

### Test 1: Vérifier la Contrainte

Dans SQL Editor, exécutez:

```sql
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'shipping_preparations'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'refinery_id';
```

**Résultat attendu:**
- `foreign_table_name` doit être `refineries` (PAS `refinery_plants`)

### Test 2: Créer une Shipping Preparation

1. Allez dans **Shipping Preparations**
2. Cliquez sur **"Nouvelle Préparation"**
3. Remplissez tous les champs requis
4. Sélectionnez une raffinerie dans la liste
5. Cliquez sur **"Sauvegarder"**

✅ **Résultat attendu:** Sauvegarde réussie sans erreur

---

## 📊 Explication Technique

### Avant la Correction

```
shipping_preparations
  ├── refinery_id (UUID)
  └── FOREIGN KEY (refinery_id)
      └── REFERENCES refinery_plants(id)  ❌ MAUVAISE TABLE
```

**Frontend:** Charge depuis `refineries` ✅
**Base de données:** Contrainte vers `refinery_plants` ❌
**Résultat:** CONFLIT

### Après la Correction

```
shipping_preparations
  ├── refinery_id (UUID)
  └── FOREIGN KEY (refinery_id)
      └── REFERENCES refineries(id)  ✅ BONNE TABLE
```

**Frontend:** Charge depuis `refineries` ✅
**Base de données:** Contrainte vers `refineries` ✅
**Résultat:** COHÉRENT

---

## 🔍 Tables Concernées

### Table `refineries`
- Table principale pour les raffineries
- Contient: name, location, country, email, phone, etc.
- Utilisée par l'application frontend
- ✅ **C'est cette table qui doit être utilisée**

### Table `refinery_plants`
- Table créée par erreur ou pour un autre usage
- Ne contient pas de données actuellement
- N'est pas utilisée par l'application
- ❌ **Ne doit pas être référencée**

---

## 🛡️ Impact de la Correction

### Sécurité
- ✅ Aucun impact négatif sur la sécurité
- ✅ Les RLS policies restent inchangées
- ✅ Les permissions utilisateurs restent les mêmes

### Données Existantes
- ✅ Aucune perte de données
- ✅ Les shipping_preparations existantes restent intactes
- ⚠️ Si des préparations ont un `refinery_id` invalide, elles resteront en erreur jusqu'à correction manuelle

### Fonctionnalités
- ✅ Création de nouvelles shipping preparations fonctionnera
- ✅ Modification de shipping preparations existantes fonctionnera
- ✅ Toutes les autres fonctionnalités restent inchangées

---

## 📋 Checklist de Vérification

Après avoir exécuté le script SQL:

- [ ] Script exécuté sans erreur dans Supabase SQL Editor
- [ ] Messages de confirmation affichés (✅ Dropped old constraint, ✅ Added new constraint)
- [ ] Requête de vérification confirme que la contrainte pointe vers `refineries`
- [ ] Test de création d'une shipping preparation réussit
- [ ] Aucune régression sur les autres fonctionnalités

---

## 🆘 Si le Problème Persiste

### Erreur: "constraint already exists"

Si vous obtenez cette erreur, cela signifie que la contrainte existe déjà. Exécutez:

```sql
-- Forcer la suppression
ALTER TABLE shipping_preparations
DROP CONSTRAINT IF EXISTS shipping_preparations_refinery_id_fkey CASCADE;

ALTER TABLE shipping_preparations
DROP CONSTRAINT IF EXISTS shipping_preparations_refinery_id_fkey_refineries CASCADE;

-- Recréer proprement
ALTER TABLE shipping_preparations
ADD CONSTRAINT shipping_preparations_refinery_id_fkey_refineries
FOREIGN KEY (refinery_id) REFERENCES refineries(id) ON DELETE SET NULL;
```

### Erreur: "column does not exist"

Si `refinery_id` n'existe pas:

```sql
-- Ajouter la colonne si elle n'existe pas
ALTER TABLE shipping_preparations
ADD COLUMN IF NOT EXISTS refinery_id UUID;

-- Puis ajouter la contrainte
ALTER TABLE shipping_preparations
ADD CONSTRAINT shipping_preparations_refinery_id_fkey_refineries
FOREIGN KEY (refinery_id) REFERENCES refineries(id) ON DELETE SET NULL;
```

### Erreur: "permission denied"

Vous devez exécuter le script avec un compte ayant les droits d'administration sur la base de données. Utilisez le compte principal de votre projet Supabase.

---

## 📝 Prévention Future

Pour éviter ce type de problème à l'avenir:

1. **Nommage Cohérent:** Utiliser les mêmes noms de tables dans les migrations et le code
2. **Tests de Migrations:** Tester chaque migration avant de la déployer en production
3. **Documentation:** Documenter quelle table est utilisée pour chaque fonctionnalité
4. **Code Review:** Vérifier que les références de clés étrangères correspondent aux tables utilisées

---

## ✅ Statut Final

**Une fois le script exécuté:**
- ✅ Contrainte de clé étrangère corrigée
- ✅ `shipping_preparations.refinery_id` pointe vers `refineries.id`
- ✅ Création de shipping preparations fonctionnelle
- ✅ Sélection de raffineries fonctionnelle

**Action immédiate requise:** Exécuter le script SQL dans Supabase SQL Editor.

**Fichier disponible:** Le script SQL complet est dans `/tmp/fix_refinery_constraint.sql`
