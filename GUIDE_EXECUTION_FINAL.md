# 📋 Guide d'Exécution Professionnel - Fix Shipping

## ✅ Scripts CORRIGÉS - Colonnes Exactes

### Problème Résolu:
- ❌ `sp.export_license_id` → N'existe pas
- ❌ `sp.total_weight_grams` → N'existe pas  
- ✅ `sp.total_net_weight_grams` → Existe
- ✅ Colonnes vérifiées dans la structure réelle

---

## 🎯 Étape 1: LISTER les Invalides (SÉCURISÉ)

**Script:** `scripts/list-invalid-shippings.sql`

**Action:** LISTE seulement, NE SUPPRIME PAS

```sql
-- Copier-coller: scripts/list-invalid-shippings.sql
-- → Run dans Supabase SQL Editor
```

**Affiche:**
- ID et lot des shipping invalides
- Status des productions (prepared)
- Commande pour supprimer manuellement

---

## 🧹 Étape 2: NETTOYER (ACTION)

**Script:** `scripts/cleanup-invalid-shippings-FIXED.sql`

**Action:** SUPPRIME les shipping invalides

```sql
-- Copier-coller: scripts/cleanup-invalid-shippings-FIXED.sql
-- → Run dans Supabase SQL Editor
```

**Résultat attendu:**
```
✅ NETTOYAGE TERMINÉ AVEC SUCCÈS
Shipping supprimées: 1
```

---

## ✅ Étape 3: VÉRIFIER

```sql
-- Vérifier qu'il ne reste rien:
SELECT COUNT(*) as invalides
FROM shipping_preparations sp
LEFT JOIN shipping_production_items spi 
  ON spi.shipping_preparation_id = sp.id
LEFT JOIN daily_production dp 
  ON dp.id = spi.daily_production_id
WHERE dp.status = 'prepared';

-- Résultat attendu: 0
```

---

## 📊 Scripts Disponibles

1. **verify-shipping-preparations-structure.sql**
   - Affiche toutes les colonnes
   - Lecture seule

2. **list-invalid-shippings.sql** ⭐
   - Liste les shipping invalides
   - NE SUPPRIME PAS
   - RECOMMANDÉ en premier

3. **cleanup-invalid-shippings-FIXED.sql** ⚠️
   - Supprime les invalides
   - ACTION DESTRUCTIVE
   - Utiliser après avoir listé

---

**Build:** ✅ OK
**Status:** ✅ CORRIGÉ
**Version:** FIXED
