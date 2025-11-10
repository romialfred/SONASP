# Migration des Seal Numbers - Shipping Preparation

## 📋 Vue d'ensemble

Cette migration ajoute la possibilité d'associer **deux numéros de scellé** à chaque production dans un envoi:
- **seal_number_1**: Obligatoire
- **seal_number_2**: Optionnel

## 🗄️ Changements de Base de Données

### Table Modifiée: `shipping_production_items`

```sql
-- Colonnes ajoutées
ALTER TABLE shipping_production_items
ADD COLUMN seal_number_1 text NOT NULL;

ALTER TABLE shipping_production_items
ADD COLUMN seal_number_2 text;
```

### Migration File
📁 `supabase/migrations/20251110150000_add_seal_numbers_to_production_items.sql`

## 🚀 Comment Appliquer la Migration

### Option 1: Via Supabase Dashboard (Recommandé)

1. Ouvrez votre projet Supabase Dashboard
2. Allez dans **SQL Editor**
3. Copiez le contenu du fichier de migration:
   ```
   supabase/migrations/20251110150000_add_seal_numbers_to_production_items.sql
   ```
4. Collez et exécutez le SQL
5. Vérifiez que les colonnes ont été ajoutées:
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'shipping_production_items'
   AND column_name IN ('seal_number_1', 'seal_number_2');
   ```

### Option 2: Via Script Node.js

```bash
# Assurez-vous que les variables d'environnement sont configurées
node scripts/apply-seal-numbers-migration.js
```

### Option 3: Via psql

```bash
# Connectez-vous à votre base de données
psql "postgresql://[CONNECTION_STRING]"

# Exécutez la migration
\i supabase/migrations/20251110150000_add_seal_numbers_to_production_items.sql
```

## 🔍 Vérification

Après l'application de la migration, vérifiez que tout fonctionne:

```sql
-- Vérifier les colonnes
SELECT * FROM shipping_production_items LIMIT 1;

-- Tester l'insertion
INSERT INTO shipping_production_items (
  shipping_preparation_id,
  daily_production_id,
  ingot_box_number,
  net_weight_grams,
  gross_weight_grams,
  fineness_pct,
  pure_gold_grams,
  seal_number_1,
  seal_number_2,
  order_index
) VALUES (
  'test-uuid',
  'test-prod-uuid',
  'TEST-001',
  1000.00,
  1050.00,
  95.00,
  1000.00,
  '0097099',
  '0097100',
  0
);
```

## 📝 Changements de Code

### Interface TypeScript Mise à Jour

```typescript
export interface ShippingProductionItem {
  id: string;
  shipping_preparation_id: string;
  daily_production_id: string;
  ingot_box_number: string;
  net_weight_grams: number;
  gross_weight_grams: number;
  fineness_pct: number;
  pure_gold_grams: number;
  seal_number_1: string;        // ✅ NOUVEAU - Obligatoire
  seal_number_2?: string;        // ✅ NOUVEAU - Optionnel
  order_index: number;
  created_at: string;
}
```

### Utilisation dans le Formulaire

```typescript
// Chaque production a maintenant 2 champs seal
interface SelectedProductionData {
  production: DailyProduction;
  sealNumber1: string;  // Obligatoire
  sealNumber2: string;  // Optionnel
}

// Sauvegarde avec les seal numbers
await shippingPreparationService.addProductionItem({
  shipping_preparation_id: prepId,
  daily_production_id: sp.production.id,
  seal_number_1: sp.sealNumber1,
  seal_number_2: sp.sealNumber2 || undefined,
  // ... autres champs
});
```

## ⚠️ Points Importants

1. **seal_number_1 est obligatoire**: Le formulaire empêche la sauvegarde sans ce champ
2. **seal_number_2 est optionnel**: Peut être laissé vide
3. **Validation côté client**: Le bouton "Enregistrer" est désactivé si un seal_number_1 manque
4. **Validation côté serveur**: La base de données exige seal_number_1 (NOT NULL)

## 🔄 Rollback (Si Nécessaire)

Si vous devez annuler la migration:

```sql
-- Supprimer les colonnes ajoutées
ALTER TABLE shipping_production_items
DROP COLUMN IF EXISTS seal_number_1;

ALTER TABLE shipping_production_items
DROP COLUMN IF EXISTS seal_number_2;
```

⚠️ **Attention**: Cela supprimera toutes les données de seal numbers existantes!

## 📊 Impact sur les Données Existantes

- **Nouvelles entrées**: Doivent avoir seal_number_1
- **Entrées existantes**:
  - Si la migration est appliquée sur une base avec données existantes
  - seal_number_1 sera vide par défaut (peut causer des erreurs)
  - Il faudra peut-être mettre à jour les entrées existantes

### Script de Correction pour Données Existantes (Si Nécessaire)

```sql
-- Mettre à jour les entrées existantes sans seal_number_1
UPDATE shipping_production_items
SET seal_number_1 = COALESCE(seal_number_1, 'LEGACY-' || id::text)
WHERE seal_number_1 IS NULL OR seal_number_1 = '';
```

## ✅ Checklist de Déploiement

- [ ] Appliquer la migration SQL
- [ ] Vérifier que les colonnes existent
- [ ] Tester l'insertion de nouvelles données
- [ ] Déployer le code frontend mis à jour
- [ ] Vérifier le formulaire en production
- [ ] Tester le PDF Preview avec les seal numbers

## 🆘 Support

En cas de problème:
1. Vérifier les logs Supabase
2. Confirmer que la migration est appliquée
3. Vérifier les permissions RLS
4. Consulter la documentation Supabase

## 📚 Fichiers Modifiés

- ✅ `supabase/migrations/20251110150000_add_seal_numbers_to_production_items.sql`
- ✅ `src/services/shippingPreparationService.ts` (interface)
- ✅ `src/pages/shipping/ShippingPreparationNew.tsx` (formulaire)
- ✅ `scripts/apply-seal-numbers-migration.js` (script optionnel)
