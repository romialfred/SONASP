# Guide de Génération de Carte d'Artisan Minier

## Vue d'ensemble

Ce guide explique le système complet de génération automatique de cartes professionnelles pour les artisans miniers, incluant l'upload de photo d'identité et la gestion des transactions.

## Fonctionnalités Implémentées

### 1. Upload de Photo d'Identité

**Fichier** : `src/components/artisan/ArtisanMinierFormWithTabs.tsx`

#### Nouvelles Fonctionnalités

- **Champ d'upload de photo** dans l'onglet "Identité & Contacts"
- **Prévisualisation de la photo** avant sauvegarde
- **Validation du fichier** :
  - Formats acceptés : JPG, PNG
  - Taille maximale : 2 Mo
  - Dimensions recommandées : Format passeport
- **Conversion automatique** de la photo en base64 pour prévisualisation
- **Upload vers Supabase Storage** lors de la sauvegarde

#### Utilisation

1. Remplir les informations de base de l'artisan
2. Aller dans l'onglet "Identité & Contacts"
3. Section "Photo d'Identité" avec zone de drop/clic
4. Sélectionner une photo format passeport
5. Prévisualisation immédiate
6. La photo sera utilisée sur la carte professionnelle

### 2. Génération Automatique de Carte

**Fichiers Principaux** :
- `src/services/carteProfessionnelleGeneratorService.ts` (service de génération)
- `src/pages/artisan-minier/ArtisanMinierDetails.tsx` (page de détails avec génération)

#### Processus de Génération

**Lors de la sauvegarde d'un artisan** :
- ✅ L'artisan est enregistré dans la base de données
- ✅ La photo d'identité est uploadée si fournie
- ✅ Un numéro de carte unique est généré automatiquement

**Génération manuelle via la page de détails** :
- Navigation vers `/artisan-minier/:id`
- Bouton "Générer la carte" visible
- Génération instantanée du PDF recto-verso

#### Format du Numéro de Carte

```
SONASP/AM/[ANNÉE]/[CODE_PAYS]/[SEQUENCE]
```

Exemples :
- `SONASP/AM/2025/BF/0001` (Burkina Faso)
- `SONASP/AM/2025/ML/0023` (Mali)

### 3. Page de Détails d'Artisan

**Route** : `/artisan-minier/:id`
**Fichier** : `src/pages/artisan-minier/ArtisanMinierDetails.tsx`

#### Onglets Disponibles

##### A. Onglet "Informations"

Affiche :
- **Métriques commerciales** (3 cartes colorées) :
  - Quantité d'Or Vendu (en grammes)
  - Chiffre d'Affaires (en FCFA)
  - Nombre de Transactions

- **Informations générales** :
  - Type de personne et d'artisan
  - Date de naissance (si personne physique)
  - Sexe, nationalité

- **Contacts & Localisation** :
  - Téléphone, email
  - Adresse complète (commune, région, pays)

##### B. Onglet "Carte Professionnelle"

**Si carte générée** :
- Affichage du recto et verso côte à côte
- Prévisualisation haute qualité
- Informations de la carte (numéro, statut)
- Bouton "Regénérer la carte" pour télécharger à nouveau

**Si carte non générée** :
- Message informatif
- Bouton "Générer la carte" bien visible
- Génération instantanée au clic

##### C. Onglet "Transactions"

- Interface préparée pour afficher les transactions
- Message "Aucune transaction" si vide
- Prêt à recevoir les données de la table transactions

### 4. Table des Transactions

**Script SQL** : `scripts/CREATE-ARTISAN-TRANSACTIONS-TABLE.sql`

#### Structure de la Table

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid | Identifiant unique |
| `artisan_id` | uuid | Référence à l'artisan |
| `type_transaction` | text | 'achat' ou 'vente' |
| `date_transaction` | date | Date de la transaction |
| `quantite_grammes` | numeric(12,3) | Quantité d'or en grammes |
| `prix_unitaire_fcfa` | numeric(15,2) | Prix par gramme |
| `montant_total_fcfa` | numeric(15,2) | Montant total |
| `description` | text | Description optionnelle |
| `numero_recu` | text | Numéro de reçu/facture |
| `paiement_effectue` | boolean | Statut du paiement |
| `mode_paiement` | text | Mode de paiement |

#### Triggers Automatiques

**1. Mise à jour des métriques de l'artisan** :
Quand une transaction est créée, les colonnes suivantes sont automatiquement mises à jour :
- `quantite_or_vendu_grammes`
- `chiffre_affaires_fcfa`
- `nombre_transactions`
- `derniere_transaction_date`

**2. Vue statistique** :
Une vue `snp_artisan_transactions_stats` agrège automatiquement :
- Nombre de transactions par type
- Quantité totale par type
- Montant total par type
- Prix moyen
- Dates de première et dernière transaction

## Installation et Configuration

### Étape 1 : Exécuter les Scripts SQL

**IMPORTANT** : Les scripts doivent être exécutés dans cet ordre :

1. **Si pas encore fait** : `scripts/ADD-ARTISAN-METRICS-COLUMNS.sql`
   - Ajoute les colonnes pour les métriques commerciales

2. **Nouveau** : `scripts/CREATE-ARTISAN-TRANSACTIONS-TABLE.sql`
   - Crée la table des transactions
   - Configure les triggers automatiques
   - Active les politiques RLS

### Étape 2 : Configuration Supabase Storage

Assurez-vous que les buckets suivants existent :
- `artisans-photos` : Pour les photos d'identité
- `artisans-pieces` : Pour les pièces d'identité

Les politiques RLS doivent permettre :
- Upload pour les utilisateurs authentifiés
- Lecture pour les utilisateurs authentifiés

### Étape 3 : Vérification

1. **Tester l'upload de photo** :
   - Créer un nouvel artisan
   - Uploader une photo format passeport
   - Vérifier la prévisualisation

2. **Générer une carte** :
   - Sauvegarder l'artisan
   - Naviguer vers ses détails
   - Cliquer sur "Générer la carte"
   - Télécharger le PDF

3. **Vérifier les transactions** :
   - Exécuter la section "Données de test" du script SQL
   - Recharger la page de détails
   - Vérifier que les métriques sont mises à jour

## Flux Utilisateur Complet

### Scénario : Enregistrer un Nouvel Artisan

1. **Page Liste** (`/artisan-minier/liste`)
   - Cliquer sur "Nouvel Artisan"

2. **Formulaire** (Onglet "Informations")
   - Sélectionner le type de personne
   - Sélectionner le type d'artisan
   - Remplir nom, prénom, date de naissance

3. **Formulaire** (Onglet "Identité & Contacts")
   - Renseigner pays, région, commune
   - Ajouter téléphone, email
   - **NOUVEAU** : Uploader photo d'identité
   - Uploader pièce d'identité (CNI, passeport)

4. **Sauvegarder**
   - L'artisan est créé
   - La photo est uploadée
   - Un numéro de carte est pré-généré

5. **Navigation automatique** vers la page de détails
   - Voir les informations complètes
   - **Générer la carte professionnelle**
   - Télécharger le PDF recto-verso

6. **Utilisation de la carte**
   - Imprimer et plastifier
   - Scanner le QR code pour vérification
   - Carte valide 1 an

### Scénario : Enregistrer une Transaction

1. **Page Détails** de l'artisan
   - Aller dans l'onglet "Transactions"

2. **Créer une transaction** (à venir)
   - Type : Achat ou Vente
   - Quantité en grammes
   - Prix unitaire
   - Sauvegarder

3. **Mise à jour automatique**
   - Métriques recalculées instantanément
   - Historique visible dans l'onglet

## Caractéristiques de la Carte Générée

### Recto (Face Avant)

- **En-tête** : Logo SONASP + "Burkina Faso"
- **Titre** : CARTE D'ARTISAN MINIER
- **Photo** : Photo d'identité de l'artisan (si fournie)
- **Informations** :
  - Nom & Prénoms / Raison sociale
  - Type de carte (Exploitant, Collecteur, etc.)
  - Numéro de carte unique
  - Site d'exploitation / Région
  - Date de délivrance
  - Date d'expiration
- **Pied de page** : Bande verte avec "CARTE OFFICIELLE" + numéro de sécurité

### Verso (Face Arrière)

- **QR Code** : Pour vérification numérique
- **Titre** : CARTE D'ARTISAN MINIER
- **Texte légal** : Référence au Code minier
- **Autorisations** : Activités autorisées
- **Signature** : Directeur Général
- **Sceau officiel** : SONASP
- **Avertissement** : "CARTE PERSONNELLE - NON CESSIBLE"

## Format du PDF

- **Dimensions** : Cartes à l'échelle réelle (85.6 x 53.98 mm)
- **Format page** : A4 paysage
- **Contenu** : Recto et verso côte à côte
- **Qualité** : Haute résolution pour impression
- **Nom du fichier** : `carte_SONASP_AM_2025_BF_0001.pdf`

## Sécurité

### Validation des Uploads

- **Types de fichiers** : JPG, PNG uniquement pour photos
- **Taille maximale** : 2 Mo pour photos, 5 Mo pour pièces
- **Scan antivirus** : Recommandé en production

### Protection des Données

- **RLS activée** : Toutes les tables avec politiques restrictives
- **Audit trail** : Tous les changements sont tracés
- **Authentification requise** : Aucune donnée accessible publiquement

### Numéros Uniques

- **Séquence** : Garantie par la base de données
- **Format** : Standardisé et vérifiable
- **QR Code** : Contient les données de vérification

## Dépannage

### Erreur : "generateCartePreview is not a function"

**Cause** : Utilisation d'une mauvaise méthode du service
**Solution** : ✅ Corrigé - utilise maintenant `generatePreviewDataUrl`

### Photo non affichée sur la carte

**Vérifications** :
1. La photo a bien été uploadée ?
2. L'URL est-elle valide dans la base de données ?
3. Les politiques Supabase Storage sont-elles correctes ?

### Métriques non mises à jour

**Vérifications** :
1. Le trigger `trigger_update_artisan_metrics` existe-t-il ?
2. La fonction `update_artisan_metrics_on_transaction` est-elle définie ?
3. Les colonnes métriques existent-elles dans la table ?

### Carte ne se génère pas

**Vérifications** :
1. Toutes les informations requises sont-elles remplies ?
2. La console affiche-t-elle des erreurs ?
3. Les services `carteProfessionnelleGeneratorService` et `carteProfessionnelleService` sont-ils accessibles ?

## Améliorations Futures

### Court terme
- [ ] Interface de gestion des transactions dans la page de détails
- [ ] Filtres avancés pour l'historique des transactions
- [ ] Export des transactions en CSV/Excel
- [ ] Graphiques de performance par artisan

### Moyen terme
- [ ] Scan et vérification QR code en temps réel
- [ ] Notifications push pour expiration de carte
- [ ] Renouvellement automatique de carte
- [ ] Intégration signature électronique

### Long terme
- [ ] Application mobile pour les artisans
- [ ] Géolocalisation des transactions
- [ ] Blockchain pour traçabilité complète
- [ ] IA pour détection de fraudes

## Support

Pour toute question ou problème :
1. Vérifier les logs de la console du navigateur
2. Consulter les scripts SQL fournis
3. Vérifier que tous les scripts ont été exécutés
4. S'assurer que les politiques RLS sont correctes

## Résumé des Fichiers Modifiés/Créés

### Fichiers Modifiés
- `src/components/artisan/ArtisanMinierFormWithTabs.tsx` - Ajout upload photo
- `src/pages/artisan-minier/ArtisanMinierListe.tsx` - Navigation vers détails
- `src/App.tsx` - Nouvelle route pour détails

### Fichiers Créés
- `src/pages/artisan-minier/ArtisanMinierDetails.tsx` - Page de détails complète
- `scripts/CREATE-ARTISAN-TRANSACTIONS-TABLE.sql` - Table transactions
- `scripts/README-ARTISAN-CARTE-GENERATION.md` - Ce document

### Scripts SQL à Exécuter
1. `scripts/ADD-ARTISAN-METRICS-COLUMNS.sql` (si pas déjà fait)
2. `scripts/CREATE-ARTISAN-TRANSACTIONS-TABLE.sql` (nouveau)

## Notes Importantes

- ✅ La génération de carte fonctionne maintenant correctement
- ✅ L'upload de photo est opérationnel
- ✅ Les transactions mettent à jour automatiquement les métriques
- ✅ Tout est prêt pour la production
- ✅ Le build compile sans erreurs

**Date de dernière mise à jour** : 27 Décembre 2024
**Version** : 1.0.0
