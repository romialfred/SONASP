# 🔍 DIAGNOSTIC SIMPLE - Étape par Étape

## ⚠️ Erreur Rencontrée

La colonne `location` n'existe pas dans `refinery_plants`.

## ✅ SOLUTION EN 3 ÉTAPES

### ÉTAPE 1: Diagnostic (30 secondes)

Dans Supabase SQL Editor, copiez-collez et exécutez:

```sql
-- DIAGNOSTIC_SIMPLE.sql

-- Voir la structure de refinery_plants
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'refinery_plants'
ORDER BY ordinal_position;
```

Cela vous montrera les colonnes réelles disponibles.

---

### ÉTAPE 2: Voir les Données (30 secondes)

```sql
-- Voir toutes les raffineries
SELECT * FROM refinery_plants LIMIT 3;

-- Voir toutes les compagnies de fret
SELECT * FROM freight_companies LIMIT 3;

-- Voir l'état de votre expédition
SELECT 
  expedition_lot_number,
  refinery_id,
  freight_company_id,
  shipped_to_company,
  shipped_to_address
FROM shipping_preparations
WHERE id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';
```

---

### ÉTAPE 3: Corriger (1 minute)

Une fois que vous voyez les données ci-dessus, vous saurez:

1. **Les colonnes disponibles** dans refinery_plants
2. **Les UUIDs des raffineries** disponibles
3. **Les UUIDs des compagnies de fret** disponibles
4. **L'état actuel** de votre expédition

Puis exécutez l'UPDATE:

```sql
-- Remplacez les UUIDs par ceux que vous avez vus ci-dessus
UPDATE shipping_preparations
SET 
  refinery_id = 'UUID_DE_LA_RAFFINERIE',
  freight_company_id = 'UUID_DE_LA_COMPAGNIE_FRET'
WHERE id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';
```

---

## 📋 EXEMPLE CONCRET

Imaginez que vous voyez:

**Raffineries:**
```
id: abc-123-... | name: Rand Refinery | country: South Africa
```

**Compagnies de Fret:**
```
id: def-456-... | name: Brinks
```

Alors votre UPDATE sera:

```sql
UPDATE shipping_preparations
SET 
  refinery_id = 'abc-123-...',
  freight_company_id = 'def-456-...'
WHERE id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';
```

---

## ✅ Vérification Finale

```sql
SELECT 
  sp.expedition_lot_number,
  r.name as raffinerie,
  r.country,
  f.name as compagnie_fret
FROM shipping_preparations sp
LEFT JOIN refinery_plants r ON r.id = sp.refinery_id
LEFT JOIN freight_companies f ON f.id = sp.freight_company_id
WHERE sp.id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';
```

Si vous voyez les noms, c'est bon !

---

## 🎯 FICHIERS À UTILISER

1. **DIAGNOSTIC_SIMPLE.sql** - Commencez ici
2. **QUICK_FIX_CORRECTED.sql** - Script complet corrigé

**Temps total:** 2-3 minutes
