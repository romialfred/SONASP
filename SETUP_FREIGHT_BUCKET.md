# 📦 CONFIGURATION DU BUCKET FREIGHT & CUSTOMS

## Contexte

Pour que le module Freight & Customs fonctionne complètement, vous devez créer le bucket de stockage pour les documents (déclarations douanières, documents de transport, factures générées).

## ✅ Migration Déjà Appliquée

La migration `20251113_020_create_freight_customs_module.sql` a déjà été appliquée avec succès, donc les tables existent.

## ⚠️ Action Requise: Créer le Storage Bucket

### Option 1: Via SQL Editor (RECOMMANDÉ)

1. **Ouvrir Supabase Dashboard**
   - https://supabase.com/dashboard
   - Sélectionner votre projet

2. **Ouvrir SQL Editor**
   - Menu de gauche → SQL Editor
   - Cliquer "New Query"

3. **Copier et Exécuter ce SQL:**

```sql
-- Créer le bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'freight-customs-documents',
  'freight-customs-documents',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Politiques RLS
CREATE POLICY IF NOT EXISTS "Authenticated users can upload freight documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'freight-customs-documents');

CREATE POLICY IF NOT EXISTS "Authenticated users can view freight documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'freight-customs-documents');

CREATE POLICY IF NOT EXISTS "Authenticated users can update freight documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'freight-customs-documents');

CREATE POLICY IF NOT EXISTS "Authenticated users can delete freight documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'freight-customs-documents');
```

4. **Exécuter** (bouton Run ou Ctrl+Enter)

### Option 2: Via Interface Supabase Storage

1. **Aller dans Storage**
   - Menu de gauche → Storage

2. **Créer un nouveau bucket**
   - Cliquer "Create a new bucket"
   - **Name:** `freight-customs-documents`
   - **Public:** Décocher (Private)
   - **File size limit:** 50 MB
   - **Allowed MIME types:** 
     - application/pdf
     - image/jpeg
     - image/png
     - image/jpg

3. **Configurer les Politiques**
   - Cliquer sur le bucket créé → Policies
   - Exécuter le SQL des politiques ci-dessus

---

## 🔍 Vérification

Après création, vérifier avec ce SQL:

```sql
-- Vérifier le bucket
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'freight-customs-documents';

-- Vérifier les politiques
SELECT
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%freight%'
ORDER BY policyname;
```

**Résultat attendu:**
- 1 bucket: `freight-customs-documents`
- 4 politiques: INSERT, SELECT, UPDATE, DELETE

---

## 🎯 Après Configuration

Une fois le bucket créé, le module sera **100% fonctionnel:**

### ✅ Fonctionnalités Disponibles

1. **Dashboard Freight & Customs**
   - Liste de toutes les opérations
   - Filtres par statut
   - Statistiques en temps réel

2. **Créer une Opération**
   - Sélection d'expédition "Expédié"
   - Génération auto de référence FC-YYYYMMDD-XXXX
   - Statut initial: "En Attente Douane"

3. **Gestion des Documents**
   - Upload de PDFs (déclarations, documents transport)
   - Visualisation inline des documents
   - Suppression de documents
   - Types supportés: PDF, JPEG, PNG

4. **Workflow de Statuts**
   - ⏳ En Attente Douane (customs_pending)
   - ✅ Approuvé Douane (customs_approved)
   - 🚚 Prêt Transport (ready_for_transport)
   - ✈️ Expédié Raffinerie (shipped_to_refinery)

5. **Génération de Factures**
   - **Bullion Summary:** Tableau détaillé des lingots
   - **Export Invoice:** Format douanier
   - Upload automatique après génération

---

## 🚫 Avant Configuration

**Sans le bucket, vous verrez des erreurs:**
- ❌ Upload de documents échoue
- ❌ Visualisation de documents impossible
- ❌ Génération de factures échoue (pas de stockage)

**Ces erreurs disparaîtront immédiatement après création du bucket.**

---

## 📚 Fichiers de Référence

- **SQL complet:** `scripts/create-freight-bucket.sql`
- **Script Node.js:** `scripts/create-freight-bucket.js` (informatif uniquement)
- **Documentation:** `FREIGHT_CUSTOMS_COMPLETE.md`

---

## ⏱️ Temps Estimé

**2-3 minutes** pour créer le bucket via SQL Editor

---

## 💡 Note Technique

Le bucket doit être **private** (non public) pour des raisons de sécurité. L'accès est contrôlé par les politiques RLS qui vérifient que l'utilisateur est authentifié.

Les documents sont accessibles uniquement aux utilisateurs connectés de l'application.
