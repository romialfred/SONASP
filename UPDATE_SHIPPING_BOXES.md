# 🔧 MISE À JOUR DES DONNÉES SHIPPING

## Problème Résolu

Les expéditions créées avant cette correction n'avaient pas:
- `total_boxes` calculé
- Les informations affichées correctement dans le dashboard

## Script SQL de Mise à Jour

Exécuter ce script dans Supabase SQL Editor pour mettre à jour les données existantes:

```sql
-- Mettre à jour total_boxes pour les expéditions existantes
-- basé sur le nombre de production items associés

UPDATE shipping_preparations sp
SET total_boxes = (
  SELECT COUNT(*)
  FROM shipping_production_items spi
  WHERE spi.shipping_preparation_id = sp.id
)
WHERE total_boxes IS NULL OR total_boxes = 0;

-- Vérifier les résultats
SELECT 
  id,
  expedition_lot_number,
  total_boxes,
  (SELECT COUNT(*) FROM shipping_production_items WHERE shipping_preparation_id = shipping_preparations.id) as actual_count
FROM shipping_preparations
ORDER BY created_at DESC
LIMIT 10;
```

## Corrections Appliquées dans le Code

### 1. **Calcul de total_boxes** (ShippingPreparationNew.tsx)

**Avant**:
```typescript
const prepData = {
  expedition_lot_number: expeditionLotNumber,
  seal_number: selectedProductions[0].sealNumber1,
  mining_company_id: selectedMiningCompanyId,
  // ... autres champs
  // total_boxes manquant!
};
```

**Après**:
```typescript
const totalBoxes = selectedProductions.length; // Nombre de productions = nombre de boxes

const prepData = {
  expedition_lot_number: expeditionLotNumber,
  seal_number: selectedProductions[0].sealNumber1,
  mining_company_id: selectedMiningCompanyId,
  total_boxes: totalBoxes, // ✅ Ajouté
  // ... autres champs
};
```

### 2. **Message de Succès Approbation** (ShippingPreparationDetailsEnhanced.tsx)

**Avant**:
```typescript
await loadShippingDetails(true);
setError({
  title: 'Succès',
  message: `Status changé avec succès`
});
```

**Après**:
```typescript
await loadShippingDetails(true);
showSuccess('Succès', `Le statut a été changé avec succès vers "${newStatus}"`);
```

## Données Affichées dans le Dashboard

| Colonne | Source | Status |
|---------|--------|--------|
| **Mining Company** | `mining_companies.name` via FK | ✅ Déjà OK |
| **Seal Number** | `seal_number` colonne | ✅ Déjà OK |
| **Boxes** | `total_boxes` calculé | ✅ Corrigé |

## Prochaines Expéditions

Les nouvelles expéditions créées après cette mise à jour auront automatiquement:
- ✅ `total_boxes` calculé correctement
- ✅ `mining_company_id` sauvegardé (déjà OK)
- ✅ `seal_number` sauvegardé (déjà OK)
- ✅ Message de succès correct pour approbation douanière

## Test Manuel Recommandé

1. ✅ Exécuter le script SQL ci-dessus
2. ✅ Créer une nouvelle expédition
3. ✅ Vérifier que Mining Company, Seal Number et Boxes sont affichés
4. ✅ Tester l'approbation douanière (devrait fonctionner au premier clic)
