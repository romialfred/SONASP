# 🗑️ Guide: Truncate Données Opérationnelles

## 🎯 Objectif

Supprimer **toutes les données opérationnelles** tout en conservant:
- ✅ **Budgets & Forecasts** (annual_budgets, monthly_budget_forecasts)
- ✅ **Gold Prices** (gold_prices, gold_price_aggregations)
- ✅ **FX Rates** (fx_rates, fx_rate_aggregations)
- ✅ **Stakeholders** (mining_companies, refineries, customers, transport_companies, etc.)

## 📋 Données qui seront SUPPRIMÉES

### 1. Daily Production
- `daily_production` - Toutes les productions quotidiennes
- `production_documents` - Documents associés

### 2. Shipping Preparation
- `shipping_preparations` - Toutes les préparations d'expédition

### 3. Freight & Customs
- `freight_shipments` - Expéditions freight
- `freight_shipment_productions` - Productions liées aux freight
- `freight_shipment_signatories` - Signataires

### 4. Sales & Payments
- `sales` - Toutes les ventes
- `pre_sales` - Pré-ventes
- `payments` - Tous les paiements

### 5. Inventory
- `inventory_movements` - Mouvements d'inventaire
- `silver_inventory` - Inventaire argent

### 6. Export Licenses
- `export_licenses` - Licences d'exportation

### 7. Assay Certificates
- `assay_certificates` - Certificats d'assay

### 8. Audit Logs (Optionnel)
- `audit_logs` - CONSERVÉS par défaut (décommentez dans le script pour supprimer)

## 🚀 Exécution du Script

### Option 1: Via Supabase SQL Editor (Recommandé)

1. Ouvrez [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql)
2. Copiez **TOUT** le contenu de `TRUNCATE_OPERATIONAL_DATA.sql`
3. Cliquez sur **RUN**
4. Observez le rapport détaillé

### Option 2: Via MCP Server (Si configuré)

Dans Claude Desktop:
```
Execute the TRUNCATE_OPERATIONAL_DATA.sql script
```

### Option 3: Via psql (Ligne de commande)

```bash
psql $SUPABASE_DB_URL -f TRUNCATE_OPERATIONAL_DATA.sql
```

## ✅ Rapport Attendu

```
==============================================
DÉBUT DU TRUNCATE - DONNÉES OPÉRATIONNELLES
==============================================

1. FREIGHT & CUSTOMS MODULE
----------------------------
Signataires à supprimer: X
✓ Signataires supprimés
Productions freight à supprimer: Y
✓ Productions freight supprimées
Expéditions freight à supprimer: Z
✓ Expéditions freight supprimées

2. SHIPPING PREPARATION
------------------------
Préparations shipping à supprimer: X
✓ Préparations shipping supprimées

3. DAILY PRODUCTION
-------------------
Documents production à supprimer: X
✓ Documents production supprimés
Productions quotidiennes à supprimer: Y
✓ Productions quotidiennes supprimées

4. SALES & PAYMENTS
-------------------
Paiements à supprimer: X
✓ Paiements supprimés
Ventes à supprimer: Y
✓ Ventes supprimées
Pré-ventes à supprimer: Z
✓ Pré-ventes supprimées

5. INVENTORY
-------------
Mouvements inventory à supprimer: X
✓ Mouvements inventory supprimés
Inventory argent à supprimer: Y
✓ Inventory argent supprimé

6. EXPORT LICENSES
------------------
Licences export à supprimer: X
✓ Licences export supprimées

7. ASSAY CERTIFICATES
---------------------
Certificats assay à supprimer: X
✓ Certificats assay supprimés

8. AUDIT LOGS (Optionnel)
-------------------------
Logs audit à supprimer: X
⚠ Logs audit CONSERVÉS (décommentez pour supprimer)

==============================================
VÉRIFICATION FINALE
==============================================
Daily Production: 0 lignes
Freight Shipments: 0 lignes
Shipping Preparations: 0 lignes
Sales: 0 lignes
Payments: 0 lignes

✅ TOUTES LES DONNÉES OPÉRATIONNELLES SONT SUPPRIMÉES

==============================================
DONNÉES CONSERVÉES (RÉFÉRENCE)
==============================================
Budgets annuels: X lignes (✓ conservés)
Prévisions mensuelles: Y lignes (✓ conservées)
Prix de l'or: Z lignes (✓ conservés)
Taux de change: A lignes (✓ conservés)
Compagnies minières: B lignes (✓ conservées)
Clients: C lignes (✓ conservés)

==============================================
TRUNCATE TERMINÉ AVEC SUCCÈS
==============================================

Données supprimées:
  ✓ Daily Production
  ✓ Shipping Preparation
  ✓ Freight & Customs
  ✓ Sales & Payments
  ✓ Inventory
  ✓ Export Licenses
  ✓ Assay Certificates

Données conservées:
  ✓ Budgets & Forecasts
  ✓ Gold Prices
  ✓ FX Rates
  ✓ Stakeholders (mining companies, customers, etc.)
```

## 🔍 Vérification Post-Truncate

### Vérifier les tables opérationnelles (doivent être vides)

```sql
SELECT 
  'daily_production' as table_name,
  COUNT(*) as row_count
FROM daily_production
UNION ALL
SELECT 'freight_shipments', COUNT(*) FROM freight_shipments
UNION ALL
SELECT 'shipping_preparations', COUNT(*) FROM shipping_preparations
UNION ALL
SELECT 'sales', COUNT(*) FROM sales
UNION ALL
SELECT 'payments', COUNT(*) FROM payments;

-- Résultat attendu: Toutes les lignes = 0
```

### Vérifier les données de référence (doivent être conservées)

```sql
SELECT 
  'annual_budgets' as table_name,
  COUNT(*) as row_count
FROM annual_budgets
UNION ALL
SELECT 'gold_prices', COUNT(*) FROM gold_prices
UNION ALL
SELECT 'fx_rates', COUNT(*) FROM fx_rates
UNION ALL
SELECT 'mining_companies', COUNT(*) FROM mining_companies
UNION ALL
SELECT 'customers', COUNT(*) FROM customers;

-- Résultat attendu: Toutes les lignes > 0 (données conservées)
```

## ⚠️ AVERTISSEMENT: BACKUP RECOMMANDÉ

**AVANT** d'exécuter le truncate, créez un backup:

```sql
-- Backup des données opérationnelles (optionnel)
CREATE TABLE backup_daily_production AS SELECT * FROM daily_production;
CREATE TABLE backup_freight_shipments AS SELECT * FROM freight_shipments;
CREATE TABLE backup_shipping_preparations AS SELECT * FROM shipping_preparations;
CREATE TABLE backup_sales AS SELECT * FROM sales;
CREATE TABLE backup_payments AS SELECT * FROM payments;
```

## 🔄 Restauration (si nécessaire)

```sql
-- Restaurer depuis backup
TRUNCATE daily_production;
INSERT INTO daily_production SELECT * FROM backup_daily_production;

TRUNCATE freight_shipments CASCADE;
INSERT INTO freight_shipments SELECT * FROM backup_freight_shipments;

-- Etc. pour chaque table
```

## 🎯 Cas d'Usage

### Scénario 1: Nouveau Démarrage
Vous voulez commencer avec une base propre mais garder les configurations.

**Action**: Exécutez le script complet.

### Scénario 2: Tests en Développement
Vous voulez nettoyer les données de test mais garder les références.

**Action**: Exécutez le script complet.

### Scénario 3: Migration de Données
Vous préparez une migration et voulez une base propre.

**Action**: 
1. Backup complet
2. Exécutez le script
3. Importez les nouvelles données

## 📊 Tables Impactées

| Catégorie | Table | Action |
|-----------|-------|--------|
| **Daily Production** | daily_production | 🗑️ TRUNCATE |
| | production_documents | 🗑️ TRUNCATE |
| **Freight** | freight_shipments | 🗑️ TRUNCATE |
| | freight_shipment_productions | 🗑️ TRUNCATE |
| | freight_shipment_signatories | 🗑️ TRUNCATE |
| **Shipping** | shipping_preparations | 🗑️ TRUNCATE |
| **Sales** | sales | 🗑️ TRUNCATE |
| | pre_sales | 🗑️ TRUNCATE |
| | payments | 🗑️ TRUNCATE |
| **Inventory** | inventory_movements | 🗑️ TRUNCATE |
| | silver_inventory | 🗑️ TRUNCATE |
| **Licenses** | export_licenses | 🗑️ TRUNCATE |
| **Certificates** | assay_certificates | 🗑️ TRUNCATE |
| **Audit** | audit_logs | ✅ CONSERVÉ |
| **Budgets** | annual_budgets | ✅ CONSERVÉ |
| | monthly_budget_forecasts | ✅ CONSERVÉ |
| **Prices** | gold_prices | ✅ CONSERVÉ |
| | fx_rates | ✅ CONSERVÉ |
| **Stakeholders** | mining_companies | ✅ CONSERVÉ |
| | customers | ✅ CONSERVÉ |
| | refineries | ✅ CONSERVÉ |
| | transport_companies | ✅ CONSERVÉ |

## 🛡️ Sécurité

### Permissions Requises
- Accès `service_role` ou `postgres` sur Supabase
- Permissions TRUNCATE sur toutes les tables

### Considérations
- ✅ Les triggers sont préservés
- ✅ Les contraintes FK sont respectées (CASCADE)
- ✅ Les RLS policies restent actives
- ✅ La structure des tables est intacte
- ❌ AUCUN rollback automatique (transaction par bloc DO)

## 🔧 Personnalisation

### Pour Supprimer les Audit Logs

Dans le script, ligne ~230, décommentez:
```sql
-- AVANT
-- TRUNCATE audit_logs CASCADE;

-- APRÈS
TRUNCATE audit_logs CASCADE;
```

### Pour Conserver Certaines Données

Commentez les sections correspondantes:
```sql
-- Pour garder les sales
-- TRUNCATE sales CASCADE;
```

## 📞 Support

### En cas d'erreur

1. **Vérifiez les permissions**
```sql
SELECT has_table_privilege('daily_production', 'TRUNCATE');
```

2. **Vérifiez les contraintes FK**
```sql
SELECT * FROM information_schema.table_constraints 
WHERE table_name IN ('daily_production', 'freight_shipments', etc.)
AND constraint_type = 'FOREIGN KEY';
```

3. **Vérifiez les tables existantes**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

## ✅ Checklist Post-Exécution

- [ ] Vérifier que toutes les tables opérationnelles sont vides (0 lignes)
- [ ] Vérifier que les données de référence sont conservées
- [ ] Vérifier que les budgets sont toujours présents
- [ ] Vérifier que les gold prices sont conservés
- [ ] Vérifier que les FX rates sont conservés
- [ ] Vérifier que les stakeholders sont conservés
- [ ] Tester la création de nouvelles données
- [ ] Vérifier que l'application fonctionne correctement

---

**Durée d'exécution estimée**: 5-10 secondes  
**Réversibilité**: Avec backup seulement  
**Impact**: Suppression définitive des données opérationnelles

**⚠️ IMPORTANT**: Cette opération est **IRRÉVERSIBLE** sans backup !
