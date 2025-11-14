# 🔍 RAPPORT D'INVESTIGATION COMPLET - ERREUR SHIPPING

## ❌ ERREUR OBSERVÉE
```
invalid input value for enum shipping_preparation_status: "prepared"
```

---

## 🎯 CAUSE RACINE IDENTIFIÉE

### **PROBLÈME #1: CONFLIT D'ENUMS**
Il existe DEUX ENUMs dans la base de données:

1. **`shipping_status_v2`** (ANCIEN - MAUVAIS)
   - Valeurs: `'pending'`, `'prepared'`, `'validated_for_refinery'`, `'in_refining'`, `'refined'`, `'in_sale'`, `'sold'`, `'cancelled'`, `'shipped'`
   - Source: Migration initiale `add_shipping_system.sql` ligne 48

2. **`shipping_preparation_status`** (NOUVEAU - BON)
   - Valeurs: `'waiting_for_customs_approval'`, `'approved_by_customs'`, `'ready_for_expedition'`
   - Source: Migration `20251114_011_fix_shipping_enum_definitif.sql` ligne 180-184

### **PROBLÈME #2: LA TABLE UTILISE LE MAUVAIS ENUM**
La table `shipping_preparations` utilise probablement encore `shipping_status_v2` au lieu de `shipping_preparation_status`.

---

## 📋 FLUX COMPLET D'EXÉCUTION

### 1. PAGE: `ShippingPreparationNew.tsx`

**Fichier**: `/src/pages/shipping/ShippingPreparationNew.tsx`

#### Ligne 589:
```typescript
status: 'waiting_for_customs_approval' as const,  // ✅ BON STATUS
```

#### Fonction `handleSavePreparation()` (ligne 512-702):
```typescript
const prepData = {
  expedition_lot_number: expeditionLotNumber,
  seal_number: selectedProductions[0].sealNumber1,
  mining_company_id: selectedMiningCompanyId,
  license_id: selectedLicenseId,
  shipped_to_company: selectedFreightCompanyId,
  shipped_to_address: selectedRefineryId,
  total_net_weight_grams: totalNetWeightGrams,
  total_gross_weight_grams: totalGrossWeightGrams,
  total_weight_oz: totalNetWeightOz,
  status: 'waiting_for_customs_approval' as const,  // ✅ BON
  prepared_at: new Date().toISOString(),
};
```

**Lignes 594-597**: Debugging actif:
```typescript
console.log('=== DEBUG SHIPPING PREPARATION ===');
console.log('prepData.status:', prepData.status);
console.log('Full prepData:', JSON.stringify(prepData, null, 2));
console.log('==================================');
```

**Ligne 608**: Appel du service:
```typescript
const newPrep = await shippingPreparationService.createPreparation(prepData);
```

---

### 2. SERVICE: `shippingPreparationService.ts`

**Fichier**: `/src/services/shippingPreparationService.ts`

#### Fonction `createPreparation()` (lignes 104-129):

**Validation du statut** (lignes 107-116):
```typescript
const validStatuses: ShippingStatus[] = [
  'waiting_for_customs_approval',   // ✅ BON
  'approved_by_customs',             // ✅ BON
  'ready_for_expedition'             // ✅ BON
];

const cleanPreparation = { ...preparation };

if (!cleanPreparation.status || !validStatuses.includes(cleanPreparation.status as ShippingStatus)) {
  cleanPreparation.status = 'waiting_for_customs_approval';  // ✅ DEFAULT BON
  console.warn('Invalid or missing status, defaulting to: waiting_for_customs_approval');
}
```

**INSERT dans Supabase** (lignes 118-128):
```typescript
const { data, error } = await supabase
  .from('shipping_preparations')
  .insert({
    ...cleanPreparation,
    created_by: user?.id,
  })
  .select()
  .single();

if (error) throw error;  // ❌ C'EST ICI QUE L'ERREUR SE PRODUIT
return data;
```

---

### 3. BASE DE DONNÉES

#### MIGRATION INITIALE: `add_shipping_system.sql`

**Ligne 48** - Création de la table avec MAUVAIS ENUM:
```sql
status TEXT NOT NULL DEFAULT 'pending' 
CHECK (status IN ('pending', 'prepared', 'shipped'))
```

**❌ PROBLÈME**: Le status initial utilise `'prepared'` qui N'EXISTE PAS dans le nouvel ENUM!

#### MIGRATION CORRECTRICE: `20251114_011_fix_shipping_enum_definitif.sql`

Cette migration:
1. **Supprime toutes les données** (ligne 95)
2. **Supprime la colonne status** (ligne 112)
3. **Supprime l'ancien ENUM `shipping_status_v2`** (ligne 158)
4. **Crée le nouvel ENUM `shipping_preparation_status`** (lignes 180-184):
   ```sql
   CREATE TYPE shipping_preparation_status AS ENUM (
       'waiting_for_customs_approval',
       'approved_by_customs',
       'ready_for_expedition'
   );
   ```
5. **Recrée la colonne avec le BON ENUM** (lignes 204-207):
   ```sql
   ALTER TABLE shipping_preparations
   ADD COLUMN status shipping_preparation_status
   DEFAULT 'waiting_for_customs_approval'::shipping_preparation_status
   NOT NULL;
   ```

---

## 🔧 TRIGGERS & FONCTIONS

### À VÉRIFIER DANS LA BASE:

```sql
-- 1. Vérifier quel ENUM est actuellement utilisé
SELECT 
  c.column_name,
  c.data_type,
  c.udt_name,
  c.column_default
FROM information_schema.columns c
WHERE c.table_name = 'shipping_preparations'
AND c.column_name = 'status';

-- 2. Lister les valeurs de l'ENUM actuellement utilisé
SELECT 
  t.typname,
  e.enumlabel,
  e.enumsortorder
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname IN ('shipping_preparation_status', 'shipping_status_v2')
ORDER BY t.typname, e.enumsortorder;

-- 3. Vérifier tous les triggers sur la table
SELECT 
  trigger_name, 
  event_manipulation, 
  action_statement,
  action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'shipping_preparations';
```

---

## 🚨 DIAGNOSTICS POSSIBLES

### SCÉNARIO A: La migration n'a jamais été appliquée
- La table utilise encore l'ancien CHECK constraint avec `'prepared'`
- **Solution**: Appliquer la migration `20251114_011_fix_shipping_enum_definitif.sql`

### SCÉNARIO B: La table utilise encore `shipping_status_v2`
- La colonne `status` a le type `shipping_status_v2` au lieu de `shipping_preparation_status`
- **Solution**: Appliquer la migration correctrice

### SCÉNARIO C: Un trigger transforme le statut
- Un trigger BEFORE INSERT modifie `'waiting_for_customs_approval'` en `'prepared'`
- **Solution**: Identifier et supprimer/corriger le trigger

### SCÉNARIO D: Valeur par défaut incorrecte
- Le DEFAULT de la colonne est `'prepared'` au lieu de `'waiting_for_customs_approval'`
- **Solution**: ALTER TABLE pour changer le DEFAULT

---

## 📝 FICHIERS IMPLIQUÉS

### Frontend (TypeScript):
1. **`/src/pages/shipping/ShippingPreparationNew.tsx`**
   - Ligne 589: Définition du statut
   - Ligne 512-702: Fonction `handleSavePreparation()`
   - Ligne 608: Appel du service

2. **`/src/services/shippingPreparationService.ts`**
   - Ligne 104-129: Fonction `createPreparation()`
   - Ligne 131-151: Fonction `updatePreparation()`
   - Ligne 107-116: Validation des statuts

3. **`/src/services/unifiedStatusService.ts`** (NOUVELLEMENT CORRIGÉ)
   - Ligne 9-13: Type `ShippingStatus`
   - Définit les statuts corrects

### Backend (SQL Migrations):
1. **`/supabase/migrations/add_shipping_system.sql`**
   - Ligne 48: Création initiale avec MAUVAIS statuts

2. **`/supabase/migrations/20251114_011_fix_shipping_enum_definitif.sql`**
   - Ligne 180-184: ENUM correct
   - Ligne 204-207: Colonne avec BON type

3. **`/supabase/migrations/20251114_009_fix_shipping_workflow_statuses.sql`**
4. **`/supabase/migrations/20251114_010_remove_old_shipping_constraints.sql`**
5. **`/supabase/migrations/20251114_003_complete_status_enums_system.sql`**
6. **`/supabase/migrations/20251114_004_correct_status_enums_verified.sql`**

---

## ✅ PLAN DE RÉSOLUTION

### ÉTAPE 1: Vérifier l'état actuel
```sql
-- Exécuter dans le SQL Editor de Supabase
SELECT 
  c.column_name,
  c.data_type,
  c.udt_name,
  c.column_default
FROM information_schema.columns c
WHERE c.table_name = 'shipping_preparations'
AND c.column_name = 'status';
```

### ÉTAPE 2: Vérifier les ENUMs existants
```sql
SELECT 
  t.typname,
  array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname LIKE '%shipping%status%'
GROUP BY t.typname;
```

### ÉTAPE 3: Si la colonne utilise le mauvais type
- Appliquer la migration `20251114_011_fix_shipping_enum_definitif.sql` via le Dashboard Supabase

### ÉTAPE 4: Vérifier qu'il n'y a pas de triggers problématiques
```sql
SELECT * FROM information_schema.triggers 
WHERE event_object_table = 'shipping_preparations';
```

---

## 📞 COMMANDES DE DIAGNOSTIC À EXÉCUTER

```bash
# Se connecter à Supabase et exécuter ces requêtes SQL
# Via Dashboard > SQL Editor

-- 1. Vérifier le type de la colonne
SELECT 
  table_name,
  column_name,
  data_type,
  udt_name,
  column_default
FROM information_schema.columns
WHERE table_name = 'shipping_preparations'
AND column_name = 'status';

-- 2. Lister tous les ENUMs shipping
SELECT 
  t.typname as enum_name,
  array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname LIKE '%shipping%'
GROUP BY t.typname;

-- 3. Vérifier les contraintes CHECK
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'shipping_preparations'::regclass
AND contype = 'c';

-- 4. Lister les triggers
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'shipping_preparations';
```

---

## 🎯 RÉSUMÉ EXÉCUTIF

### Le bug se produit car:
1. Le code TypeScript envoie: `'waiting_for_customs_approval'` ✅
2. La base de données attend probablement: `'prepared'` ❌
3. Ou la base utilise encore l'ancien ENUM `shipping_status_v2` ❌

### Solution immédiate:
1. Vérifier quel ENUM est utilisé par `shipping_preparations.status`
2. Si c'est `shipping_status_v2`, appliquer la migration `20251114_011_fix_shipping_enum_definitif.sql`
3. Sinon, vérifier les triggers et contraintes CHECK

### La migration correctrice fait:
- ✅ Supprime toutes les données de test
- ✅ Supprime la colonne status
- ✅ Supprime l'ancien ENUM `shipping_status_v2`
- ✅ Crée le nouveau ENUM `shipping_preparation_status`
- ✅ Recrée la colonne avec le bon type et bon default

---

## 📌 PROCHAINE ACTION

**Exécutez les commandes de diagnostic ci-dessus dans le Dashboard Supabase pour identifier exactement quel ENUM est utilisé.**

Envoyez-moi les résultats et je pourrai vous dire précisément quelle migration appliquer.

