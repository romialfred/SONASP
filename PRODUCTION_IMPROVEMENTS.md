# Améliorations du Système de Production Journalière

## Vue d'ensemble

Le système de production journalière a été amélioré pour mieux répondre aux besoins d'une société mère avec 3 sociétés de production minière. Les améliorations incluent la gestion multi-sociétés avec filtres par onglets, l'upload de documents PDF, et des guides de champs simplifiés.

## Fonctionnalités Ajoutées

### 1. Filtrage Multi-Sociétés par Onglets

La page de production journalière affiche maintenant des onglets pour filtrer les productions par société:

- **Toutes les Sociétés** : Vue complète de toutes les productions
- **Onglets par société** : Un onglet pour chaque mining company active
- **Compteurs** : Chaque onglet affiche le nombre de productions

**Localisation** : `/production/daily-production`

**Composants modifiés** :
- `src/pages/production/DailyProductionPage.tsx`
- `src/components/ui/Tabs.tsx`

### 2. Upload de Documents PDF

Les utilisateurs peuvent maintenant attacher des documents PDF (rapports, analyses) aux productions journalières existantes.

**Fonctionnalités** :
- Modal professionnel et simple pour l'upload
- Nom personnalisé pour chaque document
- Validation automatique (PDF uniquement, max 10MB)
- Glisser-déposer supporté
- Liste des documents avec actions (voir, télécharger, supprimer)

**Composants créés** :
- `src/components/production/ProductionDocumentUpload.tsx` - Modal d'upload
- `src/components/production/ProductionDocumentsList.tsx` - Liste des documents
- `src/services/productionDocumentService.ts` - Service de gestion

**Migration database** :
- `supabase/migrations/add_production_documents.sql`

**Utilisation** :
1. Ouvrir une production existante en mode édition
2. Scroller jusqu'à la section "Documents Attachés"
3. Cliquer sur "Ajouter un Document"
4. Entrer un nom descriptif
5. Sélectionner ou glisser-déposer le fichier PDF
6. Cliquer sur "Télécharger le Document"

### 3. Guides de Champs Simplifiés

Les descriptions des champs dans le formulaire de production ont été simplifiées à un maximum de 2 lignes.

**Format** :
- Ligne 1 : Description principale concise
- Ligne 2 : Information complémentaire si nécessaire

**Exemple** :
```
Bullion: "Poids total du bullion en grammes.\nConversion automatique en onces."
```

**Fichier modifié** :
- `src/data/productionFieldGuides.ts`

## Schéma de Base de Données

### Nouvelle Table: production_documents

```sql
CREATE TABLE production_documents (
  id uuid PRIMARY KEY,
  production_id uuid REFERENCES daily_production(id),
  document_name text NOT NULL,           -- Nom donné par l'utilisateur
  file_name text NOT NULL,               -- Nom du fichier original
  file_path text NOT NULL,               -- Chemin dans Supabase Storage
  file_size integer NOT NULL,            -- Taille en bytes
  file_type text NOT NULL,               -- Type MIME
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Sécurité RLS** :
- Lecture : Tous les utilisateurs authentifiés
- Création : L'utilisateur doit être l'uploader
- Modification/Suppression : Seulement l'uploader

**Storage Bucket** : `production-documents`
- Accès privé
- Limite : 10MB par fichier

## Installation et Configuration

### 1. Appliquer la Migration Database

Exécutez le fichier SQL dans Supabase SQL Editor :
```bash
supabase/migrations/add_production_documents.sql
```

### 2. Créer le Storage Bucket

Le bucket `production-documents` est créé automatiquement au premier usage.
Ou créez-le manuellement dans Supabase Dashboard :
- Nom : `production-documents`
- Public : Non
- File size limit : 10485760 (10MB)

### 3. Permissions Storage

Assurez-vous que les politiques RLS sont configurées pour le bucket :
- INSERT : Utilisateurs authentifiés
- SELECT : Utilisateurs authentifiés
- UPDATE : Propriétaire du fichier
- DELETE : Propriétaire du fichier

## Structure des Fichiers Créés/Modifiés

### Nouveaux Fichiers

```
src/
├── components/
│   └── production/
│       ├── ProductionDocumentUpload.tsx      # Modal d'upload professionnel
│       └── ProductionDocumentsList.tsx       # Liste des documents attachés
├── services/
│   └── productionDocumentService.ts          # Service de gestion des documents

supabase/
└── migrations/
    └── add_production_documents.sql          # Migration database
```

### Fichiers Modifiés

```
src/
├── components/
│   ├── production/
│   │   └── DailyProductionFormEnhanced.tsx   # Ajout section documents
│   └── ui/
│       └── Tabs.tsx                          # Support pour count badge
├── data/
│   └── productionFieldGuides.ts              # Descriptions simplifiées
└── pages/
    └── production/
        └── DailyProductionPage.tsx           # Ajout filtres par onglets
```

## Utilisation

### Filtrer par Société

1. Aller sur `/production/daily-production`
2. Les onglets apparaissent automatiquement sous l'en-tête
3. Cliquer sur un onglet pour filtrer
4. Les métriques, graphiques et tableau s'ajustent automatiquement

### Ajouter un Document

1. Créer ou éditer une production existante
2. Scroller jusqu'à "Documents Attachés"
3. Cliquer "Ajouter un Document"
4. Dans le modal :
   - Entrer un nom descriptif (ex: "Analyse Journalière 15 Nov 2025")
   - Sélectionner un fichier PDF ou glisser-déposer
   - Vérifier les informations
   - Cliquer "Télécharger le Document"
5. Le document apparaît dans la liste

### Gérer les Documents

- **Voir** : Cliquer sur l'icône œil pour ouvrir le PDF dans un nouvel onglet
- **Télécharger** : Cliquer sur l'icône téléchargement pour sauvegarder localement
- **Supprimer** : Cliquer sur l'icône poubelle (avec confirmation)

## Considérations Techniques

### Performance

- Les documents sont stockés dans Supabase Storage (pas dans la base de données)
- Les fichiers sont téléchargés à la demande
- Limite de 10MB par fichier pour éviter les problèmes de performance

### Sécurité

- Row Level Security (RLS) activé sur toutes les tables
- Seuls les utilisateurs authentifiés peuvent uploader
- Les utilisateurs ne peuvent supprimer que leurs propres documents
- Validation côté client et serveur

### Types Supportés

- PDF uniquement (`.pdf`)
- Type MIME : `application/pdf`
- Extension validée côté client

## Maintenance

### Nettoyage des Documents Orphelins

Si des productions sont supprimées, les documents sont automatiquement supprimés (CASCADE).

### Monitoring du Storage

Surveillez l'utilisation du storage dans Supabase Dashboard :
- Settings > Storage
- Vérifiez la taille du bucket `production-documents`

### Logs et Débogage

Les erreurs sont loggées dans la console :
```javascript
console.error('Error uploading document:', error);
```

## Tests Recommandés

1. **Test Upload** :
   - Créer une production
   - Uploader un PDF valide
   - Vérifier qu'il apparaît dans la liste

2. **Test Validation** :
   - Essayer d'uploader un fichier non-PDF (doit être rejeté)
   - Essayer un fichier > 10MB (doit être rejeté)

3. **Test Filtres** :
   - Créer des productions pour différentes sociétés
   - Vérifier que les onglets affichent les bons compteurs
   - Vérifier que le filtrage fonctionne correctement

4. **Test Permissions** :
   - Uploader un document avec User A
   - Se connecter avec User B
   - Vérifier que User B peut voir mais pas supprimer le document de User A

## Support et Contact

Pour toute question ou problème :
- Vérifiez d'abord que la migration database est appliquée
- Vérifiez que le bucket storage existe
- Consultez les logs de la console navigateur
- Consultez les logs Supabase
