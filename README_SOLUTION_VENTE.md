# 🔴 Solution: Erreur "Failed to create sale"

## ⚡ DIAGNOSTIC

**Erreur console:**
```
code: "42703"
message: "record \"new\" has no field \"quantity_grams\""
```

**Cause:** Un trigger dans Supabase référence `quantity_grams` (n'existe pas).

---

## ✅ SOLUTION RAPIDE (2 minutes)

### Étapes:

1. **Ouvrir Supabase** → https://app.supabase.com
2. **SQL Editor** (menu gauche) → **New Query**
3. **Copier le fichier:** `COPIER_COLLER_CE_SQL_FIX_VENTE.sql`
4. **Coller** dans SQL Editor
5. **Cliquer:** Run (ou Ctrl+Enter)
6. **Voir:** ✅ FIX APPLIQUÉ ET VÉRIFIÉ!
7. **Rafraîchir** l'application (F5)
8. **Tester** la création de vente → ça fonctionne!

---

## 📋 Le SQL Fait Quoi?

1. Supprime les triggers obsolètes
2. Ajoute les statuses ENUM manquants
3. Configure le status par défaut
4. Teste l'insertion

---

## ✅ Après le Fix

- ✅ Création de vente fonctionne
- ✅ Aucune erreur HTTP 400
- ✅ Workflow complet disponible

---

**FICHIER À UTILISER:** `COPIER_COLLER_CE_SQL_FIX_VENTE.sql`

🚀 Prêt!
