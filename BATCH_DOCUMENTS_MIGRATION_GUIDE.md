# 📋 GUIDE DE MIGRATION - MODULE BATCH DOCUMENTS

## 🎯 OBJECTIF
Appliquer uniquement les migrations manquantes pour le module de documents de batch, sans écraser les configurations existantes.

---

## ✅ CONTEXTE
D'après votre message:
- ✅ Les buckets de storage sont **déjà créés** (batch-documents, assay-certificates)
- ✅ Les policies pour assay-certificates sont **déjà en place**
- ⚠️ Besoin de vérifier ce qui manque pour batch-documents

---

## 📝 PROCESSUS EN 3 ÉTAPES

### 📊 ÉTAPE 1: DIAGNOSTIC (OBLIGATOIRE)

**Fichier:** `VERIFY_BATCH_DOCUMENTS_STATUS.sql`

**Action:**
1. Ouvrez Supabase Dashboard → SQL Editor
2. Copiez le contenu de `VERIFY_BATCH_DOCUMENTS_STATUS.sql`
3. Exécutez le script
4. Examinez les résultats

**Ce que le script vérifie:**
- ✅ Migrations déjà appliquées
- ✅ Table `batch_documents` (existe / colonnes)
- ✅ Indexes de performance (5 attendus)
- ✅ RLS activé sur la table
- ✅ Policies RLS table (4 attendues)
- ✅ Storage buckets (batch-documents, assay-certificates)
- ✅ Policies RLS storage (4 attendues)
- ✅ Vue `v_batch_documents_with_details`
- ✅ Triggers automatiques
- ✅ Fonctions associées

**Résultats attendus:**

Le script retournera un tableau avec des indicateurs:
- `✅ OUI` = Élément existe
- `❌ NON` = Élément manquant
- `⚠️ INCOMPLET` = Partiellement configuré

---

### 🔧 ÉTAPE 2: APPLICATION SÉCURISÉE (SI NÉCESSAIRE)

**Fichier:** `SAFE_APPLY_BATCH_DOCUMENTS.sql`

**Quand l'utiliser:**
- Si l'ÉTAPE 1 montre des éléments `❌ NON` ou `⚠️ INCOMPLET`
- Vous ne savez pas exactement quelle migration appliquer
- Vous voulez un script "intelligent" qui détecte ce qui manque

**Action:**
1. Ouvrez Supabase Dashboard → SQL Editor
2. Copiez le contenu de `SAFE_APPLY_BATCH_DOCUMENTS.sql`
3. Exécutez le script
4. Lisez les messages dans "Messages" (NOTICE)

**Garanties de sécurité:**
- ✅ Aucun DROP de données existantes
- ✅ Toutes les commandes ont des vérifications IF NOT EXISTS
- ✅ Peut être exécuté plusieurs fois sans danger
- ✅ N'écrase pas les buckets existants
- ✅ Messages détaillés de ce qui est créé/existant

**Ce que le script fait:**

1. **Table batch_documents** (CREATE TABLE IF NOT EXISTS)
   - 13 colonnes avec types appropriés
   - Contraintes CHECK sur document_type et lifecycle_stage
   - Foreign keys vers batches et user_profiles

2. **5 Indexes de performance**
   - idx_batch_documents_batch_id
   - idx_batch_documents_type
   - idx_batch_documents_stage (partiel)
   - idx_batch_documents_created_at (DESC)
   - idx_batch_documents_uploaded_by

3. **RLS sur table**
   - Active RLS si pas déjà activé

4. **4 Policies RLS table**
   - SELECT: Utilisateurs authentifiés peuvent voir
   - INSERT: Upload avec uploaded_by = auth.uid()
   - UPDATE: Uniquement ses propres documents
   - DELETE: Uniquement ses propres documents

5. **Bucket batch-documents**
   - Créé avec ON CONFLICT DO UPDATE
   - Limite: 10MB
   - Types MIME autorisés: PDF, JPG, PNG, DOC, DOCX

6. **4 Policies RLS storage**
   - INSERT: Upload autorisé
   - SELECT: Lecture autorisée
   - UPDATE: Uniquement ses propres fichiers
   - DELETE: Uniquement ses propres fichiers

7. **Fonction & Trigger**
   - Fonction: update_batch_documents_updated_at()
   - Trigger: Met à jour updated_at automatiquement

8. **Vue enrichie**
   - v_batch_documents_with_details
   - Jointures avec user_profiles et batches
   - Permissions accordées

9. **Commentaires**
   - Documentation sur table et colonnes

10. **Résumé final**
    - Rapport détaillé dans les NOTICE
    - Message de succès ou d'avertissement

---

### ✅ ÉTAPE 3: VÉRIFICATION FINALE (OBLIGATOIRE)

**Action:**
1. Réexécutez `VERIFY_BATCH_DOCUMENTS_STATUS.sql`
2. Vérifiez que tout est `✅ OUI` / `✅ PRÊT`

**Résultat attendu:**
```
✅ Table batch_documents: PRÊT
✅ Storage batch-documents: PRÊT
✅ RLS Policies (table): PRÊT (4 policies)
✅ RLS Policies (storage): PRÊT (4 policies)
✅ Vue avec détails: PRÊT
✅ Indexes: PRÊT (5 indexes)
✅ Triggers: PRÊT
```

---

## 🔍 SCÉNARIOS POSSIBLES

### Scénario A: Tout est déjà en place
**Diagnostic montre:** Tous les éléments sont `✅ OUI`

**Action:** Rien à faire! Le module est opérationnel.

---

### Scénario B: Table manquante
**Diagnostic montre:** `❌ NON - Table manquante`

**Action:**
1. Exécutez `SAFE_APPLY_BATCH_DOCUMENTS.sql`
2. Vérifiez avec `VERIFY_BATCH_DOCUMENTS_STATUS.sql`

---

### Scénario C: Policies manquantes
**Diagnostic montre:** `⚠️ INCOMPLET (2 policies)` au lieu de 4

**Action:**
1. Exécutez `SAFE_APPLY_BATCH_DOCUMENTS.sql`
2. Le script créera uniquement les policies manquantes
3. Vérifiez avec `VERIFY_BATCH_DOCUMENTS_STATUS.sql`

---

### Scénario D: Éléments partiels
**Diagnostic montre:** Mélange de `✅`, `❌`, et `⚠️`

**Action:**
1. Exécutez `SAFE_APPLY_BATCH_DOCUMENTS.sql`
2. Le script est idempotent, il créera seulement ce qui manque
3. Vérifiez avec `VERIFY_BATCH_DOCUMENTS_STATUS.sql`

---

## ⚠️ NOTES IMPORTANTES

### Buckets déjà créés
Vous avez mentionné que les buckets sont déjà créés. Le script:
- Utilise `ON CONFLICT DO UPDATE` pour le bucket batch-documents
- Ne causera pas d'erreur si le bucket existe
- Mettra à jour la configuration (limites, MIME types) si nécessaire

### Policies Assay Certificates
Vous avez mentionné qu'elles sont déjà en place:
- Le script ne touche PAS aux policies assay-certificates
- Il se concentre uniquement sur batch-documents
- Aucun risque de conflit

### Migrations précédentes
Si vous avez déjà exécuté des migrations manuellement:
- Le script détectera ce qui existe
- Il ne créera que ce qui manque
- Aucun risque de doublon grâce aux IF NOT EXISTS

---

## 🎯 CHECKLIST RAPIDE

Cochez au fur et à mesure:

- [ ] 1. Exécuté `VERIFY_BATCH_DOCUMENTS_STATUS.sql`
- [ ] 2. Identifié les éléments manquants (❌ ou ⚠️)
- [ ] 3. Si éléments manquants: Exécuté `SAFE_APPLY_BATCH_DOCUMENTS.sql`
- [ ] 4. Lu les messages NOTICE dans Supabase
- [ ] 5. Réexécuté `VERIFY_BATCH_DOCUMENTS_STATUS.sql`
- [ ] 6. Confirmé que tout est `✅`
- [ ] 7. Testé l'upload d'un document dans l'interface

---

## 🔬 TESTS RECOMMANDÉS

Après la migration, testez dans l'interface:

### Test 1: Upload de document
1. Ouvrez un batch dans l'interface
2. Cliquez sur l'onglet "Documents"
3. Cliquez "Upload Document"
4. Remplissez le formulaire
5. Uploadez un fichier PDF de test
6. Vérifiez que le document apparaît dans la liste

### Test 2: Vérification SQL
```sql
-- Voir les documents uploadés
SELECT * FROM v_batch_documents_with_details;

-- Compter les documents par type
SELECT document_type, COUNT(*)
FROM batch_documents
GROUP BY document_type;

-- Voir les fichiers dans storage
SELECT * FROM storage.objects
WHERE bucket_id = 'batch-documents';
```

---

## 🆘 EN CAS DE PROBLÈME

### Erreur: "relation already exists"
**Cause:** Élément déjà créé
**Solution:** Normal, continuez. Le script ignore cette erreur.

### Erreur: "foreign key violation"
**Cause:** Table batches ou user_profiles manquante
**Solution:** Appliquez les migrations de base du système d'abord.

### Erreur: "policy already exists"
**Cause:** Policy déjà créée (mais peut-être avec une définition différente)
**Solution:**
1. Listez les policies existantes:
```sql
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'batch_documents';
```
2. Si nécessaire, DROP manuellement la policy conflictuelle
3. Réexécutez le script

### Aucun document n'apparaît après upload
**Cause possible:** RLS policies trop restrictives
**Solution:**
1. Vérifiez que l'utilisateur est authentifié
2. Vérifiez les policies:
```sql
SELECT * FROM pg_policies WHERE tablename = 'batch_documents';
```
3. Testez sans RLS temporairement (admin uniquement):
```sql
ALTER TABLE batch_documents DISABLE ROW LEVEL SECURITY;
-- Testez
-- Puis réactivez:
ALTER TABLE batch_documents ENABLE ROW LEVEL SECURITY;
```

---

## 📊 STRUCTURE FINALE ATTENDUE

### Table batch_documents
```
Colonnes: 13
- id, batch_id, document_type, document_name
- file_url, file_size, mime_type
- uploaded_by, lifecycle_stage, description
- created_at, updated_at
```

### Indexes: 5
- batch_id, type, stage (partiel), created_at DESC, uploaded_by

### RLS Policies: 4 (table) + 4 (storage)
- SELECT, INSERT, UPDATE, DELETE sur table
- SELECT, INSERT, UPDATE, DELETE sur storage

### Vue: 1
- v_batch_documents_with_details

### Trigger: 1
- update_batch_documents_timestamp

### Fonction: 1
- update_batch_documents_updated_at()

---

## 🎉 SUCCÈS!

Si après l'ÉTAPE 3 tout est ✅, félicitations!

Le module de documents de batch est maintenant complètement opérationnel:
- ✅ Base de données configurée
- ✅ Sécurité RLS en place
- ✅ Storage bucket prêt
- ✅ Interface frontend raffinée
- ✅ Prêt pour la production

**Prochaines étapes:**
1. Testez l'upload de documents
2. Vérifiez les permissions utilisateur
3. Testez avec différents types de documents
4. Validez le workflow complet

---

**Besoin d'aide?** Référez-vous aux sections "EN CAS DE PROBLÈME" ou aux scripts de vérification.
