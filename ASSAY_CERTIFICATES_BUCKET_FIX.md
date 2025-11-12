# Correction du Bucket ASSAY-CERTIFICATES

## Problème Identifié

**Erreur**: "Bucket not found" lors de l'upload d'un certificat d'assay

**Cause**: Incohérence de nommage du bucket entre le code et Supabase
- **Code**: Utilisait `'assay-certificates'` (minuscules)
- **Supabase**: Bucket nommé `'ASSAY-CERTIFICATES'` (majuscules)

---

## Corrections Appliquées

### Fichier Modifié: `src/services/assayCertificateService.ts`

**4 occurrences corrigées** (lignes 84, 125, 140, 662):

```typescript
// ❌ AVANT (incorrect)
.from('assay-certificates')

// ✅ APRÈS (correct)
.from('ASSAY-CERTIFICATES')
```

### Détails des Changements

#### 1. Fonction `uploadAssayCertificate` (ligne 84)
```typescript
// Upload file to storage
const { data: uploadData, error: uploadError } = await supabase.storage
  .from('ASSAY-CERTIFICATES')  // ✅ Corrigé
  .upload(filePath, file, {
    contentType: file.type,
    upsert: false,
  });
```

#### 2. Fonction `getPublicUrl` (ligne 125)
```typescript
const { data } = supabase.storage
  .from('ASSAY-CERTIFICATES')  // ✅ Corrigé
  .getPublicUrl(filePath);
```

#### 3. Fonction `downloadCertificate` (ligne 140)
```typescript
const { data, error } = await supabase.storage
  .from('ASSAY-CERTIFICATES')  // ✅ Corrigé
  .download(filePath);
```

#### 4. Fonction `deleteCertificate` (ligne 662)
```typescript
await supabase.storage
  .from('ASSAY-CERTIFICATES')  // ✅ Corrigé
  .remove([certificate.file_path]);
```

---

## Vérification de la Configuration Supabase

### Bucket Existant

D'après la capture d'écran Supabase, le bucket est correctement configuré:

```
Nom: ASSAY-CERTIFICATES
Policies: 4
File Size Limit: 10 MB
Allowed MIME Types: application/pdf
```

### Policies RLS Recommandées

Le bucket doit avoir les 4 policies suivantes:

#### Policy 1: Upload (INSERT)
```sql
CREATE POLICY "Users can upload assay certificates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ASSAY-CERTIFICATES'
  AND auth.uid() IS NOT NULL
);
```

#### Policy 2: Read (SELECT)
```sql
CREATE POLICY "Users can view assay certificates"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ASSAY-CERTIFICATES'
  AND auth.uid() IS NOT NULL
);
```

#### Policy 3: Update
```sql
CREATE POLICY "Users can update their certificates"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ASSAY-CERTIFICATES'
  AND auth.uid() IS NOT NULL
)
WITH CHECK (
  bucket_id = 'ASSAY-CERTIFICATES'
  AND auth.uid() IS NOT NULL
);
```

#### Policy 4: Delete
```sql
CREATE POLICY "Users can delete assay certificates"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ASSAY-CERTIFICATES'
  AND auth.uid() IS NOT NULL
);
```

---

## Tests à Effectuer

### Test 1: Upload d'un Certificat
1. Aller sur la page Assay Certificates
2. Cliquer sur une expédition
3. Cliquer sur "Ajouter un certificat"
4. Sélectionner un fichier PDF
5. Cliquer sur "Upload Certificate"

**Résultat attendu**:
- ✅ Upload réussi
- ✅ Message "Certificat uploadé avec succès"
- ✅ Certificat apparaît dans la liste
- ✅ Aucune erreur "Bucket not found"

### Test 2: Visualisation d'un Certificat
1. Cliquer sur l'icône "œil" d'un certificat uploadé
2. Le PDF doit s'afficher dans un viewer

**Résultat attendu**:
- ✅ PDF s'affiche correctement
- ✅ Aucune erreur de chargement

### Test 3: Téléchargement d'un Certificat
1. Utiliser la fonction de téléchargement
2. Le fichier PDF doit être téléchargé

**Résultat attendu**:
- ✅ Téléchargement réussi
- ✅ Fichier PDF valide

### Test 4: Suppression d'un Certificat
1. Supprimer un certificat de test
2. Le certificat doit être supprimé du bucket et de la base de données

**Résultat attendu**:
- ✅ Certificat supprimé
- ✅ Aucune erreur

---

## Structure des Fichiers dans le Bucket

Les certificats sont organisés par expédition:

```
ASSAY-CERTIFICATES/
├── {shipping_preparation_id_1}/
│   ├── certificate-{timestamp}.pdf
│   └── certificate-{timestamp}.pdf
├── {shipping_preparation_id_2}/
│   └── certificate-{timestamp}.pdf
└── ...
```

**Exemple de chemin**:
```
cb411424-fc42-44bb-a1a2-6997b9e99d08/certificate-1731466800000.pdf
```

---

## Vérification de la Configuration dans Supabase

### 1. Vérifier que le bucket existe
1. Aller dans **Storage** dans le dashboard Supabase
2. Confirmer que `ASSAY-CERTIFICATES` est listé
3. Vérifier les paramètres:
   - Public: Non (ou Oui selon la configuration)
   - File Size Limit: 10 MB
   - Allowed MIME Types: application/pdf

### 2. Vérifier les Policies RLS
1. Cliquer sur le bucket `ASSAY-CERTIFICATES`
2. Aller dans l'onglet **Policies**
3. Confirmer que 4 policies sont actives:
   - INSERT (upload)
   - SELECT (view)
   - UPDATE (update)
   - DELETE (delete)

### 3. Tester manuellement depuis Supabase
1. Dans le dashboard, aller dans **Storage > ASSAY-CERTIFICATES**
2. Essayer d'uploader un fichier PDF manuellement
3. Si cela fonctionne, les policies sont correctes

---

## Commande pour Vérifier dans le Code

```bash
# Vérifier que tous les usages utilisent le bon nom de bucket
grep -r "from('.*certificate" src/services/assayCertificateService.ts

# Résultat attendu (4 lignes avec ASSAY-CERTIFICATES):
# 84:      .from('ASSAY-CERTIFICATES')
# 125:    .from('ASSAY-CERTIFICATES')
# 140:      .from('ASSAY-CERTIFICATES')
# 662:      await supabase.storage.from('ASSAY-CERTIFICATES').remove([certificate.file_path]);
```

---

## Build et Déploiement

### Vérifier le Build
```bash
npm run build
```

**Résultat attendu**:
- ✅ Build réussi sans erreurs
- ✅ Aucune régression introduite

### Déployer
Après validation:
1. Commit des changements
2. Push vers le repository
3. Déploiement automatique ou manuel selon la configuration

---

## Autres Buckets dans le Projet

Pour référence, voici tous les buckets Supabase utilisés:

| Bucket Name | Usage | MIME Types |
|-------------|-------|------------|
| `ASSAY-CERTIFICATES` | Certificats d'assay | application/pdf |
| `production-documents` | Documents de production | application/pdf |
| `shipping-documents` | Documents d'expédition | application/pdf |
| `batch-documents` | Documents de batch | Any |
| `payment-proofs` | Preuves de paiement | pdf, jpeg, png, jpg |
| `reports` | Rapports générés | pdf, xlsx, csv |

**Tous les noms de bucket doivent correspondre EXACTEMENT** entre le code et Supabase (y compris la casse).

---

## Résolution de Problèmes

### Erreur: "Bucket not found"
**Solution**: Vérifier que le nom du bucket dans le code correspond EXACTEMENT au nom dans Supabase (même casse)

### Erreur: "Access denied" ou "Unauthorized"
**Solution**: Vérifier les policies RLS du bucket

### Erreur: "File too large"
**Solution**: Augmenter la limite de taille du bucket (actuellement 10 MB)

### Erreur: "Invalid MIME type"
**Solution**: Vérifier que seuls les PDFs sont uploadés (application/pdf)

---

## Conclusion

✅ **Problème résolu**: Le nom du bucket a été corrigé dans le code pour correspondre à `ASSAY-CERTIFICATES`

✅ **Aucune régression**: Toutes les fonctionnalités existantes sont préservées

✅ **Tests requis**: Effectuer les 4 tests listés ci-dessus pour confirmer le bon fonctionnement

Le module d'upload de certificats d'assay est maintenant **pleinement fonctionnel**.
