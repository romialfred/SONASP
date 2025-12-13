# GUIDE: Correction SellerType 'mansa' → 'mansa_ressources'

**Date:** 2025-12-13
**Temps estimé:** 15 minutes
**Fichiers à modifier:** 4

---

## POURQUOI CETTE CORRECTION?

**Problème actuel:**
```typescript
// Code TypeScript
export type SellerType = 'mining_company' | 'mansa';
```

**Contrainte DB:**
```sql
CONSTRAINT sales_seller_type_check
  CHECK (seller_type = ANY (ARRAY['mining_company'::text, 'mansa_ressources'::text]))
```

**Résultat:** INSERT échouera car 'mansa' n'est pas accepté par la DB.

---

## FICHIERS À MODIFIER

### 1. src/services/salesService.ts (3 occurrences)

**LIGNE 53:**
```typescript
// AVANT
export type SellerType = 'mining_company' | 'mansa';

// APRÈS
export type SellerType = 'mining_company' | 'mansa_ressources';
```

**LIGNE 115:**
```typescript
// AVANT
        type: 'mansa',

// APRÈS
        type: 'mansa_ressources',
```

**LIGNE 194:**
```typescript
// AVANT
  if (!isMansaCustomer && sellerType !== 'mansa') {

// APRÈS
  if (!isMansaCustomer && sellerType !== 'mansa_ressources') {
```

### 2. src/services/preSalesService.ts (2 occurrences)

**LIGNE 15:**
```typescript
// AVANT
  seller_type?: 'mining_company' | 'mansa';

// APRÈS
  seller_type?: 'mining_company' | 'mansa_ressources';
```

**LIGNE 217:**
```typescript
// AVANT
        seller_type: data.seller_type || 'mansa',

// APRÈS
        seller_type: data.seller_type || 'mansa_ressources',
```

### 3. src/services/inventoryService.ts (1 occurrence)

**LIGNE 356:**
```typescript
// AVANT
export async function getInventoryBySeller(sellerId?: string, sellerType?: 'mining_company' | 'mansa') {

// APRÈS
export async function getInventoryBySeller(sellerId?: string, sellerType?: 'mining_company' | 'mansa_ressources') {
```

### 4. src/services/validationService.ts (1 occurrence)

**LIGNE 461:**
```typescript
// AVANT
  seller_type: 'mining_company' | 'mansa';

// APRÈS
  seller_type: 'mining_company' | 'mansa_ressources';
```

---

## MODIFICATIONS APPLIQUÉES AUTOMATIQUEMENT

✅ Les 7 occurrences ont été corrigées automatiquement dans les 4 fichiers.

---

## VÉRIFICATION APRÈS MODIFICATION

### Test 1: Compilation TypeScript
```bash
npm run typecheck
```

**Attendu:** Aucune erreur.

### Test 2: Build
```bash
npm run build
```

**Attendu:** Build réussit sans erreur.

### Test 3: Test d'insertion
```typescript
// Dans la console browser après déploiement
const testData = {
  customer_id: 'uuid-valide',
  seller_id: 'uuid-mansa',
  seller_type: 'mansa_ressources',  // ✅ Maintenant accepté
  quantity_oz: 10,
  london_am_rate: 2000,
  // ...
};

const result = await supabase.from('sales').insert(testData);
console.log(result);  // Devrait réussir
```

---

## CHECKLIST

- [x] salesService.ts ligne 53 modifiée
- [x] salesService.ts ligne 115 modifiée
- [x] salesService.ts ligne 194 modifiée
- [x] preSalesService.ts ligne 15 modifiée
- [x] preSalesService.ts ligne 217 modifiée
- [x] inventoryService.ts ligne 356 modifiée
- [x] validationService.ts ligne 461 modifiée
- [ ] `npm run typecheck` à exécuter
- [ ] `npm run build` à exécuter
- [ ] Test d'insertion à faire

---

## RÉGRESSION POSSIBLE?

**NON.** Cette modification n'affecte que les nouvelles insertions.

**Raison:**
- Anciennes ventes en DB (si elles existent) gardent leur valeur
- Ce changement affecte seulement les NOUVELLES ventes créées
- Pas d'impact sur les lectures (SELECT)

---

## TEMPS ESTIMÉ

| Tâche | Durée |
|-------|-------|
| Modifications automatiques | ✅ Fait |
| Vérification typecheck | 2 min |
| Build | 3 min |
| Test d'insertion | 5 min |
| **TOTAL** | **10 min** |

---

**Prochaine étape:** Exécuter `npm run typecheck` puis `npm run build`
