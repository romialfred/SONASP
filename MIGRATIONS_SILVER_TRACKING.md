# 📋 Migrations à Exécuter - Silver Tracking

## ✅ Migration Unique à Appliquer

### **Fichier:** `supabase/migrations/20251113_012_add_silver_tracking_to_production.sql`

**Chemin complet:**
```
/tmp/cc-agent/59164212/project/supabase/migrations/20251113_012_add_silver_tracking_to_production.sql
```

## 🚀 Comment Exécuter

### **Option 1: Via l'Interface Supabase (Recommandé)**

1. Aller sur https://supabase.com/dashboard
2. Sélectionner votre projet
3. Aller dans **Database** → **Migrations** ou **SQL Editor**
4. Copier-coller le contenu du fichier `20251113_012_add_silver_tracking_to_production.sql`
5. Cliquer sur **Run** ou **Execute**

### **Option 2: Via Supabase CLI (si installé)**

```bash
cd /tmp/cc-agent/59164212/project
supabase db push
```

### **Option 3: Via psql (si accès direct)**

```bash
psql $DATABASE_URL -f supabase/migrations/20251113_012_add_silver_tracking_to_production.sql
```

## 📊 Ce que Fait cette Migration

### **1. Colonnes Ajoutées à `daily_production`**

| Colonne | Type | Description |
|---------|------|-------------|
| `estimated_gold_pct` | NUMERIC(5,2) | Pourcentage d'or (0-100%) |
| `estimated_silver_pct` | NUMERIC(5,2) | Pourcentage d'argent (0-100%) |
| `silver_content_grams` | NUMERIC(12,2) | Contenu en argent en grammes (calculé) |

### **2. Formule de Calcul Automatique**

```sql
silver_content_grams = bullion_grams × estimated_silver_pct ÷ 100
```

### **3. Migration Automatique des Données**

```sql
-- Copie automatique pour compatibilité
estimated_gold_pct = estimated_fineness_pct
```

### **4. Vue Créée**

```sql
CREATE VIEW daily_production_with_metals
-- Vue avec tous les calculs or et argent
```

## ✅ Vérification Rapide

Après exécution, vérifier avec:

```sql
-- Vérifier que les colonnes existent
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'daily_production'
  AND column_name IN ('estimated_gold_pct', 'estimated_silver_pct', 'silver_content_grams');
```

**Résultat attendu:**
```
estimated_gold_pct
estimated_silver_pct
silver_content_grams
```

## ⏱️ Durée d'Exécution

- **Temps estimé:** < 1 seconde
- **Type:** Migration idempotente (peut être réexécutée sans danger)
- **Données:** Aucune perte, migration automatique

## ⚠️ Important

- ✅ **Aucun arrêt de service requis**
- ✅ **Compatible avec le code existant**
- ✅ **Les politiques RLS s'appliquent automatiquement**
- ✅ **Backup automatique recommandé** (Supabase le fait automatiquement)

## 🎉 Après la Migration

Une fois la migration exécutée:

1. ✅ Le formulaire de production affichera les nouveaux champs
2. ✅ Le tableau de production affichera les colonnes Or% et Ag%
3. ✅ La préparation d'expédition affichera les totaux silver
4. ✅ Les rapports incluront les données silver

**Aucune action supplémentaire requise!**

---

**Date:** 2025-11-13
**Status:** ✅ Ready to Execute
**Build:** ✅ Passed (25.97s)
