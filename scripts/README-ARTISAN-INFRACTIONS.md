# Système de Gestion des Infractions des Artisans Miniers

## Vue d'ensemble

Le système d'infractions permet d'enregistrer, suivre et gérer les manquements et infractions commises par les artisans miniers. Il offre une traçabilité complète avec support de documents et images en pièces jointes.

## Fonctionnalités

### 1. Enregistrement des Infractions
- Formulaire ergonomique avec tous les champs nécessaires
- Types d'infractions prédéfinis :
  - Non-déclaration de production
  - Vente illégale
  - Exploitation sans autorisation
  - Non-respect des normes environnementales
  - Travail des enfants
  - Conditions de travail dangereuses
  - Non-paiement des taxes
  - Falsification de documents
  - Trafic illégal
  - Autre (avec champ personnalisé)

### 2. Upload de Documents
- Support des images (JPG, PNG, GIF, WebP)
- Support des PDF et documents Word
- Prévisualisation avant upload
- Stockage sécurisé dans Supabase Storage
- Possibilité d'ajouter plusieurs documents par infraction

### 3. Suivi du Traitement
- **Statuts de traitement:**
  - En cours
  - Clôturé

- **Conclusions possibles:**
  - Reconnu coupable
  - Soupçonné
  - Complice
  - Innocenté

### 4. Interface Utilisateur
- **Page de détails de l'artisan:**
  - Onglet "Infractions" avec tableau ergonomique
  - Headers colorés (rouge) pour les infractions
  - Filtres de recherche
  - Statistiques (en cours, clôturées)

- **Formulaire d'infraction:**
  - Design moderne et ergonomique
  - Upload de fichiers par glisser-déposer
  - Validation des champs
  - Prévisualisation des documents

- **Page de détails d'une infraction:**
  - Affichage complet des informations
  - Visualisation et téléchargement des documents
  - Timeline de traitement
  - Badges de statut avec codes couleur

## Installation

### 1. Exécuter le script SQL

Exécutez le fichier `CREATE-ARTISAN-INFRACTIONS-TABLE.sql` dans votre base de données Supabase:

```bash
# Via l'interface Supabase SQL Editor
# Ou via psql
psql -h [YOUR_HOST] -U postgres -d postgres -f CREATE-ARTISAN-INFRACTIONS-TABLE.sql
```

### 2. Vérifier la création

Vérifiez que les éléments suivants ont été créés:
- ✅ Table `artisan_infractions`
- ✅ Enums `statut_traitement_infraction` et `conclusion_infraction`
- ✅ Indexes pour les performances
- ✅ Policies RLS pour la sécurité
- ✅ Storage bucket `infraction-documents`
- ✅ Policies de storage

### 3. Configuration du Storage

Vérifiez que le bucket `infraction-documents` est bien créé dans Supabase Storage:
1. Allez dans Supabase Dashboard > Storage
2. Vous devriez voir le bucket `infraction-documents`
3. Vérifiez que les policies sont actives

## Utilisation

### Accéder aux Infractions

1. Allez sur la page de détails d'un artisan
2. Cliquez sur l'onglet "Infractions"
3. Vous verrez le tableau de toutes les infractions avec:
   - Date de l'infraction
   - Type
   - Description
   - Lieu
   - Statut de traitement
   - Conclusion

### Créer une Nouvelle Infraction

1. Dans l'onglet "Infractions", cliquez sur "Nouvelle Infraction"
2. Remplissez le formulaire:
   - Date de l'infraction
   - Lieu
   - Type d'infraction
   - Description détaillée
   - Remarques complémentaires
3. Uploadez les documents/preuves (optionnel)
4. Définissez le statut de traitement
5. Si clôturé, choisissez la conclusion
6. Cliquez sur "Enregistrer l'Infraction"

### Modifier une Infraction

1. Cliquez sur l'icône œil dans le tableau
2. Sur la page de détails, cliquez sur "Modifier"
3. Modifiez les informations nécessaires
4. Cliquez sur "Mettre à Jour"

### Uploader des Documents

1. Dans le formulaire d'infraction, utilisez la zone de drag & drop
2. Ou cliquez pour sélectionner les fichiers
3. Les fichiers seront prévisualisés
4. Vous pouvez supprimer des fichiers avant de soumettre
5. Les fichiers sont uploadés automatiquement lors de la sauvegarde

### Visualiser les Documents

1. Sur la page de détails d'une infraction
2. Section "Documents & Preuves"
3. Cliquez sur l'icône œil pour visualiser
4. Cliquez sur l'icône téléchargement pour télécharger

## Sécurité

### RLS Policies

- **SELECT:** Tous les utilisateurs authentifiés peuvent voir les infractions
- **INSERT:** Seuls les utilisateurs authentifiés peuvent créer des infractions
- **UPDATE:** L'auteur ou les admins/management peuvent modifier
- **DELETE:** Seuls les admins/management peuvent supprimer

### Storage Policies

- **Upload:** Tous les utilisateurs authentifiés peuvent uploader
- **View:** Tous les utilisateurs authentifiés peuvent voir
- **Update:** Tous les utilisateurs authentifiés peuvent modifier
- **Delete:** Seuls les admins/management peuvent supprimer

## Structure de la Base de Données

```sql
CREATE TABLE artisan_infractions (
  id uuid PRIMARY KEY,
  artisan_id uuid REFERENCES artisans_miniers(id),
  date_infraction date NOT NULL,
  type_infraction text NOT NULL,
  description text NOT NULL,
  lieu text,
  statut_traitement statut_traitement_infraction DEFAULT 'en_cours',
  conclusion conclusion_infraction,
  remarques text,
  documents jsonb DEFAULT '[]',
  date_cloture date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## API Service

Le service `artisanInfractionsService` fournit les méthodes suivantes:

```typescript
// Récupérer toutes les infractions d'un artisan
getByArtisanId(artisanId: string): Promise<ArtisanInfraction[]>

// Récupérer une infraction par ID
getById(id: string): Promise<ArtisanInfraction | null>

// Créer une infraction
create(data: CreateInfractionData): Promise<ArtisanInfraction>

// Mettre à jour une infraction
update(id: string, updates: Partial<CreateInfractionData>): Promise<ArtisanInfraction>

// Supprimer une infraction
delete(id: string): Promise<void>

// Uploader un document
uploadDocument(file: File, infractionId: string): Promise<string>

// Statistiques
getStatistics(artisanId: string): Promise<Statistics>
```

## Routes

```typescript
// Formulaire nouvelle infraction
/artisan-minier/:artisanId/infractions/nouvelle

// Détails d'une infraction
/artisan-minier/:artisanId/infractions/:infractionId

// Modifier une infraction
/artisan-minier/:artisanId/infractions/:infractionId/modifier
```

## Design & Ergonomie

### Couleurs

- **Headers tableau:** Dégradé rouge (from-red-600 to-red-700)
- **Statut En Cours:** Orange
- **Statut Clôturé:** Gris
- **Conclusion Reconnu:** Rouge
- **Conclusion Soupçonné:** Orange
- **Conclusion Complice:** Violet
- **Conclusion Innocenté:** Vert

### Icônes

- AlertTriangle pour les infractions
- Calendar pour les dates
- MapPin pour les lieux
- FileText pour les descriptions
- Upload pour les documents
- Eye pour visualiser
- Edit2 pour modifier

## Support

Pour toute question ou problème, veuillez consulter:
1. Cette documentation
2. Le code source dans `/src/services/artisanInfractionsService.ts`
3. Les pages dans `/src/pages/artisan-minier/`

## Améliorations Futures

- [ ] Notifications par email lors de l'enregistrement d'une infraction
- [ ] Export des infractions en PDF/Excel
- [ ] Historique des modifications
- [ ] Workflow d'approbation pour les conclusions
- [ ] Tableau de bord des infractions
- [ ] Statistiques avancées par type d'infraction
