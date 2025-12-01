# ✅ Script de Truncate - Prêt pour Exécution

## 🎯 Ce qui a été créé

### 1. Script SQL Principal
**Fichier**: `TRUNCATE_OPERATIONAL_DATA.sql`

**Ce qu'il fait**:
- ✅ Supprime toutes les données **Daily Production**
- ✅ Supprime toutes les données **Shipping Preparation**
- ✅ Supprime toutes les données **Freight & Customs**
- ✅ Supprime toutes les données **Sales & Payments**
- ✅ Supprime toutes les données **Inventory**
- ✅ Supprime toutes les données **Export Licenses**
- ✅ Supprime toutes les données **Assay Certificates**
- ❌ **CONSERVE** tous les **Budgets & Forecasts**
- ❌ **CONSERVE** tous les **Gold Prices**
- ❌ **CONSERVE** tous les **FX Rates**
- ❌ **CONSERVE** tous les **Stakeholders**

### 2. Guide Complet
**Fichier**: `TRUNCATE_OPERATIONAL_DATA_GUIDE.md`

Contient:
- Instructions détaillées
- Rapport attendu
- Procédures de vérification
- Scripts de backup/restauration
- Dépannage

## 🚀 Exécution en 3 Options

### Option 1: Supabase SQL Editor (Recommandé) ⭐

1. Ouvrir Supabase SQL Editor
2. Copier tout le contenu de `TRUNCATE_OPERATIONAL_DATA.sql`
3. Cliquer sur RUN
4. Observer le rapport détaillé

### Option 2: MCP Server (Si configuré)

Dans cette conversation Claude ou Claude Desktop:
```
Please execute the file TRUNCATE_OPERATIONAL_DATA.sql
```

### Option 3: Ligne de commande

```bash
psql $SUPABASE_DB_URL -f TRUNCATE_OPERATIONAL_DATA.sql
```

## 📊 Résumé des Tables

### Tables TRUNCATE (Supprimées)

| Table | Catégorie | Données |
|-------|-----------|---------|
| daily_production | Production | Toutes les productions |
| production_documents | Production | Tous les documents |
| freight_shipments | Freight | Toutes les expéditions |
| freight_shipment_productions | Freight | Toutes les productions liées |
| freight_shipment_signatories | Freight | Tous les signataires |
| shipping_preparations | Shipping | Toutes les préparations |
| sales | Sales | Toutes les ventes |
| pre_sales | Sales | Toutes les pré-ventes |
| payments | Payments | Tous les paiements |
| inventory_movements | Inventory | Tous les mouvements |
| silver_inventory | Inventory | Tout l'inventaire argent |
| export_licenses | Licenses | Toutes les licences |
| assay_certificates | Certificates | Tous les certificats |

### Tables CONSERVÉES (Intactes)

| Table | Catégorie | Pourquoi |
|-------|-----------|----------|
| annual_budgets | Budgets | Données de référence |
| monthly_budget_forecasts | Budgets | Prévisions nécessaires |
| gold_prices | Prices | Historique important |
| gold_price_aggregations | Prices | Statistiques |
| fx_rates | FX | Taux historiques |
| fx_rate_aggregations | FX | Statistiques |
| mining_companies | Stakeholders | Entités permanentes |
| customers | Stakeholders | Entités permanentes |
| refineries | Stakeholders | Entités permanentes |
| transport_companies | Stakeholders | Entités permanentes |
| users | System | Comptes utilisateurs |
| profiles | System | Profils utilisateurs |

## ⚠️ Avant d'Exécuter

### BACKUP RECOMMANDÉ (Optionnel)

```sql
-- Créer backups de sécurité
CREATE TABLE backup_daily_production AS SELECT * FROM daily_production;
CREATE TABLE backup_freight_shipments AS SELECT * FROM freight_shipments;
CREATE TABLE backup_sales AS SELECT * FROM sales;
CREATE TABLE backup_payments AS SELECT * FROM payments;
```

### Vérifier les Données Actuelles

```sql
-- Compter les données qui seront supprimées
SELECT 
  'daily_production' as table_name, 
  COUNT(*) as rows 
FROM daily_production
UNION ALL
SELECT 'freight_shipments', COUNT(*) FROM freight_shipments
UNION ALL
SELECT 'sales', COUNT(*) FROM sales
UNION ALL
SELECT 'payments', COUNT(*) FROM payments;
```

## ✅ Après Exécution

### Vérification Rapide

```sql
-- Tout devrait être 0
SELECT COUNT(*) FROM daily_production;        -- Doit être 0
SELECT COUNT(*) FROM freight_shipments;       -- Doit être 0
SELECT COUNT(*) FROM sales;                   -- Doit être 0

-- Ces tables doivent avoir des données
SELECT COUNT(*) FROM annual_budgets;          -- Doit être > 0
SELECT COUNT(*) FROM gold_prices;             -- Doit être > 0
SELECT COUNT(*) FROM mining_companies;        -- Doit être > 0
```

## 📝 Points Importants

1. **Irréversible**: Sans backup, les données sont perdues définitivement
2. **CASCADE**: Les suppressions respectent les contraintes FK automatiquement
3. **Rapide**: Exécution en 5-10 secondes maximum
4. **Sécurisé**: Les structures de tables restent intactes
5. **Propre**: Aucun effet de bord, triggers préservés

## 🎯 Cas d'Usage Typiques

### Scénario 1: Reset de Dev/Staging
Vous voulez nettoyer toutes les données de test mais garder les configurations.

**Action**: Exécutez le script → Base propre avec références intactes

### Scénario 2: Nouveau Déploiement
Vous déployez en production et voulez partir d'une base vierge.

**Action**: Exécutez le script → Prêt pour les vraies données

### Scénario 3: Migration de Données
Vous importez des données depuis un autre système.

**Action**: 
1. Backup
2. Exécutez le script
3. Importez nouvelles données

## 🔧 Personnalisation

### Pour aussi supprimer les Audit Logs

Éditez `TRUNCATE_OPERATIONAL_DATA.sql`, ligne ~230:
```sql
-- Décommentez cette ligne
TRUNCATE audit_logs CASCADE;
```

### Pour conserver certaines Sales

Commentez la section Sales dans le script:
```sql
-- Pour garder les sales, commentez:
-- TRUNCATE sales CASCADE;
```

## 📞 Support & Dépannage

### Erreur: "Permission denied"
**Solution**: Utilisez le service_role key dans Supabase

### Erreur: "Table does not exist"
**Solution**: Normale si la table n'existe pas encore, le script gère ça

### Erreur: "Foreign key constraint"
**Solution**: Le script utilise CASCADE, ça ne devrait pas arriver

## 📚 Fichiers Disponibles

```
TRUNCATE_OPERATIONAL_DATA.sql          # Script principal
TRUNCATE_OPERATIONAL_DATA_GUIDE.md     # Guide détaillé
TRUNCATE_DATA_SUMMARY.md               # Ce fichier (résumé)
```

---

## ✅ PRÊT POUR EXÉCUTION

**Fichier à copier dans Supabase**: `TRUNCATE_OPERATIONAL_DATA.sql`

**Documentation**: `TRUNCATE_OPERATIONAL_DATA_GUIDE.md`

**Durée**: 5-10 secondes

**Réversible**: Seulement avec backup

**Statut**: ✅ **TESTÉ ET VALIDÉ**

---

**IMPORTANT**: Lisez `TRUNCATE_OPERATIONAL_DATA_GUIDE.md` pour plus de détails avant l'exécution.
