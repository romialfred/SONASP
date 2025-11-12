# 🚨 CORRECTION IMMÉDIATE - Erreur license_id

**Erreur** : `record "new" has no field "license_id"`
**Solution** : Appliquer la migration SQL

## ⚡ Action Urgente (2 minutes)

### 1. Ouvrir Supabase Dashboard
https://boolqagzdqbahqnpawpb.supabase.co

### 2. SQL Editor > New Query

### 3. Copier TOUT le fichier
`supabase/migrations/add_export_licenses_system.sql`

### 4. Run

### 5. Vérifier
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'shipping_preparations' AND column_name = 'license_id';
```

Si vous voyez `license_id`, c'est bon ✅

### 6. Rafraîchir l'application (F5)

L'erreur sera résolue ! 🎉

---

## 📖 Documentation Complète

- `EXPORT_LICENSES_MODULE_COMPLETE.md` - Guide complet
- `QUICK_FIX_SHIPPING.md` - Résolution d'erreurs

