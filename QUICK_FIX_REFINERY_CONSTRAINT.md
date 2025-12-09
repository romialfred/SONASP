# 🔧 QUICK FIX - Contrainte Raffinerie

## 🚨 Le Problème

L'erreur que vous obtenez :
```
foreign key constraint "shipping_preparations_refinery_id_fkey"
Key (refinery_id) is not present in table "refinery_plants"
```

**Cause :** La contrainte pointe vers `refinery_plants` mais l'app utilise `refineries`.

---

## ✅ LA SOLUTION (3 minutes)

### Étape 1: Ouvrir Supabase SQL Editor

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Cliquez sur **SQL Editor** dans le menu de gauche
4. Cliquez sur **New Query**

### Étape 2: Copier-Coller Ce Script

```sql
-- SCRIPT DE CORRECTION RAPIDE
-- Corrige la contrainte de clé étrangère pour pointer vers 'refineries'

-- 1. Supprimer l'ancienne contrainte
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
    RAISE NOTICE '✅ Ancienne contrainte supprimée';
  END IF;
END $$;

-- 2. Créer la nouvelle contrainte vers 'refineries'
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
    RAISE NOTICE '✅ Nouvelle contrainte créée';
  END IF;
END $$;
```

### Étape 3: Exécuter

1. Cliquez sur le bouton **RUN** (ou appuyez sur Ctrl+Enter)
2. Vous devriez voir :
   ```
   ✅ Ancienne contrainte supprimée
   ✅ Nouvelle contrainte créée
   ```

### Étape 4: Tester

1. Retournez dans votre application
2. Allez dans **Shipping Preparations**
3. Créez une nouvelle préparation
4. Sélectionnez une raffinerie
5. Sauvegardez

✅ **Ça devrait fonctionner !**

---

## 🔍 Vérification (Optionnel)

Pour vérifier que la contrainte est bien corrigée :

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

**Résultat attendu :**
- `foreign_table_name` = `refineries` ✅

---

## 🆘 Si Ça Ne Marche Pas

### Erreur: "permission denied"
Vous devez être connecté en tant que propriétaire du projet Supabase.

### Erreur: "constraint does not exist"
Parfait ! Cela signifie que la contrainte a déjà été supprimée. Exécutez seulement la partie 2 du script.

### Erreur persist après le fix
1. Videz le cache de votre navigateur (Ctrl+Shift+Delete)
2. Déconnectez-vous et reconnectez-vous
3. Réessayez

---

## 📝 Ce Qui a Été Corrigé

**AVANT :**
```
shipping_preparations.refinery_id → refinery_plants.id ❌
```

**APRÈS :**
```
shipping_preparations.refinery_id → refineries.id ✅
```

Maintenant la base de données et le code frontend sont alignés !
