# 🔄 Guide de Migration - Assay Certificates vers Shipping Preparations

## 📋 Vue d'ensemble

Ce guide explique comment migrer le module **Assay Certificates** pour qu'il soit lié aux **Shipping Preparations** plutôt qu'aux **Batches**.

---

## 🎯 Objectifs de la Migration

1. ✅ Remplacer `batch_id` par `shipping_preparation_id`
2. ✅ Déplacer le module vers le groupe **Document Management**
3. ✅ Intégrer l'upload de certificats dans les détails d'expédition
4. ✅ Permettre la visualisation des certificats depuis n'importe où

---

## 📝 Modifications Effectuées

### 1. Migration SQL
**Fichier** : `supabase/migrations/migrate_assay_certificates_to_shipping.sql`

**Actions** :
- ✅ Ajout colonne `shipping_preparation_id`
- ✅ Création foreign key vers `shipping_preparations`
- ✅ Création index pour performance
- ✅ Mise à jour RLS policies
- ✅ Création vue `assay_certificates_with_shipping`
- ✅ Création fonctions RPC :
  - `get_shipping_assay_certificates(p_shipping_id)`
  - `count_shipping_certificates(p_shipping_id)`

### 2. Service TypeScript
**Fichier** : `src/services/assayCertificateService.ts`

**Modifications** :
- ✅ Interface `AssayCertificate` : `batch_id` → `shipping_preparation_id`
- ✅ Interface `AssayCertificateData` : `batch_id` → `shipping_preparation_id`
- ✅ Fonction `uploadAssayCertificate()` : prend `shippingPreparationId`
- ✅ Fonction `getBatchCertificates()` → `getShippingCertificates()`
- ✅ Nouvelle fonction `getAllCertificatesWithShipping()`

### 3. Pages & Composants
**Fichiers créés/modifiés** :
- ✅ `src/pages/documents/AssayCertificatesPage.tsx` (nouvelle page)
- ✅ `src/components/shipping/AssayCertificateUploadForShipping.tsx` (nouveau composant)
- ✅ `src/components/layout/AccordionSidebar.tsx` (nouveau groupe menu)
- ✅ `src/App.tsx` (route mise à jour)

### 4. Navigation
**Changements** :
- ✅ Nouveau groupe de menu : **Document Management**
- ✅ Sous-menu : **Assay Certificates**
- ✅ Nouvelle route : `/documents/assay-certificates`

---

## 🚀 Étapes d'Application

### Étape 1 : Appliquer la Migration SQL

1. Ouvrir **Supabase Dashboard** → **SQL Editor**
2. Copier le contenu de `supabase/migrations/migrate_assay_certificates_to_shipping.sql`
3. Coller et cliquer **RUN**
4. ✅ Vérifier qu'il n'y a pas d'erreurs

**Commandes de vérification** :
```sql
-- Vérifier que la colonne existe
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'assay_certificates'
AND column_name = 'shipping_preparation_id';

-- Vérifier la vue
SELECT * FROM assay_certificates_with_shipping LIMIT 1;

-- Tester la fonction RPC
SELECT * FROM get_shipping_assay_certificates('some-shipping-id');
```

### Étape 2 : Créer le Bucket Storage (si nécessaire)

Si le bucket `assay-certificates` n'existe pas encore :

1. **Supabase Dashboard** → **Storage** → **New bucket**
2. **Name** : `assay-certificates`
3. **Public bucket** : ✅ Coché
4. **File size limit** : 10 MB
5. **Create bucket**

**Politiques RLS** :
```sql
-- INSERT policy
CREATE POLICY "Authenticated users can upload certificates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'assay-certificates');

-- SELECT policy
CREATE POLICY "Authenticated users can read certificates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'assay-certificates');

-- DELETE policy
CREATE POLICY "Authenticated users can delete certificates"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'assay-certificates');
```

### Étape 3 : Build et Déployer

```bash
# Build du projet
npm run build

# Vérifier qu'il n'y a pas d'erreurs TypeScript
npm run typecheck
```

---

## 📊 Structure des Données

### Table: `assay_certificates` (après migration)

```sql
{
  id: UUID,
  shipping_preparation_id: UUID,  -- ✅ NOUVEAU (remplace batch_id)
  batch_id: UUID (deprecated),     -- ⚠️ Conservé temporairement
  certificate_number: TEXT,
  certificate_date: DATE,
  issuing_laboratory: TEXT,
  file_path: TEXT,
  file_name: TEXT,
  file_size: BIGINT,
  mime_type: TEXT,
  parsing_status: TEXT,
  approval_status: TEXT,
  uploaded_by: UUID,
  created_at: TIMESTAMPTZ
}
```

### Vue: `assay_certificates_with_shipping`

```sql
SELECT
  ac.*,
  sp.preparation_number,
  sp.status as shipping_status,
  sp.total_weight_grams,
  mc.name as mining_company_name,
  mc.country as mining_company_country
FROM assay_certificates ac
LEFT JOIN shipping_preparations sp ON ac.shipping_preparation_id = sp.id
LEFT JOIN mining_companies mc ON sp.mining_company_id = mc.id
```

---

## 🔄 Workflow d'Utilisation

### 1. Upload de Certificat depuis Expédition

```
Shipping Preparation Details
  ↓
Section "Documents"
  ↓
Bouton "Upload Assay Certificate"
  ↓
Sélection fichier PDF
  ↓
Upload automatique vers shipping_preparation_id
  ↓
Parsing automatique du PDF
  ↓
✅ Certificat disponible partout
```

### 2. Visualisation depuis Document Management

```
Menu → Document Management → Assay Certificates
  ↓
Liste toutes les expéditions
  ↓
Cliquer pour expand une expédition
  ↓
Voir tous les certificats de cette expédition
  ↓
Cliquer "View" pour voir détails
  ↓
Approval/Rejection du certificat
```

---

## 🧪 Tests à Effectuer

### Test 1 : Menu Navigation
- [ ] Vérifier groupe **Document Management** visible
- [ ] Cliquer sur **Assay Certificates**
- [ ] Page charge sans erreur

### Test 2 : Page Assay Certificates
- [ ] Liste des expéditions s'affiche
- [ ] Compteurs affichent les bonnes valeurs
- [ ] Recherche fonctionne
- [ ] Filtres fonctionnent
- [ ] Expand/Collapse expéditions

### Test 3 : Upload depuis Shipping
- [ ] Aller sur une expédition (Shipping Preparation Details)
- [ ] Section "Documents" visible
- [ ] Bouton "Upload Assay Certificate"
- [ ] Upload un PDF
- [ ] ✅ Certificat apparaît dans la liste
- [ ] ✅ Parsing automatique démarre

### Test 4 : Visualisation Certificat
- [ ] Cliquer "View" sur un certificat
- [ ] Modal s'ouvre avec détails
- [ ] Données parsées visibles
- [ ] Boutons Approve/Reject fonctionnent

---

## 🔍 Dépannage

### Erreur : "shipping_preparation_id cannot be null"
**Solution** : La migration SQL n'a pas été appliquée. Appliquer la migration.

### Erreur : "Function get_shipping_assay_certificates does not exist"
**Solution** : La fonction RPC n'a pas été créée. Vérifier la migration SQL.

### Erreur : "Bucket assay-certificates not found"
**Solution** : Créer le bucket dans Supabase Storage (voir Étape 2).

### Certificats n'apparaissent pas
**Solution** :
1. Vérifier que `shipping_preparation_id` est renseigné
2. Vérifier les politiques RLS
3. Vérifier la console browser pour erreurs

---

## 📊 Impact de la Migration

### Avant ❌
- Certificats liés aux **batches**
- Visibles seulement dans Batch Details
- Module dans groupe "Shipping Management"
- Difficile à retrouver

### Après ✅
- Certificats liés aux **expéditions**
- Visibles depuis n'importe où
- Module dans groupe **Document Management**
- Navigation intuitive
- Upload centralisé dans Shipping Preparation

---

## 📁 Fichiers Modifiés/Créés

### Migrations SQL
- ✅ `supabase/migrations/migrate_assay_certificates_to_shipping.sql`

### Services
- ✅ `src/services/assayCertificateService.ts`

### Pages
- ✅ `src/pages/documents/AssayCertificatesPage.tsx` (nouvelle)

### Composants
- ✅ `src/components/shipping/AssayCertificateUploadForShipping.tsx` (nouveau)
- ✅ `src/components/layout/AccordionSidebar.tsx`

### Configuration
- ✅ `src/App.tsx`

---

## ✅ Checklist Post-Migration

- [ ] Migration SQL appliquée sans erreurs
- [ ] Bucket storage créé et configuré
- [ ] Politiques RLS configurées
- [ ] Application build sans erreurs
- [ ] Menu "Document Management" visible
- [ ] Page Assay Certificates accessible
- [ ] Upload depuis Shipping fonctionne
- [ ] Parsing automatique fonctionne
- [ ] Visualisation certificats fonctionne
- [ ] Approval workflow fonctionne

---

## 🎯 Résultat Final

Le module **Assay Certificates** est maintenant :

1. ✅ Lié aux **Shipping Preparations** (pas aux batches)
2. ✅ Dans le groupe **Document Management** du menu
3. ✅ Accessible depuis `/documents/assay-certificates`
4. ✅ Uploadable depuis Shipping Preparation Details
5. ✅ Visible et gérable depuis n'importe où

---

## 📞 Support

En cas de problème :
1. Vérifier les erreurs dans la console browser
2. Vérifier les logs Supabase
3. Vérifier que toutes les migrations sont appliquées
4. Vérifier que les politiques RLS sont correctes

---

**Date de création** : 12 Novembre 2025
**Version** : 1.0
**Statut** : ✅ Prêt pour production
