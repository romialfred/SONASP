# Mise à jour de UserManagement - Correspondance Exacte avec Sidebar

## Problème identifié

La structure MENU_STRUCTURE dans UserManagement.tsx ne correspond PAS au menu réel AccordionSidebar.tsx utilisé dans l'application.

## Structure exacte du Sidebar AccordionSidebar

### 1. Dashboard (standalone)
- Dashboard → `/dashboard`

### 2. Production Management (groupe: production)
- Daily Production → `/production/daily`
- Production in Safe → `/production/in-safe`
- Export Licenses → `/production/licenses`
- Budget & Forecasts → `/performance/budgets`

### 3. Shipping Management (groupe: shipping)
- Shipping Preparation → `/shipping/preparation`
- Invoice & Consignment → `/freight`

### 4. Refining (groupe: refining)
- Refining Process → `/refining`

### 5. Refinery Inventory (groupe: refinery_inventory)
- Gold Inventory → `/inventory`
- Silver Inventory → `/inventory/silver`

### 6. Document Management (groupe: documents)
- Assay Certificates → `/documents/assay-certificates`

### 7. Marketplace (groupe: marketplace)
- Trade Space → `/sales/trade-space`
- Gold Prices → `/gold-prices`
- FX Rates → `/fx-rates`

### 8. Sales (groupe: sales)
- Pre-Sales → `/presales`
- Sales → `/sales`
- Payments → `/payments`

### 9. Stakeholders (groupe: stakeholders)
- Mining Companies → `/stakeholders/mining-companies`
- Freight Companies → `/stakeholders/freight-companies`
- Refinery Plants → `/stakeholders/refinery-plants`
- Depositors → `/stakeholders/depositors`
- Customers → `/customers`

### 10. Insights & Reports (groupe: insights)
- Analytics → `/analytics`
- Reports → `/reports`

### 11. Administration (groupe: administration)
- Users Management → `/users`
- Settings → `/parameters`
- Gold Sales Settings → `/admin/gold-sales-settings`
- Status Manager → `/admin/status-manager`
- Workflow → `/admin/workflow`
- Audit Trail → `/audit`

## Totaux
- **11 groupes** (catégories)
- **33 modules** au total
- **1 module standalone** (Dashboard)
- **32 modules dans des groupes**

## Champs sensibles par module

### Production
- daily_production: `weight_grams`, `gold_purity_percent`, `gold_weight_grams`, `silver_weight_grams`
- production_in_safe: `weight_grams`, `gold_content_grams`
- export_licenses: `authorized_weight_kg`, `remaining_quota_kg`

### Shipping
- shipping_preparation: `total_weight_kg`, `total_weight_oz`, `declared_value`
- invoice_consignment: `freight_cost`, `insurance_amount`, `total_value`

### Refining
- refining_process: `received_weight_grams`, `fineness_percent`, `fine_weight_grams`, `refining_cost`

### Inventory
- gold_inventory: `quantity_grams`, `quantity_oz`, `value_usd`, `purity_percent`
- silver_inventory: `quantity_grams`, `quantity_oz`, `value_usd`

### Marketplace
- gold_prices: `london_am_rate`, `london_pm_rate`, `spot_price`
- fx_rates: `usd_cfa_rate`, `usd_gnf_rate`, `exchange_spread`

### Sales
- presales: `estimated_price_per_oz`, `estimated_total_value`
- sales: `sale_price_per_oz`, `total_amount`, `net_proceeds`, `commission_amount`
- payments: `amount`, `fx_rate`, `bank_name`, `account_number`, `reference_number`

### Stakeholders
- customers: `credit_limit`, `total_purchases`, `outstanding_balance`

## Actions à effectuer

1. **Exécuter le script SQL** : `FIX_MODULES_EXACT_SIDEBAR.sql`
   - Cela supprimera tous les anciens modules
   - Insérera les 33 nouveaux modules correspondant au sidebar

2. **Mettre à jour UserManagement.tsx** :
   - Remplacer MENU_STRUCTURE par la structure exacte ci-dessus
   - Utiliser les mêmes noms de modules que dans la base de données
   - Ajouter les champs sensibles appropriés pour chaque module

3. **Vérifier la cohérence** :
   - Les noms de modules dans le code doivent correspondre à la colonne `name` dans la table `modules`
   - Les catégories doivent correspondre aux groupes du sidebar
   - L'ordre (sort_order) doit respecter l'ordre d'affichage dans le menu
