# ⚡ ACTION IMMÉDIATE - Version Corrigée

## 🎯 COPIEZ-COLLEZ DANS SUPABASE SQL EDITOR

### Étape 1: Voir ce qui existe (copier-coller tout)

```sql
-- 1. Voir les raffineries
SELECT id, name, country FROM refinery_plants;

-- 2. Voir les compagnies de fret
SELECT id, name FROM freight_companies;

-- 3. Voir l'état actuel de votre expédition
SELECT 
  expedition_lot_number,
  refinery_id,
  freight_company_id
FROM shipping_preparations
WHERE id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';
```

**Résultat attendu:**
- Liste des raffineries avec leurs UUIDs
- Liste des compagnies de fret avec leurs UUIDs
- État actuel: refinery_id et freight_company_id probablement NULL

---

### Étape 2: Corriger (remplacer les UUIDs)

**AVANT de copier-coller, remplacez:**
- `'...'` après `refinery_id =` par l'UUID d'une raffinerie (de l'étape 1)
- `'...'` après `freight_company_id =` par l'UUID d'une compagnie (de l'étape 1)

```sql
UPDATE shipping_preparations
SET 
  refinery_id = '...',
  freight_company_id = '...'
WHERE id = '43bfabcf-c1ab-4f02-ba2f-37aa15278adf';
```

---

### Étape 3: Vérifier

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

**Si vous voyez les noms → C'EST BON !**

---

### Étape 4: Rafraîchir l'Application

1. Retournez dans l'application
2. Rafraîchissez la page (F5)
3. Les informations doivent maintenant s'afficher

---

## 🔄 ALTERNATIVE PLUS SIMPLE

Si c'est trop compliqué, **créez simplement une nouvelle expédition** :
1. Le code est maintenant corrigé
2. Les nouvelles expéditions fonctionneront automatiquement
3. Pas besoin de corriger manuellement cette ancienne expédition

---

**Temps:** 2 minutes (correction) OU 30 secondes (nouvelle expédition)
