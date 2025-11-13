# 🔧 CORRECTION RAPIDE - MODULE FREIGHT & CUSTOMS

## ✅ Problème Résolu: Route "Nouvelle Opération"

La page de création d'opération a été créée et la route ajoutée.

### Fichiers Créés/Modifiés:

1. **src/pages/freight/FreightCustomsCreate.tsx** (NOUVEAU)
   - Page complète de création d'opération
   - Sélection des expéditions "Expédié"
   - Aperçu des détails de l'expédition
   - Validation et création

2. **src/App.tsx** (MODIFIÉ)
   - Ajout de la route `/freight-customs/create`
   - Import du nouveau composant

### ✅ Build Réussi: 32.63s

---

## ⚠️ ÉTAPE OBLIGATOIRE: Appliquer la Migration

Les erreurs Supabase que vous voyez sont normales car les tables n'existent pas encore.

### SOLUTION: Exécuter la Migration SQL

**Étape 1:** Ouvrir Supabase Dashboard
- https://supabase.com/dashboard
- Sélectionner votre projet

**Étape 2:** SQL Editor
- Naviguer vers: **SQL Editor** → **New Query**

**Étape 3:** Copier et Exécuter
```bash
# Copier le contenu de ce fichier:
supabase/migrations/20251113_020_create_freight_customs_module.sql
```

**Étape 4:** Vérifier
```sql
-- Vérifier que les tables sont créées
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'freight_customs%';
```

Résultat attendu: 3 tables
- freight_customs_operations
- freight_customs_documents
- freight_customs_invoice_data

---

## 🪣 ÉTAPE 2: Créer le Storage Bucket

**Dans Supabase Dashboard → Storage → SQL Editor:**

```sql
-- Créer le bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('freight-customs-documents', 'freight-customs-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Politiques d'accès
CREATE POLICY "Authenticated users can upload freight documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'freight-customs-documents');

CREATE POLICY "Authenticated users can view freight documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'freight-customs-documents');

CREATE POLICY "Authenticated users can delete freight documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'freight-customs-documents');
```

---

## 🎯 APRÈS LA MIGRATION

Une fois la migration appliquée, le module fonctionnera complètement:

1. ✅ Dashboard avec liste des opérations
2. ✅ Création de nouvelle opération depuis expéditions "Expédié"
3. ✅ Détails de l'opération
4. ✅ Upload de documents
5. ✅ Changement de statut
6. ✅ Génération de factures (Bullion Summary + Export Invoice)

---

## 📝 WORKFLOW COMPLET

### 1. Créer une Opération
- Cliquer sur "Nouvelle Opération"
- Sélectionner une expédition avec statut "Expédié"
- Ajouter des notes (optionnel)
- Créer → Référence FC-YYYYMMDD-XXXX générée

### 2. Gérer les Documents
- Upload déclaration douanière
- Upload documents de transport
- Visualiser les PDFs inline

### 3. Changer les Statuts
- **customs_pending** → En attente douane
- **customs_approved** → Approuvé (+ date + référence)
- **ready_for_transport** → Prêt transport (+ transitaire)
- **shipped_to_refinery** → Expédié (+ AWB)

### 4. Générer les Factures
- Bullion Summary (tableau détaillé)
- Export Invoice (format douane)
- Upload automatique après génération

---

## 🚨 IMPORTANT

**Ne PAS utiliser le module avant d'appliquer la migration!**

Les erreurs Supabase disparaîtront une fois les tables créées.

---

Pour plus de détails, consulter:
- FREIGHT_CUSTOMS_DEPLOYMENT.md (guide complet)
- FREIGHT_CUSTOMS_COMPLETE.md (documentation technique)
