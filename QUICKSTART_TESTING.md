# Guide de Test Rapide - Système de Production

## ✅ Corrections Appliquées

Tous les problèmes identifiés ont été corrigés:
- ✅ Erreur "Production introuvable" → Résolu
- ✅ Alertes JavaScript natives → Remplacées par ErrorDialog professionnel
- ✅ Productions sans statut → Protection avec valeur par défaut
- ✅ Build projet → Compile avec succès en 21.52s

## 🚀 Étapes de Mise en Production

### Étape 1: Appliquer les Migrations SQL

Dans **Supabase SQL Editor**, exécutez les deux migrations **dans cet ordre**:

#### A. Migration des Documents
```bash
Fichier: supabase/migrations/add_production_documents.sql
```

Copiez et exécutez tout le contenu du fichier.

✅ **Attendu:**
- Table `production_documents` créée
- Politiques RLS configurées
- Message: "Success. No rows returned"

#### B. Migration des Statuts
```bash
Fichier: supabase/migrations/add_production_status_tracking.sql
```

Copiez et exécutez tout le contenu du fichier.

✅ **Attendu:**
- Type ENUM `production_status` créé
- Colonne `status` ajoutée à `daily_production`
- Table `production_status_history` créée
- Triggers créés
- Message: "Success. No rows returned"

### Étape 2: Initialiser les Productions Existantes

Si vous avez des productions existantes, exécutez:

```sql
-- Initialiser le statut pour les productions existantes
UPDATE daily_production
SET status = 'prepared'
WHERE status IS NULL;

-- Vérifier le résultat
SELECT
  COALESCE(status::text, 'NULL') as statut,
  COUNT(*) as nombre
FROM daily_production
GROUP BY status
ORDER BY status;
```

✅ **Attendu:** Toutes les productions ont maintenant `status = 'prepared'`

### Étape 3: Créer le Bucket Storage (Recommandé)

**Important: Configuration Sécurisée avec PDF Uniquement**

1. Dashboard Supabase → **Storage**
2. Cliquer **"New bucket"**
3. Configuration:
   - **Bucket name**: `production-documents`
   - **Public bucket**: ❌ NON coché (décoché)
   - **Restrict file size**: ✅ OUI coché
     - File size limit: `10` MB
   - **Restrict MIME types**: ✅ OUI coché ← **IMPORTANT!**
     - Allowed MIME types: `application/pdf`
4. Cliquer **"Create bucket"**

**Pourquoi PDF uniquement?**
- ✅ Sécurité maximale (pas d'exécution de code)
- ✅ Format standard pour documents officiels
- ✅ Visualisation universelle dans navigateurs
- ✅ Idéal pour archivage et audit

**Guide détaillé:** Voir `docs/SUPABASE_STORAGE_CONFIGURATION.md`

### Étape 3bis: Créer les Storage Policies (OBLIGATOIRE!)

**⚠️ CRITIQUE:** Le bucket seul ne suffit pas! Sans policies Storage, il sera **inaccessible** (0 policies).

**Création via Interface Supabase (2 minutes):**

1. **Storage** → Cliquer sur `production-documents` → **Policies**
2. Créer **4 policies** avec ces paramètres:

#### Policy 1: SELECT (Voir les fichiers)
```
Name: Authenticated users can view production documents
Operation: SELECT
Target roles: authenticated
USING expression: true
```

#### Policy 2: INSERT (Upload)
```
Name: Authenticated users can upload production documents
Operation: INSERT
Target roles: authenticated
WITH CHECK: true
```

#### Policy 3: UPDATE (Modifier)
```
Name: Authenticated users can update production documents
Operation: UPDATE
Target roles: authenticated
USING: true
WITH CHECK: true
```

#### Policy 4: DELETE (Supprimer)
```
Name: Authenticated users can delete production documents
Operation: DELETE
Target roles: authenticated
USING: true
```

**Vérification:** Bucket doit maintenant montrer **4** dans la colonne POLICIES (pas 0)

**Guide détaillé:** `docs/STORAGE_POLICIES_SETUP.md`

### Étape 4: Vérifier l'Installation

Exécutez ce script de vérification:

```sql
-- 1. Vérifier la colonne status
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'daily_production' AND column_name = 'status';

-- 2. Vérifier les tables
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('production_documents', 'production_status_history');

-- 3. Compter les productions par statut
SELECT
  status::text as statut,
  COUNT(*) as nombre
FROM daily_production
GROUP BY status;

-- 4. Vérifier le bucket storage
SELECT * FROM storage.buckets WHERE name = 'production-documents';
```

✅ **Attendu:**
- Colonne `status` existe avec type `USER-DEFINED`
- Les deux tables existent
- Toutes les productions ont un statut
- Bucket storage existe (ou sera créé automatiquement)

## 🧪 Tests à Effectuer

### Test 1: Voir les Détails d'une Production

#### Scénario:
1. Aller sur `/production/daily`
2. Dans le tableau, cliquer sur l'icône **œil (👁️)** d'une production

#### ✅ Résultat Attendu:
- Page de détails se charge sans erreur
- Badge de statut visible (bleu "Préparé")
- Toutes les sections affichées:
  - Détails de production
  - Workflow de statut
  - Documents attachés
  - Historique des changements

#### ❌ Si Erreur:
- Un ErrorDialog professionnel s'affiche (pas d'alert natif)
- Message clair en français
- Possibilité de fermer et retourner à la liste

### Test 2: Créer une Nouvelle Production

#### Scénario:
1. Sur `/production/daily`
2. Cliquer **"Nouvelle Production"**
3. Remplir le formulaire
4. Soumettre

#### ✅ Résultat Attendu:
- Production créée avec statut "Préparé"
- Badge bleu visible dans le tableau
- Première entrée dans l'historique (création)

### Test 3: Changer le Statut

#### Scénario:
1. Ouvrir les détails d'une production
2. Section "Workflow de Statut"
3. Cliquer **"Passer à: Expédié"**
4. Optionnel: Cliquer **"Ajouter des notes"**
5. Entrer: "Expédition effectuée le [date]"
6. Cliquer **"Confirmer"**

#### ✅ Résultat Attendu:
- Badge passe à orange "Expédié"
- Workflow visuel mis à jour
- Nouvelle entrée dans l'historique avec:
  - Transition Préparé → Expédié
  - Horodatage
  - Email de l'utilisateur
  - Notes si ajoutées

### Test 4: Upload de Document

#### Scénario:
1. Ouvrir les détails d'une production
2. Section "Documents Attachés"
3. Cliquer **"Ajouter"**
4. Modal s'ouvre
5. Entrer nom: "Analyse Journalière"
6. Sélectionner un fichier PDF
7. Cliquer **"Télécharger"**

#### ✅ Résultat Attendu:
- Upload réussi
- Document apparaît dans la liste
- Compteur mis à jour: (1)
- Possibilité de:
  - Voir (ouvre dans nouvel onglet)
  - Télécharger
  - Supprimer

#### ❌ Si Fichier Trop Gros:
- ErrorDialog s'affiche
- Message: "Le fichier dépasse la taille maximale de 10MB"

### Test 5: Filtrer par Société

#### Scénario:
1. Sur `/production/daily`
2. Plusieurs productions de sociétés différentes créées
3. Cliquer sur un onglet de société

#### ✅ Résultat Attendu:
- Seules les productions de cette société s'affichent
- Métriques filtrées (KPI cards)
- Graphique filtré
- Tableau filtré
- Compteur dans l'onglet correct

### Test 6: Production Inexistante

#### Scénario:
1. Aller sur `/production/xxxxx-invalid-uuid`
2. URL avec un ID qui n'existe pas

#### ✅ Résultat Attendu:
- ErrorDialog s'affiche avec:
  - Titre: "Production introuvable"
  - Message: "La production n'existe pas ou a été supprimée"
- Bouton **"Retour à la liste"** visible
- Pas de crash de l'application

## 🔍 Diagnostic en Cas de Problème

### Erreur: "Production introuvable"

**Vérifications:**
1. La migration `add_production_status_tracking.sql` est appliquée
2. Les productions ont un statut:
```sql
SELECT id, status FROM daily_production WHERE status IS NULL;
```
3. Si des productions sans statut, exécuter:
```sql
UPDATE daily_production SET status = 'prepared' WHERE status IS NULL;
```

### Erreur: "Column status does not exist"

**Solution:**
```sql
-- Vérifier l'existence de la colonne
SELECT column_name FROM information_schema.columns
WHERE table_name = 'daily_production' AND column_name = 'status';

-- Si absente, ré-exécuter la migration
-- Fichier: add_production_status_tracking.sql
```

### Erreur Upload Document: "Bucket not found"

**Solution Option 1 (Automatique):**
- L'upload va créer le bucket automatiquement
- Réessayer l'upload

**Solution Option 2 (Manuel):**
```sql
-- Créer le bucket via SQL
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('production-documents', 'production-documents', false, 10485760)
ON CONFLICT (id) DO NOTHING;
```

### Erreur: "Alert JavaScript natif s'affiche"

**Vérification:**
- Vider le cache du navigateur (Ctrl + Shift + R)
- Vérifier que le build est récent
- Console: Pas d'erreur "alert is not defined"

## 📊 Vérification de l'État du Système

### Requête de Santé Complète

```sql
-- Vue d'ensemble du système
SELECT
  'Productions totales' as metric,
  COUNT(*)::text as value
FROM daily_production

UNION ALL

SELECT
  'Productions avec statut',
  COUNT(*)::text
FROM daily_production
WHERE status IS NOT NULL

UNION ALL

SELECT
  'Productions "Préparé"',
  COUNT(*)::text
FROM daily_production
WHERE status = 'prepared'

UNION ALL

SELECT
  'Productions "Expédié"',
  COUNT(*)::text
FROM daily_production
WHERE status = 'shipped'

UNION ALL

SELECT
  'Productions "Raffiné"',
  COUNT(*)::text
FROM daily_production
WHERE status = 'refined'

UNION ALL

SELECT
  'Productions "Vendu"',
  COUNT(*)::text
FROM daily_production
WHERE status = 'sold'

UNION ALL

SELECT
  'Documents totaux',
  COUNT(*)::text
FROM production_documents

UNION ALL

SELECT
  'Changements de statut',
  COUNT(*)::text
FROM production_status_history;
```

## ✨ Fonctionnalités Disponibles

### 1. Gestion de Statut
- ✅ 4 statuts: Prepared → Shipped → Refined → Sold
- ✅ Workflow visuel interactif
- ✅ Validation des transitions
- ✅ Notes optionnelles lors des changements

### 2. Traçabilité
- ✅ Historique complet de tous les changements
- ✅ Horodatage précis
- ✅ Identification de l'utilisateur
- ✅ Notes justificatives

### 3. Documents
- ✅ Upload de PDF (max 10MB)
- ✅ Noms personnalisés
- ✅ Vue, téléchargement, suppression
- ✅ Stockage sécurisé

### 4. Interface
- ✅ Page de détails complète
- ✅ Badges colorés pour les statuts
- ✅ Timeline des changements
- ✅ ErrorDialog professionnel
- ✅ Responsive design

### 5. Filtrage
- ✅ Onglets par société
- ✅ Compteurs dynamiques
- ✅ Filtrage de tous les widgets

## 📝 Checklist Post-Installation

- [ ] Migrations SQL appliquées
- [ ] Productions existantes ont un statut
- [ ] Bucket storage créé (ou sera créé auto)
- [ ] Test: Voir détails d'une production
- [ ] Test: Créer une production
- [ ] Test: Changer le statut
- [ ] Test: Upload un document
- [ ] Test: Filtrer par société
- [ ] Pas d'alert JavaScript natif
- [ ] ErrorDialog s'affiche correctement
- [ ] Build compile sans erreur

## 🎯 Prêt pour la Production

Une fois tous les tests passés:
- ✅ Système opérationnel
- ✅ Aucune régression
- ✅ Code professionnel
- ✅ Gestion d'erreur robuste
- ✅ Interface utilisateur cohérente

**Le système est prêt à être utilisé en production!**
