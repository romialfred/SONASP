# ⚡ Quick Fix: Erreur Suppression Shipping

## 🎯 Problème
Impossible de supprimer une shipping_preparation:
```
ERROR: function release_license_quota(uuid, uuid, numeric, uuid) does not exist
```

## ✅ Solution (5 minutes)

### Étape 1: Fix le Trigger
```sql
-- Dans Supabase SQL Editor
-- Copier-coller: supabase/migrations/20251115_001_fix_shipping_delete_trigger.sql
-- → Run
```

### Étape 2: Nettoyer les Données
```sql
-- Dans Supabase SQL Editor
-- Copier-coller: scripts/cleanup-invalid-shippings.sql
-- → Run
-- Vérifier: "✅ NETTOYAGE TERMINÉ AVEC SUCCÈS"
```

### Étape 3: Vérifier
```sql
-- Essayer de supprimer dans l'interface
-- Devrait fonctionner maintenant ✅
```

---

## 🔍 Diagnostic (Optionnel)
```sql
-- scripts/diagnostic-shipping-delete-error.sql
-- Voir l'état actuel
```

---

## 📚 Documentation Complète
Voir `FIX_SHIPPING_DELETE_ERROR.md` pour tous les détails.

---

**Temps: 5 min**
**Build: ✅ OK**
