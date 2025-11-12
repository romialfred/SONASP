# 🔴 MIGRATION REQUISE - Correction Shipping Preparations

**URGENT** : Cette migration doit être exécutée pour corriger l'erreur lors de l'enregistrement des expéditions.

---

## ❌ Erreur Actuelle

```
Could not find the 'total_weight_oz' column of 'shipping_preparations' 
in the schema cache
```

**Cause** : Les colonnes `mining_company_id`, `license_id`, et `total_weight_oz` manquent dans la table `shipping_preparations`.

---

## ✅ Solution

### Étape 1 : Accéder au Dashboard Supabase

1. Ouvrez votre projet Supabase : https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **SQL Editor** (menu de gauche)

---

### Étape 2 : Exécuter la Migration

**Fichier** : `supabase/migrations/fix_shipping_preparations_columns.sql`

Copiez et collez le SQL suivant dans l'éditeur SQL :

```sql
/*
  # Correction de la structure de shipping_preparations

  ## Changements
  1. Ajoute les colonnes manquantes:
     - mining_company_id : Référence à la compagnie minière
     - license_id : Référence à la licence d'exportation
     - total_weight_oz : Poids total en onces troy

  ## Sécurité
  - Pas de changement aux politiques RLS existantes
  - Les colonnes sont accessibles avec les mêmes permissions que la table

  ## Notes
  - Utilise IF NOT EXISTS pour éviter les erreurs si les colonnes existent déjà
  - Conserve la compatibilité avec les données existantes
*/

-- 1. Ajouter mining_company_id si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipping_preparations' 
    AND column_name = 'mining_company_id'
  ) THEN
    ALTER TABLE shipping_preparations 
    ADD COLUMN mining_company_id UUID REFERENCES mining_companies(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_shipping_preparations_mining_company 
    ON shipping_preparations(mining_company_id);
  END IF;
END $$;

-- 2. Ajouter license_id si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipping_preparations' 
    AND column_name = 'license_id'
  ) THEN
    ALTER TABLE shipping_preparations 
    ADD COLUMN license_id UUID REFERENCES export_licenses(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_shipping_preparations_license 
    ON shipping_preparations(license_id);
  END IF;
END $$;

-- 3. Ajouter total_weight_oz si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipping_preparations' 
    AND column_name = 'total_weight_oz'
  ) THEN
    ALTER TABLE shipping_preparations 
    ADD COLUMN total_weight_oz DECIMAL(12, 4) DEFAULT 0;
    
    -- Mettre à jour les valeurs existantes basées sur total_net_weight_grams
    UPDATE shipping_preparations 
    SET total_weight_oz = ROUND((total_net_weight_grams / 31.1035)::numeric, 4)
    WHERE total_net_weight_grams > 0;
    
    CREATE INDEX IF NOT EXISTS idx_shipping_preparations_weight_oz 
    ON shipping_preparations(total_weight_oz);
  END IF;
END $$;

-- Commentaires pour documentation
COMMENT ON COLUMN shipping_preparations.mining_company_id IS 
'Référence à la compagnie minière d''origine de la production';

COMMENT ON COLUMN shipping_preparations.license_id IS 
'Référence à la licence d''exportation utilisée pour cette expédition';

COMMENT ON COLUMN shipping_preparations.total_weight_oz IS 
'Poids total net en onces troy (1 oz = 31.1035g), calculé à partir de total_net_weight_grams';
```

---

### Étape 3 : Exécuter

1. Cliquez sur **RUN** (ou Ctrl+Enter)
2. Vérifiez que le résultat affiche "Success" sans erreurs
3. La migration s'exécute de manière sécurisée (IF NOT EXISTS)

---

## 📊 Colonnes Ajoutées

### 1. `mining_company_id` (UUID)
- **Description** : Référence à la compagnie minière
- **Type** : UUID avec foreign key vers `mining_companies(id)`
- **Nullable** : Oui (ON DELETE SET NULL)
- **Index** : ✅ Créé

### 2. `license_id` (UUID)
- **Description** : Référence à la licence d'exportation
- **Type** : UUID avec foreign key vers `export_licenses(id)`
- **Nullable** : Oui (ON DELETE SET NULL)
- **Index** : ✅ Créé

### 3. `total_weight_oz` (DECIMAL)
- **Description** : Poids total en onces troy
- **Type** : DECIMAL(12, 4)
- **Default** : 0
- **Calcul** : total_net_weight_grams / 31.1035
- **Index** : ✅ Créé

---

## 🔍 Vérification Post-Migration

### Option 1 : Via SQL Editor

```sql
-- Vérifier que les colonnes existent
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shipping_preparations'
  AND column_name IN ('mining_company_id', 'license_id', 'total_weight_oz')
ORDER BY column_name;
```

**Résultat attendu** :
```
column_name          | data_type        | is_nullable
---------------------|------------------|------------
license_id           | uuid             | YES
mining_company_id    | uuid             | YES
total_weight_oz      | numeric          | YES
```

### Option 2 : Via l'Application

1. Rafraîchir l'application (F5)
2. Aller dans **Shipping > New Preparation**
3. Remplir le formulaire normalement
4. Cliquer sur **Enregistrement...**
5. ✅ **Attendu** : Enregistrement réussit sans erreur

---

## 🎯 Impact

### Avant Migration
- ❌ Erreur : "Could not find the 'total_weight_oz' column"
- ❌ Impossible d'enregistrer des expéditions
- ❌ Colonnes manquantes dans la base

### Après Migration
- ✅ Toutes les colonnes présentes
- ✅ Enregistrement fonctionne correctement
- ✅ Relations avec mining_companies et export_licenses
- ✅ Calcul automatique des poids en onces
- ✅ Index créés pour performance

---

## 🛡️ Sécurité

### Row Level Security (RLS)
- ✅ RLS reste activé sur la table
- ✅ Les politiques existantes s'appliquent aux nouvelles colonnes
- ✅ Pas de changement aux permissions

### Foreign Keys
- ✅ `mining_company_id` → `mining_companies(id)`
- ✅ `license_id` → `export_licenses(id)`
- ✅ ON DELETE SET NULL (sécurité des données)

### Index
- ✅ `idx_shipping_preparations_mining_company`
- ✅ `idx_shipping_preparations_license`
- ✅ `idx_shipping_preparations_weight_oz`

---

## ⚠️ Notes Importantes

### Sécurité de la Migration
- La migration utilise `IF NOT EXISTS` : peut être exécutée plusieurs fois sans erreur
- Aucune donnée existante n'est supprimée ou modifiée
- Les valeurs `total_weight_oz` sont calculées automatiquement pour les enregistrements existants

### Compatibilité
- ✅ Compatible avec toutes les données existantes
- ✅ Valeurs NULL acceptées pour les colonnes
- ✅ Calcul automatique pour total_weight_oz

### Rollback (si nécessaire)
```sql
-- ATTENTION : Ceci supprime les colonnes et leurs données !
-- N'exécuter que si absolument nécessaire

ALTER TABLE shipping_preparations 
DROP COLUMN IF EXISTS mining_company_id,
DROP COLUMN IF EXISTS license_id,
DROP COLUMN IF EXISTS total_weight_oz;
```

---

## 📝 Checklist Post-Migration

- [ ] Migration exécutée dans Supabase SQL Editor
- [ ] Résultat "Success" confirmé
- [ ] Vérification SQL exécutée (3 colonnes présentes)
- [ ] Application rafraîchie (F5)
- [ ] Test création expédition réussie
- [ ] Aucune erreur dans la console

---

## 🆘 En Cas de Problème

### Erreur : "relation mining_companies does not exist"
**Solution** : Créer d'abord la table `mining_companies` avec la migration appropriée.

### Erreur : "relation export_licenses does not exist"
**Solution** : Créer d'abord la table `export_licenses` avec la migration appropriée.

### Erreur : "column already exists"
**Solution** : Aucune action requise. La migration utilise IF NOT EXISTS, c'est normal.

---

## 📞 Support

Si vous rencontrez des difficultés :
1. Vérifiez que les tables `mining_companies` et `export_licenses` existent
2. Vérifiez les logs de migration dans Supabase Dashboard
3. Consultez la console du navigateur pour les erreurs détaillées
4. Contactez le support technique avec les messages d'erreur complets

---

**Temps estimé** : 2-3 minutes  
**Difficulté** : Facile (copier/coller SQL)  
**Impact** : Critique - Débloque l'enregistrement des expéditions  
**Réversible** : Oui (via rollback SQL)

---

✅ **Après cette migration, vous pourrez créer et enregistrer des expéditions sans erreur !**
