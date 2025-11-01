# QUICK START - RÉSOUDRE L'ERREUR RLS

## SITUATION ACTUELLE

✅ Vous avez créé 4 policies (je les vois dans votre screenshot)
❌ Mais la requête SQL ne les trouve pas avec `LIKE '%ASSAY-CERTIFICATES%'`

**POURQUOI?** Les noms de vos policies sont:
- "Authenticated users can upload certificates"
- "Users can delete their certificates"
- etc.

Ces noms ne contiennent PAS "ASSAY-CERTIFICATES" donc la recherche échoue!

---

## SOLUTION RAPIDE (2 MINUTES)

### Option A: Tester si vos policies fonctionnent déjà

1. **Hard refresh browser**: Ctrl+Shift+R
2. **Allez sur Batch Details**
3. **Essayez d'uploader un certificat**

**SI ÇA MARCHE** → Parfait, vos policies sont bonnes!

**SI ÇA NE MARCHE PAS** → Passez à Option B

---

### Option B: Remplacer avec des policies simples

1. **Copiez tout le contenu de:** `REPLACE_POLICIES_NOW.sql`
2. **Supabase → SQL Editor**
3. **Collez et RUN**
4. **Vérifiez le résultat:** Devrait afficher "✅ SUCCESS: 4 policies created"
5. **Hard refresh:** Ctrl+Shift+R
6. **Testez l'upload**

---

## DIAGNOSTIC

Avant de remplacer, vous pouvez diagnostiquer:

### 1. Voir toutes vos policies
```sql
SELECT policyname, cmd 
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY cmd;
```

### 2. Vérifier si elles checkent bucket_id
Executez: `SHOW_POLICY_DETAILS.sql`

Si vous voyez "❌ Does NOT check bucket_id", alors vos policies s'appliquent à TOUS les buckets, pas juste ASSAY-CERTIFICATES.

---

## COMPRENDRE LE PROBLÈME

**Vos policies actuelles (dans l'interface):**
- Nom: "Authenticated users can upload certificates"
- Condition: ???

**Policies nécessaires:**
- Nom: Peu importe!
- Condition: `bucket_id = 'ASSAY-CERTIFICATES'` ← CRUCIAL!

Sans cette condition, la policy ne sait pas sur quel bucket s'appliquer!

---

## FICHIERS À UTILISER

**Diagnostic:**
- `CHECK_YOUR_ACTUAL_POLICIES.sql` - Voir toutes vos policies
- `SHOW_POLICY_DETAILS.sql` - Voir les détails (USING/WITH CHECK)

**Fix:**
- `REPLACE_POLICIES_NOW.sql` - Remplace tout avec des policies simples

**Vérification:**
- `CHECK_STORAGE_STATUS.sql` - Status complet du bucket

---

## APRÈS LE FIX

Une fois les policies appliquées:

1. ✅ Hard refresh (Ctrl+Shift+R)
2. ✅ Batch Details → Right panel → **Assay Certificates au TOP**
3. ✅ Cliquez sur header pour collapse/expand
4. ✅ Upload certificat → **PAS D'ERREUR RLS!**
5. ✅ Parsing automatique
6. ✅ Certificat affiché dans la liste

---

## EN CAS DE PROBLÈME

**Erreur persiste?**

Vérifiez dans la console browser (F12):
```javascript
// Vérifier l'auth
const { data } = await supabase.auth.getUser()
console.log('User:', data.user)

// Vérifier le bucket
const { data: buckets } = await supabase.storage.listBuckets()
console.log('Buckets:', buckets)
```

**Bucket name mismatch?**
Le code utilise `'ASSAY-CERTIFICATES'` (uppercase).
Vérifiez que le bucket existe avec ce nom exact.

---

## RÉSUMÉ

**MAINTENANT:**
1. Testez upload (après hard refresh)
2. Si erreur → Executez REPLACE_POLICIES_NOW.sql
3. Hard refresh
4. Testez à nouveau
5. ✅ Devrait fonctionner!

**Les policies DOIVENT avoir:**
- `FOR INSERT` avec `WITH CHECK (bucket_id = 'ASSAY-CERTIFICATES')`
- `FOR SELECT` avec `USING (bucket_id = 'ASSAY-CERTIFICATES')`
- `FOR UPDATE` avec les deux clauses
- `FOR DELETE` avec `USING (bucket_id = 'ASSAY-CERTIFICATES')`

Sans ces conditions, les policies ne s'appliquent pas correctement au bucket!
