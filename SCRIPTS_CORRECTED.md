# ✅ Scripts Corrigés - Nom de Colonne

## 🔧 Problème Trouvé

**Erreur:**
```
ERROR: 42703: column spi.production_id does not exist
```

**Cause:** Les scripts utilisaient `spi.production_id` mais la colonne s'appelle `spi.daily_production_id`

---

## ✅ Scripts Corrigés

### 1. cleanup-invalid-shippings.sql
- ✅ Remplacé `spi.production_id` → `spi.daily_production_id`
- ✅ Mis à jour dans 3 endroits du script

### 2. diagnostic-shipping-delete-error.sql
- ✅ Remplacé `spi.production_id` → `spi.daily_production_id`
- ✅ Mis à jour dans la requête de diagnostic

---

## 📋 Structure Réelle

**Table: shipping_production_items**
```sql
CREATE TABLE shipping_production_items (
  id UUID,
  shipping_preparation_id UUID,
  daily_production_id UUID,  -- ✅ Nom correct !
  ingot_box_number TEXT,
  net_weight_grams DECIMAL,
  gross_weight_grams DECIMAL,
  fineness_pct DECIMAL,
  pure_gold_grams DECIMAL,
  seal_number_1 TEXT,
  seal_number_2 TEXT,
  order_index INTEGER,
  created_at TIMESTAMPTZ
);
```

**Clé étrangère:**
```sql
daily_production_id REFERENCES daily_production(id)
```

---

## 🎯 Action

**Les scripts sont maintenant corrigés et prêts à utiliser !**

### Étape 1: Migration (toujours requis)
```sql
-- supabase/migrations/20251115_001_fix_shipping_delete_trigger.sql
-- → Run dans Supabase SQL Editor
```

### Étape 2: Nettoyage (CORRIGÉ)
```sql
-- scripts/cleanup-invalid-shippings.sql
-- → Run dans Supabase SQL Editor
-- ✅ Devrait fonctionner sans erreur maintenant
```

### Étape 3: Diagnostic (CORRIGÉ, optionnel)
```sql
-- scripts/diagnostic-shipping-delete-error.sql
-- → Run dans Supabase SQL Editor
```

---

## ✅ Vérification

Pour vérifier la structure:
```sql
-- scripts/verify-shipping-structure.sql
-- Affiche toutes les colonnes de shipping_production_items
```

---

**Status: ✅ CORRIGÉ**

**Date: 2025-01-15**
