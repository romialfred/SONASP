# Correction du Stock par Vendeur (Mining Company)

## Date
2025-12-11

## Problème Identifié

Le système affichait **TOUT** le stock disponible (appartenant à Mansa) au lieu du stock spécifique à la Mining Company sélectionnée comme vendeur.

### Comportement Incorrect (Avant)

```typescript
// La fonction ne filtrait PAS par sellerId
export async function getInventoryBySeller(sellerId?: string, sellerType?: 'mining_company' | 'mansa') {
  const { data, error } = await supabase
    .from('gold_inventory')
    .select('quantity_available_oz, final_fine_grams, final_fine_oz')
    .eq('transaction_type', 'entry');

  // Retournait TOUT l'inventaire sans filtrer
  return totalAvailableOz;
}
```

**Résultat:** Le formulaire affichait toujours 1244.227 oz peu importe la Mining Company sélectionnée.

## Solution Implémentée

### 1. Correction de la Fonction `getInventoryBySeller`

**Fichier:** `src/services/inventoryService.ts`

La fonction filtre maintenant correctement par Mining Company en suivant la chaîne de relations:

```
Mining Company → Production → Freight Shipments → Gold Inventory
```

**Nouvelle Logique:**

```typescript
export async function getInventoryBySeller(sellerId?: string, sellerType?: 'mining_company' | 'mansa') {
  // Pour Mining Company
  if (sellerType === 'mining_company') {
    // Étape 1: Récupérer toutes les productions de cette Mining Company
    const { data: productions } = await supabase
      .from('production')
      .select('id')
      .eq('mining_company_id', sellerId);

    // Étape 2: Récupérer les freight_shipments liés à ces productions
    const { data: shipments } = await supabase
      .from('freight_shipments')
      .select('id')
      .in('production_id', productionIds);

    // Étape 3: Récupérer l'inventaire lié à ces shipments
    const { data: inventory } = await supabase
      .from('gold_inventory')
      .select('quantity_available_oz, final_fine_grams, final_fine_oz')
      .eq('transaction_type', 'entry')
      .in('freight_shipment_id', shipmentIds);

    // Calculer le total
    return totalAvailableOz;
  }
}
```

### 2. Amélioration de l'Interface Utilisateur

**Fichier:** `src/pages/sales/SaleCreate.tsx`

#### A. Affichage du Stock avec Alerte

Le stock est maintenant affiché avec un code couleur:
- **Bleu:** Stock disponible > 0
- **Rouge:** Stock = 0 (pas de stock)

```tsx
<p className={`text-lg font-bold ${availableInventoryOz > 0 ? 'text-blue-700' : 'text-red-600'}`}>
  {availableInventoryOz.toFixed(3)} oz
</p>
```

#### B. Message d'Alerte si Pas de Stock

Si la Mining Company n'a pas de stock, un message d'avertissement s'affiche:

```tsx
{!loadingInventory && availableInventoryOz === 0 && (
  <Alert type="warning" title="No Inventory Available">
    This mining company currently has no gold available in inventory.
    Gold must be refined and added to inventory before creating a sale.
  </Alert>
)}
```

#### C. Validation Renforcée

La validation empêche maintenant la création de vente si le stock est 0:

```typescript
// Dans validateForm()
if (formData.miningCompanyId && availableInventoryOz === 0) {
  newErrors.miningCompanyId = 'This mining company has no inventory available. Please add gold to inventory first.';
}
```

## Chaîne de Relations

### Structure des Données

```
┌─────────────────────┐
│ Mining Company      │
│ - id                │
│ - name              │
└─────────┬───────────┘
          │
          │ mining_company_id
          ↓
┌─────────────────────┐
│ Production          │
│ - id                │
│ - mining_company_id │
└─────────┬───────────┘
          │
          │ production_id
          ↓
┌─────────────────────┐
│ Freight Shipments   │
│ - id                │
│ - production_id     │
└─────────┬───────────┘
          │
          │ freight_shipment_id
          ↓
┌─────────────────────┐
│ Gold Inventory      │
│ - id                │
│ - freight_shipment_id│
│ - quantity_available_oz│
│ - final_fine_grams  │
└─────────────────────┘
```

### Exemple de Données

**Yanfolila (Mining Company)**
- Production #1 → Freight Shipment #10 → Inventory: 500 oz
- Production #2 → Freight Shipment #11 → Inventory: 744.227 oz
- **Total Stock Yanfolila:** 1244.227 oz

**Morila (Mining Company)**
- Production #3 → Freight Shipment #12 → Inventory: 300 oz
- **Total Stock Morila:** 300 oz

**Comportement:**
- Si l'utilisateur sélectionne Yanfolila → Affiche 1244.227 oz
- Si l'utilisateur sélectionne Morila → Affiche 300 oz

## Distinction: Mining Company vs Mansa

### Scénario 1: Mining Company vend à Mansa (vente interne)

```
Vendeur: Yanfolila (Mining Company)
Client: Mansa Resources
Stock affiché: Stock de Yanfolila uniquement (1244.227 oz)
```

### Scénario 2: Mansa vend à un client externe

```
Vendeur: Mansa Resources
Client: Auramet ou StoneX
Stock affiché: TOUT le stock disponible (après achat des Mining Companies)
```

**Note:** Le stock "appartient" à la Mining Company jusqu'à ce que Mansa l'achète via une vente interne.

## Workflow Complet

### 1. Production de l'Or

```sql
INSERT INTO production (mining_company_id, ...)
VALUES ('yanfolila-uuid', ...);
```

### 2. Création du Freight Shipment

```sql
INSERT INTO freight_shipments (production_id, ...)
VALUES ('production-uuid', ...);
```

### 3. Ajout à l'Inventaire (après raffinage)

```sql
INSERT INTO gold_inventory (
  freight_shipment_id,
  quantity_available_oz,
  transaction_type
) VALUES (
  'shipment-uuid',
  500.000,
  'entry'
);
```

### 4. Vérification du Stock

```typescript
const result = await getInventoryBySeller('yanfolila-uuid', 'mining_company');
console.log(result.availableOz); // 500 oz
```

### 5. Création de la Vente

```typescript
// Le stock de Yanfolila est vérifié avant la création
if (quantityOz > yanfolilaStock) {
  throw new Error('Insufficient inventory');
}

// Vente créée avec seller_id = yanfolila-uuid
await createSale({
  seller_id: 'yanfolila-uuid',
  seller_type: 'mining_company',
  customer_id: 'mansa-uuid',
  quantity_oz: 400
});
```

## Tests Recommandés

### Test 1: Vérifier le Stock par Mining Company

```typescript
// Test avec Yanfolila
const yanfolilaStock = await getInventoryBySeller('yanfolila-uuid', 'mining_company');
console.log('Yanfolila Stock:', yanfolilaStock.availableOz);

// Test avec Morila
const morilaStock = await getInventoryBySeller('morila-uuid', 'mining_company');
console.log('Morila Stock:', morilaStock.availableOz);

// Les deux doivent être différents si les productions sont différentes
```

### Test 2: Vérifier l'Affichage dans le Formulaire

1. Ouvrir le formulaire de création de vente
2. Sélectionner Yanfolila comme vendeur
3. Vérifier que le stock affiché correspond aux shipments de Yanfolila
4. Changer pour Morila
5. Vérifier que le stock change

### Test 3: Validation avec Stock = 0

1. Sélectionner une Mining Company sans production/inventory
2. Vérifier que le stock affiché est 0.000 oz (en rouge)
3. Vérifier l'alerte "No Inventory Available"
4. Essayer de cliquer "Calculate Invoice"
5. Vérifier l'erreur de validation

### Test 4: Vente Impossible si Pas de Stock

1. Mining Company avec 0 oz de stock
2. Tenter de créer une vente
3. Vérifier que la validation bloque avec le message approprié

## Interface Visuelle

### Avant (Incorrect)

```
┌─────────────────────────────────────────────┐
│ Seller: Yanfolila                           │
│ Available Inventory: 1244.227 oz ✓          │
│                                             │
│ (Toujours le même stock peu importe)       │
└─────────────────────────────────────────────┘
```

### Après (Correct)

```
┌─────────────────────────────────────────────┐
│ Seller: Yanfolila                           │
│ Available Inventory: 1244.227 oz ✓ (bleu)  │
│                                             │
│ (Stock spécifique à Yanfolila)             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Seller: Morila                              │
│ Available Inventory: 0.000 oz ✗ (rouge)    │
│                                             │
│ ⚠ No Inventory Available                   │
│ This mining company currently has no gold   │
│ available in inventory...                   │
└─────────────────────────────────────────────┘
```

## Améliorations Futures (Optionnel)

### 1. Détail du Stock par Production

Afficher le détail du stock par production:

```
Yanfolila Stock Breakdown:
- Production #001 (Oct 2024): 500.00 oz
- Production #002 (Nov 2024): 744.23 oz
─────────────────────────────────────
Total: 1244.23 oz
```

### 2. Historique des Ventes

Afficher l'historique des ventes de la Mining Company:

```
Recent Sales (Yanfolila):
- Sale #001: 400 oz to Mansa (Nov 15, 2024)
- Sale #002: 300 oz to Mansa (Nov 20, 2024)
```

### 3. Alertes de Stock Faible

Avertir quand le stock devient faible:

```
⚠ Low Inventory Warning
Yanfolila has only 100 oz remaining.
Consider delaying sales or increasing production.
```

### 4. Graphique de Stock

Visualiser l'évolution du stock:

```
Stock Evolution (Last 6 Months)
     │
1500 │     ╱─╲
     │    ╱   ╲
1000 │   ╱     ╲___
     │  ╱          ╲
 500 │ ╱            ╲
     └─────────────────
     Jan Feb Mar Apr May Jun
```

## Build Status

✅ Build réussi sans erreurs
✅ Fonction getInventoryBySeller corrigée
✅ Validation renforcée
✅ Interface utilisateur améliorée
✅ Messages d'alerte appropriés

## Conclusion

Le système affiche maintenant correctement le stock de chaque Mining Company. Le stock n'appartient pas à Mansa mais bien à la Mining Company qui l'a produit, jusqu'à ce qu'une vente interne soit effectuée.

La validation empêche la création de ventes si la Mining Company n'a pas de stock disponible, garantissant l'intégrité des données.

---

**Status:** ✅ CORRECTION COMPLÈTE - BUILD RÉUSSI

**Date:** 2025-12-11
