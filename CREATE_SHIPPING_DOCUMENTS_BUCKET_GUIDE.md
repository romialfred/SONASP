# 📦 GUIDE COMPLET: Créer le Bucket `shipping-documents` dans Supabase

## 🎯 Objectif
Créer le bucket de stockage manquant pour les documents d'expédition (packing lists, certificats douaniers, etc.)

---

## 📋 PARTIE 1: CRÉATION DU BUCKET

### Étape 1: Accéder à Supabase Dashboard

1. Ouvrez votre navigateur
2. Allez sur: **https://boolqagzdqbahqnpawpb.supabase.co**
3. Connectez-vous avec vos identifiants Supabase
4. Vous arrivez sur le Dashboard de votre projet

---

### Étape 2: Naviguer vers Storage

1. Dans le menu de gauche, cherchez la section **"Storage"**
2. Cliquez sur **"Storage"**
3. Vous verrez la liste de vos buckets existants:
   - documents
   - reports
   - payment-proofs
   - batch-documents
   - assay-certificates
   - license-documents

**📸 Description de l'interface:**
- Menu de gauche: icônes verticales
- Section Storage: icône de dossier/disque
- Au centre: liste des buckets avec leur taille et nombre de fichiers
- En haut à droite: bouton **"New bucket"** (vert ou bleu)

---

### Étape 3: Créer le Nouveau Bucket

1. Cliquez sur le bouton **"New bucket"** (en haut à droite)
2. Une popup/modal s'ouvre avec un formulaire

**📋 Remplissez le formulaire comme suit:**

#### **Champ 1: Name (Nom du bucket)**
```
shipping-documents
```
⚠️ **IMPORTANT:** 
- Tapez EXACTEMENT: `shipping-documents` (avec le tiret)
- Pas d'espaces
- Tout en minuscules
- Le tiret est obligatoire

#### **Champ 2: Public bucket (Bucket public)**
```
❌ NON coché (décoché)
```
⚠️ **IMPORTANT:**
- Ne PAS cocher cette case
- Le bucket doit rester privé pour la sécurité
- Seuls les utilisateurs authentifiés pourront accéder

#### **Champ 3: File size limit (Limite de taille)**
```
20 MB
```
**Comment entrer:**
- Tapez: `20`
- Sélectionnez: `MB` dans le dropdown
- Ou entrez en bytes: `20971520`

**💡 Pourquoi 20MB?**
- Les documents douaniers peuvent être volumineux
- Permet des scans de haute qualité
- Plus grand que les autres buckets (10MB) mais raisonnable

#### **Champ 4: Allowed MIME types (Types de fichiers autorisés)**

**Option A: Si vous avez un champ texte**
```
application/pdf, image/jpeg, image/jpg, image/png, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

**Option B: Si vous avez des boutons/checkboxes**
Cochez:
- ✅ PDF (application/pdf)
- ✅ JPEG (image/jpeg)
- ✅ JPG (image/jpg)
- ✅ PNG (image/png)
- ✅ DOC (application/msword)
- ✅ DOCX (application/vnd.openxmlformats-officedocument.wordprocessingml.document)

**💡 Pourquoi ces types?**
- **PDF:** Certificats, factures, documents officiels
- **JPEG/JPG/PNG:** Scans, photos de documents
- **DOC/DOCX:** Documents Word (formulaires douaniers)

---

### Étape 4: Sauvegarder le Bucket

1. Vérifiez que tous les champs sont corrects
2. Cliquez sur le bouton **"Create bucket"** ou **"Save"** (en bas du formulaire)
3. La popup se ferme
4. Vous devriez voir votre nouveau bucket **"shipping-documents"** dans la liste

**✅ Vérification:**
- Le bucket apparaît dans la liste avec les autres
- Il indique: "Private" (privé)
- Il indique: "0 objects" (0 fichiers pour le moment)

---

## 🔐 PARTIE 2: CONFIGURATION DES POLICIES (Politiques de Sécurité)

⚠️ **TRÈS IMPORTANT:** Sans policies, personne ne pourra uploader ou voir les fichiers!

### Étape 5: Accéder aux Policies du Bucket

1. Dans la liste des buckets, trouvez **"shipping-documents"**
2. À droite du nom, vous verrez des icônes/boutons
3. Cliquez sur l'icône **"Policies"** (icône de cadenas ou bouclier)
4. Ou cliquez sur les 3 points verticaux ⋮ puis **"Policies"**
5. Une nouvelle page s'ouvre: **"Policies for shipping-documents"**

**📸 Description de l'interface:**
- Titre: "Policies for shipping-documents"
- Message: "No policies created yet"
- Bouton: **"New policy"** (en haut à droite)

---

### Étape 6: Créer la Policy SELECT (Voir les fichiers)

#### **6.1 Démarrer la création**
1. Cliquez sur **"New policy"**
2. Vous avez 2 options:
   - **"Get started quickly"** (templates)
   - **"For full customization"** (custom)
3. Choisissez: **"For full customization"**

#### **6.2 Remplir le formulaire SELECT**

**Champ: Policy name (Nom de la policy)**
```
Authenticated users can view shipping documents
```

**Champ: Policy command (Commande)**
```
SELECT
```
Sélectionnez dans le dropdown: **SELECT**

**Champ: Target roles (Rôles cibles)**
```
authenticated
```
⚠️ Tapez exactement: `authenticated` (pas "public")

**Champ: USING expression (Condition pour lire)**
```sql
bucket_id = 'shipping-documents'
```

**💡 Explication:**
- Cette policy permet aux utilisateurs connectés de VOIR les fichiers
- Condition: seulement si le fichier est dans ce bucket

#### **6.3 Sauvegarder**
1. Cliquez sur **"Review"** (si disponible)
2. Puis cliquez sur **"Save policy"**
3. ✅ La policy apparaît dans la liste

---

### Étape 7: Créer la Policy INSERT (Uploader des fichiers)

#### **7.1 Démarrer**
1. Cliquez à nouveau sur **"New policy"**
2. Choisissez: **"For full customization"**

#### **7.2 Remplir le formulaire INSERT**

**Policy name:**
```
Authenticated users can upload shipping documents
```

**Policy command:**
```
INSERT
```

**Target roles:**
```
authenticated
```

**WITH CHECK expression:**
```sql
bucket_id = 'shipping-documents'
```

**💡 Explication:**
- Cette policy permet aux utilisateurs connectés d'UPLOADER des fichiers
- Condition: dans ce bucket uniquement

#### **7.3 Sauvegarder**
Cliquez sur **"Save policy"**

---

### Étape 8: Créer la Policy UPDATE (Modifier les fichiers)

#### **8.1 Démarrer**
1. Cliquez sur **"New policy"**
2. **"For full customization"**

#### **8.2 Remplir le formulaire UPDATE**

**Policy name:**
```
Users can update their own shipping documents
```

**Policy command:**
```
UPDATE
```

**Target roles:**
```
authenticated
```

**USING expression:**
```sql
bucket_id = 'shipping-documents' AND auth.uid() = owner
```

**WITH CHECK expression:**
```sql
bucket_id = 'shipping-documents' AND auth.uid() = owner
```

**💡 Explication:**
- Cette policy permet aux utilisateurs de MODIFIER leurs propres fichiers
- Condition: ils doivent être propriétaires du fichier (owner)

#### **8.3 Sauvegarder**
Cliquez sur **"Save policy"**

---

### Étape 9: Créer la Policy DELETE (Supprimer les fichiers)

#### **9.1 Démarrer**
1. Cliquez sur **"New policy"**
2. **"For full customization"**

#### **9.2 Remplir le formulaire DELETE**

**Policy name:**
```
Users can delete their own shipping documents
```

**Policy command:**
```
DELETE
```

**Target roles:**
```
authenticated
```

**USING expression:**
```sql
bucket_id = 'shipping-documents' AND auth.uid() = owner
```

**💡 Explication:**
- Cette policy permet aux utilisateurs de SUPPRIMER leurs propres fichiers
- Condition: ils doivent être propriétaires du fichier

#### **9.3 Sauvegarder**
Cliquez sur **"Save policy"**

---

## ✅ PARTIE 3: VÉRIFICATION

### Étape 10: Vérifier les Policies Créées

Dans la page "Policies for shipping-documents", vous devriez voir **4 policies:**

1. ✅ **SELECT:** "Authenticated users can view shipping documents"
2. ✅ **INSERT:** "Authenticated users can upload shipping documents"
3. ✅ **UPDATE:** "Users can update their own shipping documents"
4. ✅ **DELETE:** "Users can delete their own shipping documents"

**📸 Chaque policy affiche:**
- Nom de la policy
- Commande (SELECT, INSERT, UPDATE, DELETE)
- Rôles cibles (authenticated)
- Expression SQL
- Statut: Enabled (activée)

---

### Étape 11: Tester le Bucket (Optionnel)

1. Retournez à la page **Storage**
2. Cliquez sur le bucket **"shipping-documents"**
3. Vous devriez voir un espace vide (0 fichiers)
4. Essayez de cliquer sur **"Upload file"**
5. Sélectionnez un fichier PDF ou image de test
6. Si l'upload réussit ✅ = Bucket configuré correctement!

---

## 📊 PARTIE 4: VÉRIFICATION SQL (Pour les Experts)

### Étape 12: Vérifier via SQL Editor (Optionnel)

1. Allez dans **SQL Editor** (menu de gauche)
2. Cliquez sur **"New query"**
3. Copiez et exécutez cette requête:

```sql
-- Vérifier que le bucket existe
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'shipping-documents';
```

**✅ Résultat attendu:**
```
id: shipping-documents
name: shipping-documents
public: false
file_size_limit: 20971520
allowed_mime_types: {application/pdf, image/jpeg, image/jpg, image/png, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document}
```

4. Ensuite, vérifiez les policies:

```sql
-- Vérifier les policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd,
  permissive,
  roles
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%shipping documents%'
ORDER BY policyname;
```

**✅ Résultat attendu: 4 lignes**
- Authenticated users can view shipping documents (SELECT)
- Authenticated users can upload shipping documents (INSERT)
- Users can update their own shipping documents (UPDATE)
- Users can delete their own shipping documents (DELETE)

---

## 🎯 RÉCAPITULATIF DES CONFIGURATIONS

### Configuration du Bucket
| Paramètre | Valeur |
|-----------|--------|
| Nom | `shipping-documents` |
| Public | `false` (Non) |
| Taille limite | `20 MB` (20971520 bytes) |
| Types MIME | PDF, JPEG, JPG, PNG, DOC, DOCX |

### Policies Créées
| # | Nom | Commande | Rôles | Condition |
|---|-----|----------|-------|-----------|
| 1 | Authenticated users can view shipping documents | SELECT | authenticated | bucket_id = 'shipping-documents' |
| 2 | Authenticated users can upload shipping documents | INSERT | authenticated | bucket_id = 'shipping-documents' |
| 3 | Users can update their own shipping documents | UPDATE | authenticated | bucket_id = 'shipping-documents' AND auth.uid() = owner |
| 4 | Users can delete their own shipping documents | DELETE | authenticated | bucket_id = 'shipping-documents' AND auth.uid() = owner |

---

## 🚨 PROBLÈMES COURANTS ET SOLUTIONS

### Problème 1: "Bucket name already exists"
**Solution:** Le bucket existe déjà. Vérifiez dans la liste Storage.

### Problème 2: "Invalid MIME type"
**Solution:** Vérifiez l'orthographe exacte des types MIME (copiez-collez depuis ce guide).

### Problème 3: "Policy already exists"
**Solution:** 
1. Allez dans les Policies du bucket
2. Supprimez la policy existante
3. Recréez-la avec les bons paramètres

### Problème 4: "Cannot upload file"
**Solution:** Vérifiez que les 4 policies sont créées et activées (Enabled).

### Problème 5: "Access denied"
**Solution:** Vérifiez que l'utilisateur est bien authentifié dans votre application.

---

## ✅ CHECKLIST FINALE

Avant de terminer, vérifiez:

- [ ] ✅ Le bucket `shipping-documents` apparaît dans la liste Storage
- [ ] ✅ Le bucket est marqué comme "Private" (Privé)
- [ ] ✅ La taille limite est de 20MB
- [ ] ✅ Les types MIME incluent PDF, JPEG, PNG, DOC, DOCX
- [ ] ✅ La policy SELECT existe et est activée
- [ ] ✅ La policy INSERT existe et est activée
- [ ] ✅ La policy UPDATE existe et est activée
- [ ] ✅ La policy DELETE existe et est activée
- [ ] ✅ Test d'upload réussi (optionnel)

---

## 🎉 FÉLICITATIONS!

Vous avez créé avec succès le bucket `shipping-documents` avec toutes les policies de sécurité nécessaires!

**Ce que vous pouvez faire maintenant:**
1. ✅ Les utilisateurs peuvent uploader des documents d'expédition
2. ✅ Les listes de colisage peuvent être stockées
3. ✅ Les certificats douaniers peuvent être attachés
4. ✅ Le workflow d'expédition est complet

**Prochaines étapes:**
1. Retournez à votre application Gold Shipper
2. Allez dans la section Shipping/Expédition
3. Testez l'upload de documents
4. Vérifiez que les documents apparaissent correctement

---

## 📞 SUPPORT

Si vous rencontrez des problèmes:

1. **Vérifiez les logs Supabase:**
   - Menu: Logs
   - Filtrez par: Storage

2. **Consultez la documentation:**
   - https://supabase.com/docs/guides/storage

3. **Vérifiez les permissions:**
   - Menu: Authentication > Policies
   - Assurez-vous que l'utilisateur est authentifié

---

**Guide créé le:** 2025-11-10
**Version:** 1.0
**Auteur:** Gold Shipper DevOps Team
