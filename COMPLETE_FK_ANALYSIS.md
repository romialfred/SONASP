# 🔍 Analyse Complète des Contraintes Foreign Key

## Objectif

Identifier **TOUTES** les relations FK pour créer un ordre de suppression **PARFAIT** qui ne génère AUCUNE erreur.

## Script d'Analyse à Exécuter

```sql
-- Identifier TOUTES les FK de la base
SELECT
  tc.table_name as table_enfant,
  kcu.column_name as colonne_enfant,
  ccu.table_name AS table_parent,
  ccu.column_name AS colonne_parent,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY ccu.table_name, tc.table_name;
```

## Relations Attendues (À Vérifier)

### Niveau 0: Tables de Base (Aucune FK entrante)
- `users` (auth.users)
- `mining_companies`
- `sites`
- `customers`
- `refineries`
- `transport_companies`
- `freight_companies`

### Niveau 1: Dépendent du Niveau 0
- `profiles` → `users`
- `daily_production` → `mining_companies`, `sites`
- `export_licenses` → `mining_companies`
- `annual_budgets` → `mining_companies`

### Niveau 2: Dépendent du Niveau 1
- `production_documents` → `daily_production`
- `unified_status_history` → `daily_production`
- `export_license_quotas` → `export_licenses`

### Niveau 3: Shipping
- `shipping_preparations` → `export_licenses`, `mining_companies`, `customers`

### Niveau 4: Documents Shipping
- `shipping_documents` → `shipping_preparations`
- `assay_certificates` → `shipping_preparations` (?)

### Niveau 5: Freight
- `freight_customs` → `shipping_preparations`

### Niveau 6: Inventory
- `inventory` → `daily_production`, `shipping_preparations` (?)
- `inventory_movements` → `inventory`

### Niveau 7: Sales
- `sales` → `customers`, `inventory` (?)
- `pre_sales` → `customers` (?)

### Niveau 8: Payments
- `payments` → `sales`
- `virtual_payments` → `sales` (?)

## ⚠️ Questions Critiques à Résoudre

1. **assay_certificates** → Référence quoi exactement?
   - `shipping_preparations` ?
   - `daily_production` ?
   - Les deux ?

2. **inventory** → Référence quoi?
   - `daily_production` ?
   - `shipping_preparations` ?
   - `sales` ?

3. **sales** → Référence quoi?
   - `customers` (sûr)
   - `inventory` ?
   - `shipping_preparations` ?

4. **virtual_payments** → Référence quoi?
   - `sales` ?
   - `payments` ?

## Action Requise

**EXÉCUTER LE SCRIPT D'ANALYSE** dans Supabase pour obtenir la **liste EXACTE** de toutes les FK.

Sans cette information, nous travaillons à l'aveugle!

## Format de Réponse Attendu

```
table_enfant          | colonne_enfant    | table_parent         | colonne_parent
----------------------|-------------------|----------------------|----------------
payments              | sale_id           | sales                | id
sales                 | customer_id       | customers            | id
inventory             | production_id     | daily_production     | id
shipping_preparations | license_id        | export_licenses      | id
...
```

## Ordre de Suppression Idéal

Une fois les FK connues, l'ordre sera:

```
Niveau N (plus haut) → Niveau 0 (base)

DELETE FROM payments;              -- Niveau N
DELETE FROM virtual_payments;      -- Niveau N
DELETE FROM sales;                 -- Niveau N-1
DELETE FROM pre_sales;             -- Niveau N-1
DELETE FROM inventory_movements;   -- Niveau N-1
DELETE FROM inventory;             -- Niveau N-2
DELETE FROM freight_customs;       -- Niveau N-2
DELETE FROM shipping_documents;    -- Niveau N-2
DELETE FROM assay_certificates;    -- Niveau N-2
DELETE FROM shipping_preparations; -- Niveau N-3
DELETE FROM export_license_quotas; -- Niveau N-3
DELETE FROM export_licenses;       -- Niveau N-4
DELETE FROM production_documents;  -- Niveau N-4
DELETE FROM unified_status_history;-- Niveau N-4
DELETE FROM daily_production;      -- Niveau N-5
-- NE PAS SUPPRIMER les tables de configuration
```

## Prochaines Étapes

1. ✅ Exécuter le script d'analyse
2. ✅ Documenter TOUTES les FK trouvées
3. ✅ Créer le graphe de dépendances
4. ✅ Définir l'ordre de suppression PARFAIT
5. ✅ Mettre à jour les scripts
6. ✅ Tester sur données réelles
