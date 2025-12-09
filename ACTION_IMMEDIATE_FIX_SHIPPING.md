# ⚡ ACTION IMMÉDIATE - Corriger l'Expédition

## 🔴 SITUATION

L'expédition `43bfabcf-c1ab-4f02-ba2f-37aa15278adf` a été créée **AVANT** la correction du code.

**Problème:** Les colonnes `refinery_id` et `freight_company_id` sont NULL.

---

## 🎯 SOLUTION EN 2 ÉTAPES

### ÉTAPE 1: Diagnostic (1 min)

Dans Supabase SQL Editor, exécutez:

```sql
-- Fichier: diagnose_shipping_data.sql
```

Cela vous dira si cette expédition a des UUIDs valides dans les anciennes colonnes.

### ÉTAPE 2: Correction (2 options)

#### Option A: Correction Automatique (si UUIDs valides)

Si le diagnostic montre des UUIDs valides, exécutez:

```sql
-- Fichier: fix_specific_shipping.sql
```

#### Option B: Correction Manuelle (recommandé pour être sûr)

Exécutez cette requête SQL en remplaçant les UUIDs par les bons:

```sql
-- Obtenir les UUIDs disponibles
SELECT id, name FROM refinery_plants WHERE is_active = true;
SELECT id, name FROM freight_companies WHERE is_active = true;
SELECT id, license_number FROM export_licenses WHERE is_active = true;

-- Mettre à jour l'expédition avec les bons UUIDs
UPDATE shipping_preparations
SET 
  refinery_id = 'UUID_DE_LA_RAFFINERIE',
  freight_company_id = 'UUID_DE_LA_COMPAGNIE_FRET',
  export_license_id = 'UUID_DE_LA_LICENSE'
WHERE id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';
```

---

## 📋 EXEMPLE CONCRET

```sql
-- 1. Lister les raffineries disponibles
SELECT id, name, country FROM refinery_plants;

-- Exemple de résultat:
-- id: a1b2c3d4-...  | name: Rand Refinery | country: South Africa

-- 2. Lister les compagnies de fret
SELECT id, name FROM freight_companies;

-- Exemple de résultat:
-- id: e5f6g7h8-...  | name: Brinks Freight Express

-- 3. Mettre à jour avec les vrais UUIDs
UPDATE shipping_preparations
SET 
  refinery_id = 'a1b2c3d4-....',  -- UUID de Rand Refinery
  freight_company_id = 'e5f6g7h8-....',  -- UUID de Brinks
  export_license_id = '...'  -- UUID de la license
WHERE id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';
```

---

## ✅ VÉRIFICATION

Après l'update, exécutez:

```sql
SELECT 
  sp.id,
  sp.expedition_lot_number,
  r.name as refinery_name,
  f.name as freight_company_name,
  el.license_number
FROM shipping_preparations sp
LEFT JOIN refinery_plants r ON r.id = sp.refinery_id
LEFT JOIN freight_companies f ON f.id = sp.freight_company_id
LEFT JOIN export_licenses el ON el.id = sp.export_license_id
WHERE sp.id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';
```

Vous devriez voir les noms s'afficher.

---

## 🔄 POUR LES NOUVELLES EXPÉDITIONS

Les nouvelles expéditions créées APRÈS avoir redéployé le code front-end corrigé auront automatiquement les bonnes valeurs.

**Cette expédition spécifique nécessite une correction manuelle car elle a été créée avec l'ancien code.**

---

## 📝 ACTIONS

1. [ ] Exécuter le diagnostic
2. [ ] Identifier les UUIDs corrects
3. [ ] Exécuter l'UPDATE
4. [ ] Vérifier avec la requête SELECT
5. [ ] Rafraîchir la page dans l'application
6. [ ] ✅ Les informations s'affichent !

---

**TEMPS ESTIMÉ:** 5-10 minutes
