# 📊 TABLEAU DE CORRESPONDANCE EXACTE - SIDEBAR ↔ MODULES

## Vue d'ensemble

Ce tableau montre la correspondance **EXACTE** entre :
- Le menu AccordionSidebar visible dans l'application
- Les modules stockés dans la base de données
- Les catégories utilisées pour organiser les permissions

---

## 🎯 Correspondance Complète (33 modules)

### 1. Dashboard (Standalone)
| # | Sidebar | Route | Module DB | Catégorie DB |
|---|---------|-------|-----------|--------------|
| 1 | Dashboard | `/dashboard` | `dashboard` | `overview` |

---

### 2. Production Management (4 modules)
| # | Sidebar | Route | Module DB | Catégorie DB |
|---|---------|-------|-----------|--------------|
| 2 | Daily Production | `/production/daily` | `daily_production` | `production` |
| 3 | Production in Safe | `/production/in-safe` | `production_in_safe` | `production` |
| 4 | Export Licenses | `/production/licenses` | `export_licenses` | `production` |
| 5 | Budget & Forecasts | `/performance/budgets` | `budget_forecasts` | `production` |

**Champs sensibles** :
- `weight_grams`, `gold_purity_percent`, `gold_weight_grams`, `silver_weight_grams`
- `gold_content_grams`, `authorized_weight_kg`, `remaining_quota_kg`
- `budget_amount`, `actual_amount`, `variance`

---

### 3. Shipping Management (2 modules)
| # | Sidebar | Route | Module DB | Catégorie DB |
|---|---------|-------|-----------|--------------|
| 6 | Shipping Preparation | `/shipping/preparation` | `shipping_preparation` | `shipping` |
| 7 | Invoice & Consignment | `/freight` | `invoice_consignment` | `shipping` |

**Champs sensibles** :
- `total_weight_kg`, `total_weight_oz`, `declared_value`
- `freight_cost`, `insurance_amount`, `total_value`

---

### 4. Refining (1 module)
| # | Sidebar | Route | Module DB | Catégorie DB |
|---|---------|-------|-----------|--------------|
| 8 | Refining Process | `/refining` | `refining_process` | `refining` |

**Champs sensibles** :
- `received_weight_grams`, `fineness_percent`, `fine_weight_grams`, `refining_cost`

---

### 5. Refinery Inventory (2 modules)
| # | Sidebar | Route | Module DB | Catégorie DB |
|---|---------|-------|-----------|--------------|
| 9 | Gold Inventory | `/inventory` | `gold_inventory` | `refinery_inventory` |
| 10 | Silver Inventory | `/inventory/silver` | `silver_inventory` | `refinery_inventory` |

**Champs sensibles** :
- `quantity_grams`, `quantity_oz`, `value_usd`, `purity_percent` (or)
- `quantity_grams`, `quantity_oz`, `value_usd` (argent)

---

### 6. Document Management (1 module)
| # | Sidebar | Route | Module DB | Catégorie DB |
|---|---------|-------|-----------|--------------|
| 11 | Assay Certificates | `/documents/assay-certificates` | `assay_certificates` | `documents` |

**Champs sensibles** :
- `gold_content_percent`, `silver_content_percent`, `assay_value`

---

### 7. Marketplace (3 modules)
| # | Sidebar | Route | Module DB | Catégorie DB |
|---|---------|-------|-----------|--------------|
| 12 | Trade Space | `/sales/trade-space` | `trade_space` | `marketplace` |
| 13 | Gold Prices | `/gold-prices` | `gold_prices` | `marketplace` |
| 14 | FX Rates | `/fx-rates` | `fx_rates` | `marketplace` |

**Champs sensibles** :
- `live_price`, `bid_price`, `ask_price`
- `london_am_rate`, `london_pm_rate`, `spot_price`
- `usd_cfa_rate`, `usd_gnf_rate`, `exchange_spread`

---

### 8. Sales (3 modules)
| # | Sidebar | Route | Module DB | Catégorie DB |
|---|---------|-------|-----------|--------------|
| 15 | Pre-Sales | `/presales` | `presales` | `sales` |
| 16 | Sales | `/sales` | `sales` | `sales` |
| 17 | Payments | `/payments` | `payments` | `sales` |

**Champs sensibles** :
- `estimated_price_per_oz`, `estimated_total_value`
- `sale_price_per_oz`, `total_amount`, `net_proceeds`, `commission_amount`
- `amount`, `fx_rate`, `bank_name`, `account_number`, `reference_number`

---

### 9. Stakeholders (5 modules)
| # | Sidebar | Route | Module DB | Catégorie DB |
|---|---------|-------|-----------|--------------|
| 18 | Mining Companies | `/stakeholders/mining-companies` | `mining_companies` | `stakeholders` |
| 19 | Freight Companies | `/stakeholders/freight-companies` | `freight_companies` | `stakeholders` |
| 20 | Refinery Plants | `/stakeholders/refinery-plants` | `refinery_plants` | `stakeholders` |
| 21 | Depositors | `/stakeholders/depositors` | `depositors` | `stakeholders` |
| 22 | Customers | `/customers` | `customers` | `stakeholders` |

**Champs sensibles** (customers uniquement) :
- `credit_limit`, `total_purchases`, `outstanding_balance`

---

### 10. Insights & Reports (2 modules)
| # | Sidebar | Route | Module DB | Catégorie DB |
|---|---------|-------|-----------|--------------|
| 23 | Analytics | `/analytics` | `analytics` | `insights` |
| 24 | Reports | `/reports` | `reports` | `insights` |

**Champs sensibles** :
- `revenue_data`, `profit_margins`, `cost_analysis`
- `financial_data`, `performance_metrics`

---

### 11. Administration (6 modules)
| # | Sidebar | Route | Module DB | Catégorie DB |
|---|---------|-------|-----------|--------------|
| 25 | Users Management | `/users` | `users` | `administration` |
| 26 | Settings | `/parameters` | `settings` | `administration` |
| 27 | Gold Sales Settings | `/admin/gold-sales-settings` | `gold_sales_settings` | `administration` |
| 28 | Status Manager | `/admin/status-manager` | `status_manager` | `administration` |
| 29 | Workflow | `/admin/workflow` | `workflow` | `administration` |
| 30 | Audit Trail | `/audit` | `audit` | `administration` |

**Champs sensibles** :
- `system_settings`, `api_keys`
- `price_settings`, `commission_rates`

---

## 📈 Statistiques

| Catégorie | Nombre de Modules | % du Total |
|-----------|------------------|------------|
| overview | 1 | 3.0% |
| production | 4 | 12.1% |
| shipping | 2 | 6.1% |
| refining | 1 | 3.0% |
| refinery_inventory | 2 | 6.1% |
| documents | 1 | 3.0% |
| marketplace | 3 | 9.1% |
| sales | 3 | 9.1% |
| stakeholders | 5 | 15.2% |
| insights | 2 | 6.1% |
| administration | 6 | 18.2% |
| **TOTAL** | **33** | **100%** |

---

## 🔍 Règles de Nommage

### Noms de Modules (column `name` in DB)
- Format : `snake_case` (minuscules avec underscores)
- Exemples : `daily_production`, `shipping_preparation`, `gold_inventory`
- Utilisation : Code TypeScript, requêtes SQL

### Noms d'Affichage (column `display_name` in DB)
- Format : `Title Case` (majuscules aux mots importants)
- Exemples : "Daily Production", "Shipping Preparation", "Gold Inventory"
- Utilisation : Interface utilisateur, formulaires

### Catégories (column `category` in DB)
- Format : `snake_case` (minuscules avec underscores)
- Exemples : `production`, `shipping`, `refinery_inventory`
- Utilisation : Regroupement des modules, organisation

### Routes (paths in app)
- Format : `/kebab-case` ou `/camelCase` selon contexte
- Exemples : `/production/daily`, `/shipping/preparation`, `/gold-prices`
- Utilisation : React Router, navigation

---

## 🎨 Correspondance Visuelle

```
┌─────────────────────────────────────┐
│   ACCORDION SIDEBAR (Menu App)     │
├─────────────────────────────────────┤
│                                     │
│  📊 Dashboard                       │  ←→  dashboard (overview)
│                                     │
│  🏭 Production Management           │
│    ├─ Daily Production             │  ←→  daily_production (production)
│    ├─ Production in Safe           │  ←→  production_in_safe (production)
│    ├─ Export Licenses              │  ←→  export_licenses (production)
│    └─ Budget & Forecasts           │  ←→  budget_forecasts (production)
│                                     │
│  🚚 Shipping Management             │
│    ├─ Shipping Preparation         │  ←→  shipping_preparation (shipping)
│    └─ Invoice & Consignment        │  ←→  invoice_consignment (shipping)
│                                     │
│  ⚗️  Refining                       │
│    └─ Refining Process             │  ←→  refining_process (refining)
│                                     │
│  📦 Refinery Inventory              │
│    ├─ Gold Inventory               │  ←→  gold_inventory (refinery_inventory)
│    └─ Silver Inventory             │  ←→  silver_inventory (refinery_inventory)
│                                     │
│  📄 Document Management             │
│    └─ Assay Certificates           │  ←→  assay_certificates (documents)
│                                     │
│  🏪 Marketplace                     │
│    ├─ Trade Space                  │  ←→  trade_space (marketplace)
│    ├─ Gold Prices                  │  ←→  gold_prices (marketplace)
│    └─ FX Rates                     │  ←→  fx_rates (marketplace)
│                                     │
│  🛒 Sales                           │
│    ├─ Pre-Sales                    │  ←→  presales (sales)
│    ├─ Sales                        │  ←→  sales (sales)
│    └─ Payments                     │  ←→  payments (sales)
│                                     │
│  🤝 Stakeholders                    │
│    ├─ Mining Companies             │  ←→  mining_companies (stakeholders)
│    ├─ Freight Companies            │  ←→  freight_companies (stakeholders)
│    ├─ Refinery Plants              │  ←→  refinery_plants (stakeholders)
│    ├─ Depositors                   │  ←→  depositors (stakeholders)
│    └─ Customers                    │  ←→  customers (stakeholders)
│                                     │
│  📊 Insights & Reports              │
│    ├─ Analytics                    │  ←→  analytics (insights)
│    └─ Reports                      │  ←→  reports (insights)
│                                     │
│  ⚙️  Administration                 │
│    ├─ Users Management             │  ←→  users (administration)
│    ├─ Settings                     │  ←→  settings (administration)
│    ├─ Gold Sales Settings          │  ←→  gold_sales_settings (administration)
│    ├─ Status Manager               │  ←→  status_manager (administration)
│    ├─ Workflow                     │  ←→  workflow (administration)
│    └─ Audit Trail                  │  ←→  audit (administration)
│                                     │
└─────────────────────────────────────┘
```

---

## ✅ Validation

Pour vérifier la correspondance, exécutez :

```sql
-- Liste tous les modules avec leur catégorie
SELECT
  ROW_NUMBER() OVER (ORDER BY sort_order) as numero,
  category as categorie,
  name as nom_module,
  display_name as affichage,
  sort_order as ordre
FROM modules
ORDER BY sort_order;
```

Résultat attendu : **33 lignes** avec numérotation de 1 à 33.

---

**Documentation** : Correspondance exacte Sidebar ↔ Base de données
**Date** : 2025-12-18
**Version** : 1.0
**Total modules** : 33
**Total catégories** : 11
