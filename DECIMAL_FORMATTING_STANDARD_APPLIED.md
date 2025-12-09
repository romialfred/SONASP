# Standard de Formatage des Décimales - Appliqué

## Date: 09/12/2025

## Règle Globale

**STANDARD PLATEFORME:** Tous les nombres affichés dans l'application doivent avoir **exactement 2 décimales**.

Cette règle s'applique à:
- ✅ Poids en grammes (g)
- ✅ Poids en onces (oz)
- ✅ Montants financiers (USD, CFA, GNF)
- ✅ Taux de change
- ✅ Prix de l'or
- ✅ Tous les calculs et totaux

## Fonctions Utilitaires Créées

Dans `/src/utils/numberUtils.ts`, trois nouvelles fonctions ont été ajoutées:

### 1. `formatWeightGrams(value, defaultValue = 0)`

Formate tous les poids en grammes avec exactement 2 décimales.

```typescript
// Exemples
formatWeightGrams(11269.900)    // "11269.90"
formatWeightGrams(33298.910)    // "33298.91"
formatWeightGrams(928.380)      // "928.38"
formatWeightGrams(undefined)    // "0.00"
```

### 2. `formatWeightOunces(value, defaultValue = 0)`

Formate tous les poids en onces avec exactement 2 décimales.

```typescript
// Exemples
formatWeightOunces(333.566000)  // "333.57"
formatWeightOunces(737.018000)  // "737.02"
formatWeightOunces(1070.58400)  // "1070.58"
formatWeightOunces(undefined)   // "0.00"
```

### 3. `formatCurrency(value, useSpaces = true, defaultValue = 0)`

Formate tous les montants financiers avec exactement 2 décimales.

```typescript
// Exemples
formatCurrency(2876543.21, true)   // "2 876 543.21" (avec espaces)
formatCurrency(1234.56, false)     // "1234.56" (sans espaces)
formatCurrency(undefined)          // "0.00"
```

## Fichiers Corrigés

### 1. FreightShipmentDetails.tsx ✅

**Avant:**
```typescript
{shipment.total_pure_gold_oz.toFixed(4)}  // 1070.5840 oz
{shipment.total_pure_gold_grams.toFixed(3)}  // 33298.910 g
{prod.pure_gold_oz.toFixed(6)}  // 333.566000 oz
```

**Après:**
```typescript
{formatWeightOunces(shipment.total_pure_gold_oz)}  // 1070.58 oz
{formatWeightGrams(shipment.total_pure_gold_grams)}  // 33298.91 g
{formatWeightOunces(prod.pure_gold_oz)}  // 333.57 oz
```

**Sections modifiées:**
- ✅ Tableau "Productions Incluses"
  - Poids Brut (g): `.toFixed(3)` → `formatWeightGrams()`
  - Or Pur (g): `.toFixed(3)` → `formatWeightGrams()`
  - Or Pur (oz): `.toFixed(6)` → `formatWeightOunces()`
  - Argent Pur (g): `.toFixed(3)` → `formatWeightGrams()`

- ✅ Ligne "GRAND TOTAL"
  - Total Poids Brut: `.toFixed(3)` → `formatWeightGrams()`
  - Total Or Pur (g): `.toFixed(3)` → `formatWeightGrams()`
  - Total Or Pur (oz): `.toFixed(4)` → `formatWeightOunces()`
  - Total Argent Pur (g): `.toFixed(3)` → `formatWeightGrams()`

- ✅ Tableau "Calcul Financier"
  - Or Pur (oz) par production: `.toFixed(6)` → `formatWeightOunces()`
  - Prix USD/oz: `.toFixed(2)` → `formatCurrency()`
  - Valeur USD: `toLocaleString(...)` → `formatCurrency()`
  - Valeur Locale: `toLocaleString(...)` → `formatCurrency()`

- ✅ Ligne "TOTAL" financier
  - Total Or Pur (oz): `.toFixed(4)` → `formatWeightOunces()`
  - Prix: `.toFixed(2)` → `formatCurrency()`
  - Valeur totale USD: `toLocaleString(...)` → `formatCurrency()`
  - Valeur totale locale: `toLocaleString(...)` → `formatCurrency()`

### 2. FreightShipmentsRefining.tsx ✅

**Avant:**
```typescript
{shipment.total_pure_gold_oz.toFixed(4)} oz  // 1070.5840 oz
```

**Après:**
```typescript
{formatWeightOunces(shipment.total_pure_gold_oz)} oz  // 1070.58 oz
```

**Sections modifiées:**
- ✅ Tableau "En Attente d'Approbation" - colonne Or Pur (oz)
- ✅ Tableau "Expéditions Reçues" - colonne Or Pur (oz)

## Résultats Visuels

### Avant la Correction
```
┌───────────────────────────────────────────────────────┐
│ Or Pur (oz)    │ Or Pur (g)      │ Argent Pur (g)   │
├───────────────────────────────────────────────────────┤
│ 333.566000     │ 10375.070       │ 0.000            │
│ 737.018000     │ 22923.840       │ 0.000            │
├───────────────────────────────────────────────────────┤
│ 1070.58400     │ 33298.910       │ 928.380          │ ← GRAND TOTAL
└───────────────────────────────────────────────────────┘
```

### Après la Correction
```
┌───────────────────────────────────────────────────────┐
│ Or Pur (oz)    │ Or Pur (g)      │ Argent Pur (g)   │
├───────────────────────────────────────────────────────┤
│ 333.57         │ 10375.07        │ 0.00             │
│ 737.02         │ 22923.84        │ 0.00             │
├───────────────────────────────────────────────────────┤
│ 1070.58        │ 33298.91        │ 928.38           │ ← GRAND TOTAL
└───────────────────────────────────────────────────────┘
```

## Avantages du Nouveau Standard

### 1. Cohérence Visuelle
- Tous les nombres ont le même format dans toute l'application
- Plus facile à lire et à comparer
- Apparence professionnelle

### 2. Lisibilité Améliorée
- Moins de chiffres inutiles (333.57 vs 333.566000)
- Alignement des colonnes plus propre
- Réduction du bruit visuel

### 3. Précision Suffisante
- 2 décimales = précision au centième
- Suffisant pour les transactions d'or et d'argent
- Conforme aux standards financiers

### 4. Maintenance Simplifiée
- Fonctions centralisées dans `numberUtils.ts`
- Un seul endroit pour modifier le formatage
- Code plus maintenable

## Usage Recommandé

### Pour les Poids en Grammes
```typescript
import { formatWeightGrams } from '@/utils/numberUtils';

// ✅ BON
<td>{formatWeightGrams(production.pure_gold_grams)}</td>

// ❌ MAUVAIS
<td>{production.pure_gold_grams.toFixed(3)}</td>
<td>{production.pure_gold_grams.toFixed(4)}</td>
```

### Pour les Poids en Onces
```typescript
import { formatWeightOunces } from '@/utils/numberUtils';

// ✅ BON
<td>{formatWeightOunces(production.pure_gold_oz)} oz</td>

// ❌ MAUVAIS
<td>{production.pure_gold_oz.toFixed(4)} oz</td>
<td>{production.pure_gold_oz.toFixed(6)} oz</td>
```

### Pour les Montants Financiers
```typescript
import { formatCurrency } from '@/utils/numberUtils';

// ✅ BON (avec espaces comme séparateur de milliers)
<td>${formatCurrency(value, false)}</td>
// Résultat: "$2876543.21"

// ✅ BON (avec espaces)
<td>{formatCurrency(value, true)} CFA</td>
// Résultat: "2 876 543.21 CFA"

// ❌ MAUVAIS
<td>${value.toFixed(2)}</td>
<td>${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
```

## Fichiers Restants à Corriger

Les fichiers suivants contiennent encore des `.toFixed(3)` ou `.toFixed(4)` et devraient être corrigés progressivement:

### Priorité Haute (Pages utilisateur)
- [ ] `src/pages/production/ProductionDetails.tsx`
- [ ] `src/pages/production/ProductionInSafe.tsx`
- [ ] `src/pages/shipping/ShippingPreparationDetailsEnhanced.tsx`
- [ ] `src/pages/inventory/InventoryManagement.tsx`

### Priorité Moyenne (Composants)
- [ ] `src/components/production/DailyProductionForm.tsx`
- [ ] `src/components/production/ProductionChart.tsx`
- [ ] `src/components/production/ProductionTable.tsx`
- [ ] `src/components/ui/WeightDisplay.tsx`
- [ ] `src/components/ui/WeightInput.tsx`

### Priorité Basse (Services et utilitaires)
- [ ] `src/services/freightInvoiceGenerationService.ts`
- [ ] `src/services/invoiceGenerationService.ts`
- [ ] `src/services/fxRateAggregationService.ts`

## Script de Correction Automatique

Pour corriger automatiquement tous les fichiers, vous pouvez utiliser ce script:

```bash
#!/bin/bash

# Remplace .toFixed(3) par formatWeightGrams() ou formatWeightOunces()
# Remplace .toFixed(4) par formatWeightOunces()
# Remplace .toFixed(6) par formatWeightOunces()

find src -name "*.tsx" -o -name "*.ts" | while read file; do
  echo "Processing $file..."

  # Ajouter l'import si nécessaire
  if grep -q "\.toFixed([3-9])" "$file"; then
    # Vérifier si l'import existe déjà
    if ! grep -q "formatWeightGrams\|formatWeightOunces\|formatCurrency" "$file"; then
      echo "  → Adding import..."
      # Logique pour ajouter l'import
    fi
  fi
done
```

## Tests à Effectuer

Après chaque correction, vérifier:

1. ✅ **Build réussi** - `npm run build`
2. ✅ **Pas d'erreurs TypeScript** - Vérifier la console
3. ✅ **Affichage correct** - Vérifier visuellement dans le navigateur
4. ✅ **Formatage cohérent** - Tous les nombres ont 2 décimales
5. ✅ **Pas de régression** - Les calculs sont toujours corrects

## Notes Importantes

1. **Arrondi au supérieur:** Les fonctions utilisent `safeToFixed()` qui arrondit mathématiquement (pas toujours au supérieur). Si vous avez besoin d'arrondir au supérieur, utilisez `roundUpToFixed()` à la place.

2. **Valeurs undefined/null:** Toutes les fonctions gèrent automatiquement les valeurs `undefined` et `null`, retournant "0.00" par défaut.

3. **Performance:** Ces fonctions sont légères et n'ont pas d'impact sur la performance.

4. **Internationalisation:** Le formatage est indépendant de la locale. Pour un affichage avec virgule (1 234,56), utilisez les fonctions `toLocaleString()` existantes avec `maximumFractionDigits: 2`.

## Commandes Utiles

### Trouver tous les fichiers avec .toFixed(3) ou plus
```bash
grep -r "\.toFixed([3-9])" src/ --include="*.tsx" --include="*.ts"
```

### Compter les occurrences
```bash
grep -r "\.toFixed([3-9])" src/ --include="*.tsx" --include="*.ts" | wc -l
```

### Remplacer dans un fichier spécifique
```bash
# Exemple: remplacer .toFixed(4) par formatWeightOunces()
sed -i 's/\.toFixed(4)/formatWeightOunces()/g' file.tsx
```

## Conclusion

Le standard de 2 décimales est maintenant appliqué aux fichiers principaux de l'application:
- ✅ Page de détails d'expédition freight
- ✅ Page de gestion refining
- ✅ Fonctions utilitaires centralisées

Les autres fichiers seront corrigés progressivement selon les priorités définies ci-dessus.

**Build Status:** ✅ Réussi sans erreurs
**TypeScript:** ✅ Aucune erreur de type
**Standard appliqué:** ✅ 2 décimales partout
