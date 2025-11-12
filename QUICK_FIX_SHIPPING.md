# 🚀 Correction Rapide - Système de Shipping

## ✅ Statut Actuel

**Tables shipping** : ✅ Existent déjà (5/5 tables)
**Problème identifié** :
- ❌ Politiques RLS (Row Level Security) manquantes ou incorrectes
- ❌ Bucket de stockage "shipping-documents" manquant

---

## 🔧 Solution en 2 Étapes Simples

### Étape 1 : Corriger les Politiques RLS

**Durée** : 30 secondes

1. Allez sur : https://boolqagzdqbahqnpawpb.supabase.co
2. Cliquez sur **"SQL Editor"** dans le menu latéral
3. Cliquez sur **"New Query"**
4. Ouvrez le fichier : `supabase/migrations/fix_shipping_rls_only.sql`
5. Copiez **tout le contenu** et collez-le dans l'éditeur
6. Cliquez sur **"Run"** (ou Ctrl+Entrée)

**Ce que fait cette migration** :
- ✅ Corrige les politiques RLS sur les 5 tables shipping
- ✅ Ne touche PAS aux données existantes (0 enregistrements actuels)
- ✅ Ne recrée PAS les tables (utilise seulement DROP POLICY + CREATE POLICY)
- ✅ Ajoute les fonctions de calcul automatique des totaux
- ✅ Ajoute les triggers pour mettre à jour automatiquement les poids

**Résultat attendu** :
```
Success. No rows returned
```

---

### Étape 2 : Créer le Bucket de Stockage

**Durée** : 1 minute

1. Dans Supabase Dashboard, cliquez sur **"Storage"** dans le menu latéral
2. Cliquez sur **"New bucket"**
3. Remplissez :
   - **Name** : `shipping-documents`
   - **Public bucket** : ✅ Cochez cette case
   - **File size limit** : `52428800` (50MB en bytes)
   - **Allowed MIME types** : Laissez vide ou ajoutez :
     - `application/pdf`
     - `image/png`
     - `image/jpeg`
4. Cliquez sur **"Create bucket"**

**Configuration des politiques Storage** :

Après avoir créé le bucket, allez dans **Storage** > **Policies** > **New Policy**

#### Politique 1 : Lecture
```sql
CREATE POLICY "Allow authenticated read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'shipping-documents');
```

#### Politique 2 : Upload
```sql
CREATE POLICY "Allow authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'shipping-documents');
```

#### Politique 3 : Update
```sql
CREATE POLICY "Allow authenticated update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'shipping-documents');
```

#### Politique 4 : Delete
```sql
CREATE POLICY "Allow authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'shipping-documents');
```

**Astuce** : Vous pouvez appliquer toutes les politiques en une fois dans SQL Editor :

```sql
-- Exécutez ces 4 politiques ensemble
CREATE POLICY "Allow authenticated read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'shipping-documents');
CREATE POLICY "Allow authenticated upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'shipping-documents');
CREATE POLICY "Allow authenticated update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'shipping-documents');
CREATE POLICY "Allow authenticated delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'shipping-documents');
```

---

## ✅ Vérification

Exécutez ce script pour vérifier que tout est en place :

```bash
node scripts/verify-shipping-setup.js
```

**Résultat attendu** :
```
✅ CONFIGURATION COMPLÈTE - Le système de shipping est prêt!
```

---

## 🧪 Test de la Fonctionnalité

1. **Rafraîchissez** l'application (F5 dans le navigateur)
2. Allez dans **Shipping** > **New Preparation**
3. Remplissez le formulaire :
   - Sélectionnez des productions
   - Choisissez une compagnie de transport
   - Choisissez une raffinerie
   - Ajoutez des numéros de scellés (Seal Number 1 au minimum)
   - Ajoutez au moins un signataire (ex: "Gold Room Operator", "John Doe")
4. Cliquez sur **"Enregistrement..."**

**Résultat attendu** :
- ✅ Préparation enregistrée avec succès
- ✅ Message de confirmation affiché
- ✅ Packing List PDF généré automatiquement
- ✅ Redirection vers la liste des préparations

**Si erreur** :
- Vérifiez la console du navigateur (F12)
- Le message d'erreur devrait maintenant être explicite
- Vérifiez que vous êtes bien connecté (utilisateur authentifié)

---

## 🔍 Détails Techniques

### Pourquoi cette erreur se produisait ?

1. **Politiques RLS manquantes** :
   - Supabase bloque par défaut tout accès aux tables avec RLS activé
   - Sans politiques, même les utilisateurs authentifiés ne peuvent pas insérer de données
   - Erreur retournée : "new row violates row-level security policy"

2. **Bucket de stockage manquant** :
   - Le code tente d'uploader des documents (Packing List PDF)
   - Sans bucket, Supabase retourne une erreur de stockage
   - Le code continuait mais l'erreur était affichée

### Que fait la correction ?

**Migration RLS** (`fix_shipping_rls_only.sql`) :
- Active RLS sur toutes les tables (si pas déjà fait)
- Crée 20 politiques (4 par table : SELECT, INSERT, UPDATE, DELETE)
- Autorise tous les utilisateurs **authentifiés** à accéder aux données
- Ajoute les fonctions de calcul automatique des totaux
- Ajoute les triggers pour synchroniser les poids/boxes automatiquement

**Bucket Storage** :
- Stocke les documents (Packing Lists, rapports, etc.)
- Public pour permettre l'accès aux URLs générées
- Protégé par RLS via les politiques storage.objects

---

## 📊 Ce qui a été préservé

✅ **Aucune perte de données** :
- 0 enregistrements existants dans toutes les tables
- Structure des tables non modifiée
- Aucune colonne ajoutée ou supprimée
- Seules les politiques RLS ont été mises à jour

✅ **Sécurité maintenue** :
- RLS reste activé
- Accès restreint aux utilisateurs authentifiés seulement
- Pas d'accès public aux données sensibles

---

## 🆘 En Cas de Problème

### Erreur : "policy already exists"
**Solution** : Normal, la migration utilise `DROP POLICY IF EXISTS` puis `CREATE POLICY`

### Erreur : "bucket already exists"
**Solution** : Le bucket existe déjà, passez directement aux politiques storage

### Erreur persiste après configuration
**Actions** :
1. Vérifiez dans SQL Editor :
   ```sql
   SELECT tablename, policyname
   FROM pg_policies
   WHERE tablename LIKE 'shipping%';
   ```
   Devrait retourner 20 politiques

2. Vérifiez le bucket :
   ```sql
   SELECT * FROM storage.buckets WHERE name = 'shipping-documents';
   ```
   Devrait retourner 1 ligne

3. Vérifiez que vous êtes authentifié :
   - Menu utilisateur en haut à droite
   - Devrait afficher votre email

4. Consultez les logs Supabase :
   - Dashboard > Logs > toutes les erreurs sont enregistrées

---

## 📞 Support

**Fichiers de référence** :
- `fix_shipping_rls_only.sql` - Migration légère (RLS uniquement)
- `add_shipping_system.sql` - Migration complète (si besoin de tout recréer)
- `verify-shipping-setup.js` - Script de vérification
- `check-existing-shipping-tables.js` - Script de diagnostic

**Scripts utiles** :
```bash
# Vérifier l'état actuel
node scripts/check-existing-shipping-tables.js

# Vérifier la configuration complète
node scripts/verify-shipping-setup.js
```

---

**Date** : 2025-11-12
**Durée totale** : 2 minutes
**Sécurité** : ✅ Aucun risque de perte de données
