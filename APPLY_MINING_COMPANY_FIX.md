# Fix: Ajouter mining_company_id aux tables freight_shipments et gold_inventory

## Problème

Le filtre par mine (KGM, Yanfolila, etc.) dans Gold Trade Space affiche toujours 0.000 oz car les tables `freight_shipments` et `gold_inventory` n'ont pas de lien direct avec les mines.

## Solution

Ajouter le champ `mining_company_id` aux tables suivantes:
- `freight_shipments`
- `gold_inventory` (si elle existe)

## Étapes pour Appliquer la Migration

### 1. Exécuter le Script SQL

1. Ouvrir Supabase Dashboard
2. Aller dans **SQL Editor**
3. Ouvrir le fichier `ADD_MINING_COMPANY_TO_TABLES.sql`
4. Copier tout le contenu
5. Coller dans l'éditeur SQL
6. Cliquer sur **RUN**

### 2. Vérifier les Résultats

Le script affichera:
```
📦 FREIGHT_SHIPMENTS:
  Total: X
  Avec mining_company_id: Y
  Sans mining_company_id: Z

💰 GOLD_INVENTORY:
  Total: X
  Avec mining_company_id: Y
  Sans mining_company_id: Z

✅ MIGRATION TERMINÉE!
```

### 3. Ce Que Fait le Script

1. **Ajoute `mining_company_id` à `freight_shipments`**
   - Crée la colonne avec foreign key vers `mining_companies`
   - Crée un index pour les performances

2. **Migre les Données Existantes**
   - Récupère le `mining_company_id` depuis `daily_production` via `freight_shipment_productions`
   - Met à jour tous les shipments existants

3. **Ajoute `mining_company_id` à `gold_inventory`**
   - Crée la colonne si la table existe
   - Migre les données depuis `freight_shipments`

4. **Crée des Triggers Automatiques**
   - `set_freight_shipment_mining_company()`: Auto-remplit mining_company_id lors de la création de shipment
   - `update_shipment_mining_company_from_production()`: Met à jour quand on ajoute des productions
   - `set_gold_inventory_mining_company()`: Auto-remplit pour l'inventaire

## Ce Qui Change dans le Code

### Avant (complexe avec 3 jointures)
```typescript
// 1. Récupérer les productions de la mine
const productions = await supabase
  .from('production')  // ❌ Table qui n'existe pas!
  .select('id')
  .eq('mining_company_id', miningCompanyId);

// 2. Récupérer les shipments
const shipments = await supabase
  .from('freight_shipments')
  .select('id')
  .in('production_id', productionIds);

// 3. Récupérer l'inventaire
const inventory = await supabase
  .from('gold_inventory')
  .select('*')
  .in('freight_shipment_id', shipmentIds);
```

### Après (simple, 1 requête)
```typescript
// Requête directe!
const inventory = await supabase
  .from('gold_inventory')
  .select('quantity_available_oz, final_fine_grams, final_fine_oz')
  .eq('transaction_type', 'entry')
  .eq('mining_company_id', miningCompanyId); // ✅ Utilise le nouveau champ!
```

## Fichiers Modifiés

1. **`ADD_MINING_COMPANY_TO_TABLES.sql`** - Script de migration
2. **`src/services/inventoryService.ts`** - Simplification de `getInventoryBySeller()`

## Prochaines Étapes Après Migration

1. **Rafraîchir l'application** (Ctrl+Shift+R ou Cmd+Shift+R)
2. **Exécuter le script SQL** `FIX_RLS_MINING_COMPANIES.sql` pour les permissions RLS
3. **Aller sur Gold Trade Space**
4. **Sélectionner KGM** dans le dropdown
5. **Vérifier que le stock s'affiche correctement**

## Données de Test

Si vous avez besoin de créer des données de test:

1. **daily_production** doit avoir `mining_company_id`
2. **freight_shipment_productions** doit lier les productions aux shipments
3. **freight_shipments** recevra automatiquement le `mining_company_id`
4. **gold_inventory** recevra automatiquement le `mining_company_id`

## Support

Si vous voyez toujours 0.000 oz après la migration:

1. Vérifier que `daily_production` a des données avec `mining_company_id` non null
2. Vérifier que `freight_shipment_productions` lie correctement les productions aux shipments
3. Vérifier que `gold_inventory` a été créé à partir de ces shipments
4. Exécuter cette requête pour déboguer:

```sql
SELECT
  mc.name as mine,
  COUNT(DISTINCT fs.id) as shipments,
  COUNT(DISTINCT gi.id) as inventory_entries,
  SUM(gi.quantity_available_oz) as total_oz
FROM mining_companies mc
LEFT JOIN freight_shipments fs ON fs.mining_company_id = mc.id
LEFT JOIN gold_inventory gi ON gi.mining_company_id = mc.id
GROUP BY mc.id, mc.name
ORDER BY mc.name;
```
