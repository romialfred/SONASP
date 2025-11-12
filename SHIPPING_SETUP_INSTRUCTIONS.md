# 🚢 Instructions de Configuration du Système d'Expédition

## ❌ Problème Identifié

L'erreur "Erreur inconnue" lors de l'enregistrement d'une préparation d'expédition est causée par:

1. **Tables de base de données manquantes** - Les tables `shipping_preparations`, `shipping_production_items`, `shipping_signatories`, `shipping_ingots`, et `shipping_documents` n'existent pas dans la base de données
2. **Bucket de stockage manquant** - Le bucket `shipping-documents` n'existe pas dans Supabase Storage

## ✅ Solution - Configuration en 2 Étapes

### Étape 1: Créer les Tables de Base de Données

#### Option A: Via SQL Editor (Recommandé)

1. **Accéder au Dashboard Supabase**
   - URL: https://boolqagzdqbahqnpawpb.supabase.co
   - Connectez-vous avec vos identifiants

2. **Ouvrir l'Éditeur SQL**
   - Dans le menu latéral gauche, cliquez sur **"SQL Editor"**
   - Cliquez sur **"New Query"**

3. **Exécuter la Migration**
   - Ouvrez le fichier: `supabase/migrations/add_shipping_system.sql`
   - Copiez **tout le contenu** du fichier
   - Collez-le dans l'éditeur SQL
   - Cliquez sur **"Run"** (ou appuyez sur Ctrl+Entrée)

4. **Vérifier la Création**
   - Allez dans **"Table Editor"**
   - Vérifiez que les tables suivantes existent:
     - ✅ shipping_preparations
     - ✅ shipping_production_items
     - ✅ shipping_signatories
     - ✅ shipping_ingots
     - ✅ shipping_documents

#### Option B: Via Script Node.js (Alternatif)

```bash
cd /tmp/cc-agent/59164212/project
node scripts/apply-shipping-migration.js
```

**Note**: Cette option nécessite une clé de service Supabase avec privilèges d'administration.

---

### Étape 2: Créer le Bucket de Stockage

1. **Accéder à la Section Storage**
   - Dans le Dashboard Supabase, cliquez sur **"Storage"** dans le menu latéral

2. **Créer un Nouveau Bucket**
   - Cliquez sur **"New bucket"**
   - **Nom**: `shipping-documents`
   - **Public bucket**: ✅ Cochez cette option
   - **File size limit**: 50MB (52428800 bytes)
   - **Allowed MIME types**:
     - `application/pdf`
     - `image/png`
     - `image/jpeg`
     - `application/msword`
     - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

3. **Configurer les Politiques RLS (Row Level Security)**

   Après avoir créé le bucket, configurez les politiques d'accès:

   #### Politique 1: Lecture (SELECT)
   ```sql
   CREATE POLICY "Allow authenticated users to read shipping documents"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (bucket_id = 'shipping-documents');
   ```

   #### Politique 2: Téléchargement (INSERT)
   ```sql
   CREATE POLICY "Allow authenticated users to upload shipping documents"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'shipping-documents' AND auth.uid() IS NOT NULL);
   ```

   #### Politique 3: Mise à jour (UPDATE)
   ```sql
   CREATE POLICY "Allow users to update their own shipping documents"
   ON storage.objects FOR UPDATE
   TO authenticated
   USING (
     bucket_id = 'shipping-documents' AND
     auth.uid()::text = (storage.foldername(name))[1]
   );
   ```

   #### Politique 4: Suppression (DELETE)
   ```sql
   CREATE POLICY "Allow users to delete their own shipping documents"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (
     bucket_id = 'shipping-documents' AND
     auth.uid()::text = (storage.foldername(name))[1]
   );
   ```

   **Comment appliquer ces politiques**:
   - Allez dans **Storage** > **Policies** > **New Policy**
   - Copiez-collez chaque politique SQL ci-dessus
   - Cliquez sur **"Review"** puis **"Save policy"**

---

## 🧪 Vérification de la Configuration

### 1. Vérifier les Tables

Exécutez cette requête dans SQL Editor:

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'shipping%';
```

**Résultat attendu**: 5 tables listées

### 2. Vérifier le Bucket

```sql
SELECT * FROM storage.buckets WHERE name = 'shipping-documents';
```

**Résultat attendu**: 1 ligne avec le bucket `shipping-documents`

### 3. Vérifier les Politiques RLS

```sql
SELECT tablename, policyname
FROM pg_policies
WHERE tablename LIKE 'shipping%';
```

**Résultat attendu**: Plusieurs politiques (minimum 4 par table)

---

## 📋 Structure des Tables Créées

### 1. **shipping_preparations**
Table principale pour les préparations d'expédition

**Colonnes clés**:
- `id` (UUID) - Identifiant unique
- `expedition_lot_number` (TEXT) - Numéro de lot d'expédition (unique)
- `status` (TEXT) - Statut: 'pending', 'prepared', 'shipped'
- `shipped_to_company` (TEXT) - Compagnie de transport
- `shipped_to_address` (TEXT) - Raffinerie de destination
- `total_net_weight_grams` (DECIMAL) - Poids net total
- `total_boxes` (INTEGER) - Nombre total de boîtes

### 2. **shipping_production_items**
Éléments de production associés à chaque expédition

**Colonnes clés**:
- `shipping_preparation_id` (UUID) - Lien vers la préparation
- `daily_production_id` (UUID) - Lien vers la production quotidienne
- `ingot_box_number` (TEXT) - Numéro de boîte/lingot
- `seal_number_1`, `seal_number_2` (TEXT) - Numéros de scellés
- `net_weight_grams`, `gross_weight_grams` (DECIMAL) - Poids

### 3. **shipping_signatories**
Signataires des documents d'expédition

**Colonnes clés**:
- `shipping_preparation_id` (UUID) - Lien vers la préparation
- `position` (TEXT) - Poste du signataire
- `name` (TEXT) - Nom du signataire
- `order_index` (INTEGER) - Ordre d'affichage

### 4. **shipping_ingots**
Informations détaillées sur les lingots

### 5. **shipping_documents**
Documents de support (packing lists, rapports, etc.)

**Colonnes clés**:
- `shipping_preparation_id` (UUID) - Lien vers la préparation
- `title` (TEXT) - Titre du document
- `document_url` (TEXT) - URL du document dans Storage
- `file_name`, `file_size`, `mime_type` - Métadonnées du fichier

---

## 🚀 Test de la Fonctionnalité

Après avoir complété les deux étapes:

1. **Rafraîchir l'application** (F5 dans le navigateur)
2. **Aller dans** Shipping > New Preparation
3. **Remplir le formulaire**:
   - Sélectionner des productions
   - Choisir une compagnie de transport
   - Choisir une raffinerie
   - Ajouter des numéros de scellés
   - Ajouter des signataires
4. **Cliquer sur "Enregistrement..."**

**Résultat attendu**:
- ✅ Préparation enregistrée avec succès
- ✅ Packing List PDF généré automatiquement
- ✅ Documents téléchargés correctement
- ✅ Aucune erreur affichée

---

## 🔧 Dépannage

### Erreur: "relation does not exist"
**Cause**: Tables non créées
**Solution**: Appliquez l'Étape 1 ci-dessus

### Erreur: "bucket does not exist"
**Cause**: Bucket de stockage non créé
**Solution**: Appliquez l'Étape 2 ci-dessus

### Erreur: "policy violation" ou "RLS"
**Cause**: Politiques RLS manquantes ou incorrectes
**Solution**: Vérifiez et appliquez les 4 politiques de l'Étape 2

### Erreur: "Permission denied"
**Cause**: Politiques RLS trop restrictives
**Solution**: Vérifiez que les politiques utilisent `TO authenticated` et non `TO anon`

---

## 📞 Support

En cas de problème persistant:

1. **Vérifier les logs de la console du navigateur** (F12 > Console)
2. **Vérifier les logs Supabase** (Dashboard > Logs)
3. **Vérifier que l'utilisateur est bien authentifié**
4. **Consulter la documentation Supabase**: https://supabase.com/docs

---

## ✨ Fonctionnalités du Système d'Expédition

Une fois configuré, le système offre:

- ✅ Préparation multi-production (plusieurs barres dans une expédition)
- ✅ Gestion des numéros de scellés (dual seal numbers)
- ✅ Génération automatique de Packing Lists en PDF
- ✅ Upload de documents de support
- ✅ Gestion des signataires avec positions
- ✅ Suivi complet du statut (pending → prepared → shipped)
- ✅ Calcul automatique des totaux (poids, nombre de boîtes)
- ✅ Intégration avec les productions quotidiennes
- ✅ Export PDF haute qualité des packing lists

---

## 📝 Notes Importantes

1. **Sécurité**: Toutes les tables utilisent RLS - seuls les utilisateurs authentifiés peuvent accéder aux données
2. **Performance**: Des index sont créés automatiquement sur les colonnes fréquemment utilisées
3. **Intégrité**: Les clés étrangères assurent la cohérence des données
4. **Automatisation**: Les totaux sont recalculés automatiquement via des triggers PostgreSQL
5. **Traçabilité**: Les timestamps et user IDs sont enregistrés automatiquement

---

**Date de création**: 2025-11-12
**Dernière mise à jour**: 2025-11-12
**Version**: 1.0.0
