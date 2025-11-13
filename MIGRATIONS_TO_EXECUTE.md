# 📋 MIGRATIONS À EXÉCUTER MANUELLEMENT

## 🎯 ORDRE D'EXÉCUTION

### ⚠️ IMPORTANT
Exécuter ces migrations dans l'ordre indiqué pour éviter les erreurs de dépendances.

---

## 1️⃣ MIGRATION STORAGE (PRIORITAIRE) ⭐

### Fichier
```
supabase/migrations/20251113_011_fix_assay_certificates_storage.sql
```

### Pourquoi
- ✅ Corrige l'erreur "we hit a snag" lors de l'upload d'assay certificates
- ✅ Crée les buckets nécessaires pour documents et certificats
- ✅ Configure les politiques RLS pour sécuriser les accès

### Ce qu'elle fait
1. Crée le bucket `ASSAY-CERTIFICATES` (public)
2. Crée le bucket `shipping-documents` (public)
3. Configure 8 politiques RLS (4 par bucket):
   - INSERT (upload)
   - SELECT (lecture)
   - UPDATE (modification)
   - DELETE (suppression)

### Comment l'exécuter

#### Option A: Supabase Dashboard
1. Aller sur https://supabase.com/dashboard
2. Sélectionner votre projet
3. Aller dans **SQL Editor**
4. Créer une nouvelle query
5. Copier/coller le contenu complet du fichier `20251113_011_fix_assay_certificates_storage.sql`
6. Cliquer **RUN** ou Cmd+Enter / Ctrl+Enter

#### Option B: CLI Supabase (si installé)
```bash
supabase migration up 20251113_011_fix_assay_certificates_storage
```

### Résultat Attendu
```sql
INSERT 0 2                     -- 2 buckets créés ou mis à jour
CREATE POLICY                  -- 8 politiques créées
```

### Vérification
```sql
-- Vérifier les buckets
SELECT * FROM storage.buckets 
WHERE id IN ('ASSAY-CERTIFICATES', 'shipping-documents');

-- Résultat attendu:
-- ASSAY-CERTIFICATES    | t (public)
-- shipping-documents    | t (public)

-- Vérifier les politiques
SELECT COUNT(*) FROM pg_policies 
WHERE tablename = 'objects' 
AND (policyname LIKE '%assay%' OR policyname LIKE '%shipping%');

-- Résultat attendu: 8
```

---

## 2️⃣ MIGRATION BUDGET (OPTIONNELLE)

### Fichier
```
supabase/migrations/20251113_010_add_mining_company_to_budgets.sql
```

### Quand l'exécuter
✅ Si vous utilisez le module **Budget/Forecast**
❌ Sinon, vous pouvez ignorer

### Ce qu'elle fait
1. Ajoute `mining_company_id` aux tables de budget
2. Crée des index pour performance
3. Met à jour les politiques RLS
4. Permet la gestion par compagnie minière

### Référence
Voir documentation complète dans:
- `BUDGET_MODULE_IMPROVEMENTS.md`
- `BUDGET_COLORS_UPDATED.md`
- `BUDGET_QUICK_START.md`

---

## ✅ CHECKLIST POST-MIGRATION

### Après Migration Storage (011)

- [ ] Vérifier que les 2 buckets sont créés
- [ ] Vérifier que les 8 politiques RLS sont actives
- [ ] Tester upload d'un document dans Shipping
- [ ] Tester upload d'un assay certificate
- [ ] Vérifier qu'il n'y a plus d'erreur "we hit a snag"

### Tests Fonctionnels

- [ ] Aller sur une page d'expédition
- [ ] Cliquer sur l'onglet "Documents"
- [ ] Cliquer "Ajouter un Document"
- [ ] Uploader un fichier PDF
- [ ] Vérifier que le document apparaît dans la liste
- [ ] Cliquer sur les boutons Voir/Télécharger
- [ ] Supprimer le document de test

- [ ] Cliquer sur "Upload Certificate"
- [ ] Uploader un PDF d'assay certificate
- [ ] Vérifier que l'upload réussit
- [ ] Pas d'erreur "we hit a snag"
- [ ] Certificate apparaît dans la liste

### Changement de Statut

- [ ] Section "Statut" affiche le statut actuel avec icône
- [ ] Boutons "Actions Disponibles" visibles
- [ ] Cliquer sur un bouton d'action
- [ ] Modal de confirmation s'ouvre
- [ ] Ajouter des notes (optionnel)
- [ ] Confirmer le changement
- [ ] Statut mis à jour
- [ ] Notes enregistrées dans l'historique

---

## 🚨 EN CAS DE PROBLÈME

### Erreur "Bucket already exists"
✅ **Normal** - La migration utilise `ON CONFLICT DO NOTHING`
✅ Continue l'exécution, les politiques seront créées

### Erreur "Policy already exists"
✅ **Normal** - La migration utilise `DROP POLICY IF EXISTS` puis `CREATE POLICY`
✅ Les anciennes politiques sont remplacées

### Erreur "Permission denied"
❌ Vérifier que vous êtes connecté avec un compte admin
❌ Vérifier les permissions de votre utilisateur Supabase

### Upload échoue après migration
1. Vérifier les buckets: `SELECT * FROM storage.buckets`
2. Vérifier les politiques: `SELECT * FROM pg_policies WHERE tablename = 'objects'`
3. Vider le cache du navigateur (Ctrl+Shift+R)
4. Réessayer l'upload

---

## 📞 SUPPORT

### Documentation Complète
- `SHIPPING_DETAILS_IMPROVEMENTS.md` - Détails techniques
- `SHIPPING_IMPROVEMENTS_SUMMARY.md` - Résumé des features
- `BUDGET_MODULE_IMPROVEMENTS.md` - Module budget (si utilisé)

### Logs
En cas de problème, vérifier les logs:
- Console navigateur (F12)
- Supabase Dashboard → Logs
- Messages d'erreur complets

---

## 📊 RÉSUMÉ

| Migration | Fichier | Obligatoire | Dépendances |
|-----------|---------|-------------|-------------|
| Storage | `20251113_011_fix_assay_certificates_storage.sql` | ✅ OUI | Aucune |
| Budget | `20251113_010_add_mining_company_to_budgets.sql` | ⚠️ Si module budget | Aucune |

**Total migrations obligatoires:** 1
**Temps d'exécution estimé:** < 1 minute
**Risque:** Faible (migrations idempotentes)

---

**✅ Une fois les migrations exécutées, l'application est prête pour production!**
