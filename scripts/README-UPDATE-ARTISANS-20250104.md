# Guide de Mise à Jour - Système Artisans Miniers

Date: 04/01/2025

## Vue d'ensemble

Cette mise à jour apporte des améliorations complètes au système de gestion des artisans miniers, incluant :

- ✅ Correction de l'erreur d'import QRCode (remplacé par un placeholder image)
- ✅ Logos colorés pour les moyens de paiement (Orange Money, Moov Money, Wave, etc.)
- ✅ Service de génération de factures PDF professionnel
- ✅ Mise à jour complète de la base de données

## Corrections Appliquées

### 1. Suppression de la dépendance QRCode

**Problème**: Import de `qrcode` causant des erreurs de compilation

**Solution**: Remplacement par une génération de QR Code placeholder utilisant Canvas HTML5
- Fonction `generateQRCode()` mise à jour dans `carteProfessionnelleGeneratorService.ts`
- Plus de dépendance externe problématique
- Image placeholder générée dynamiquement

### 2. Logos des Moyens de Paiement

**Nouveau fichier**: `src/components/payment/PaymentMethodLogos.tsx`

Composants SVG avec couleurs officielles:
- **OrangeMoneyLogo** - Orange (#FF6600)
- **MoovMoneyLogo** - Bleu (#0066CC)
- **WaveLogo** - Dégradé Rose/Violet
- **MobileMoneyLogo** - Violet
- **BankTransferLogo** - Bleu bancaire
- **CashLogo** - Vert
- **ChequeLogo** - Gris ardoise

### 3. Service de Génération de Factures PDF

**Nouveau fichier**: `src/services/factureArtisanPdfService.ts`

Génère des factures PDF conformes aux standards du Burkina Faso avec:
- En-tête officiel "FACTURE NORMALISÉE – VENTE D'OR"
- Informations SONASP complètes
- Détails client (artisan)
- Tableau produits détaillé
- Calculs automatiques (HT, TVA, Retenue, TTC)
- Mode de paiement avec logos
- Conditions de livraison et références légales

## Instructions de Mise à Jour de la Base de Données

### Étape 1: Accéder à votre Console Supabase

1. Connectez-vous à [https://supabase.com](https://supabase.com)
2. Sélectionnez votre projet
3. Allez dans **SQL Editor**

### Étape 2: Exécuter le Script de Migration

1. Ouvrez le fichier: `scripts/UPDATE-COMPLETE-ARTISANS-SYSTEM-20250104.sql`
2. Copiez tout le contenu du fichier
3. Collez-le dans l'éditeur SQL de Supabase
4. Cliquez sur **RUN** pour exécuter le script

### Étape 3: Vérifier l'Exécution

Vérifiez que toutes les colonnes ont été ajoutées:

```sql
-- Vérifier artisans_miniers
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'artisans_miniers'
ORDER BY ordinal_position;

-- Vérifier les index
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN (
  'artisans_miniers',
  'ventes_or_artisans',
  'paiements_artisans',
  'cartes_professionnelles_artisans',
  'infractions_artisans'
);

-- Vérifier les triggers
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Vérifier la vue
SELECT * FROM vw_artisans_statistiques LIMIT 5;
```

## Détails de la Migration

### Tables Mises à Jour

#### 1. `artisans_miniers`
Nouvelles colonnes:
- `statut_global` - Statut actif/inactif de l'artisan
- `raison_desactivation` - Motif de désactivation
- `date_desactivation` - Date de désactivation
- `desactive_par` - Utilisateur ayant désactivé
- `poids_total_vendu_grammes` - Total des ventes en grammes
- `nombre_ventes` - Nombre total de ventes
- `chiffre_affaires_total` - CA total en FCFA
- `derniere_vente_date` - Date de la dernière vente

#### 2. `cartes_professionnelles_artisans`
Nouvelles colonnes:
- `carte_recto_url` - URL de la carte recto
- `carte_verso_url` - URL de la carte verso
- `motif_rejet` - Raison du rejet si applicable
- `validee_par` - Validateur de la carte
- `date_validation` - Date de validation

#### 3. `ventes_or_artisans`
Nouvelles colonnes:
- `statut_paiement` - Statut du paiement
- `date_paiement` - Date effective du paiement
- `reference_paiement` - Référence de transaction

#### 4. `paiements_artisans`
Nouvelles colonnes:
- `preuve_paiement_url` - URL du justificatif
- `statut_validation` - Statut de validation
- `valide_par` - Validateur du paiement
- `date_validation` - Date de validation

#### 5. `factures_definitives_artisans`
Nouvelles colonnes:
- `facture_pdf_url` - URL du PDF de la facture
- `statut_facture` - Statut de la facture

### Fonctions et Triggers Ajoutés

#### 1. `update_artisan_metrics()`
Trigger automatique qui met à jour les métriques de l'artisan après chaque vente:
- Poids total vendu
- Nombre de ventes
- Chiffre d'affaires
- Date dernière vente

#### 2. `update_vente_paiement_status()`
Trigger automatique qui met à jour le statut de paiement d'une vente lors de l'enregistrement d'un paiement.

### Index de Performance

12 index ajoutés pour optimiser:
- Recherches par statut
- Filtres par type d'artisan
- Recherches par région
- Filtres par numéro de carte
- Recherches de ventes par artisan
- Filtres par date
- Recherches de paiements
- Recherches d'infractions

### Sécurité RLS

Toutes les tables ont:
- RLS activé
- Politiques SELECT pour utilisateurs authentifiés
- Politiques INSERT avec vérifications
- Politiques UPDATE avec contrôles d'accès

### Vue Statistiques

`vw_artisans_statistiques` - Vue agrégée fournissant:
- Informations artisan
- Métriques de ventes
- Statut de carte
- Nombre d'infractions
- Ventes payées

## Test de la Mise à Jour

### 1. Tester l'Application

```bash
npm run build
```

Le build doit se terminer sans erreur.

### 2. Tester les Fonctionnalités

- ✅ Formulaire de paiement avec logos colorés
- ✅ Génération de facture PDF
- ✅ Génération de carte professionnelle (avec QR placeholder)
- ✅ Mise à jour automatique des métriques artisan
- ✅ Tracking du statut de paiement

### 3. Requêtes de Test

```sql
-- Test des métriques artisan
SELECT
  numero_carte,
  nom,
  prenoms,
  poids_total_vendu_grammes,
  nombre_ventes,
  chiffre_affaires_total
FROM artisans_miniers
WHERE nombre_ventes > 0;

-- Test des ventes avec statut paiement
SELECT
  v.id,
  a.nom,
  a.prenoms,
  v.poids_grammes,
  v.montant_total_fcfa,
  v.statut_paiement,
  v.date_paiement
FROM ventes_or_artisans v
JOIN artisans_miniers a ON v.artisan_id = a.id;

-- Test de la vue statistiques
SELECT * FROM vw_artisans_statistiques LIMIT 10;
```

## Rollback (Si Nécessaire)

En cas de problème, vous pouvez annuler certaines modifications:

```sql
-- Supprimer les triggers
DROP TRIGGER IF EXISTS trigger_update_artisan_metrics ON ventes_or_artisans;
DROP TRIGGER IF EXISTS trigger_update_vente_paiement ON paiements_artisans;

-- Supprimer les fonctions
DROP FUNCTION IF EXISTS update_artisan_metrics();
DROP FUNCTION IF EXISTS update_vente_paiement_status();

-- Supprimer la vue
DROP VIEW IF EXISTS vw_artisans_statistiques;

-- Note: Les colonnes ajoutées ne seront pas supprimées pour préserver les données
```

## Support

Si vous rencontrez des problèmes:

1. Vérifiez les logs d'erreur dans la console Supabase
2. Assurez-vous que toutes les tables existent
3. Vérifiez les permissions RLS
4. Consultez la documentation Supabase

## Changelog

### Version 04/01/2025

- ✅ Suppression dépendance QRCode problématique
- ✅ Ajout logos colorés moyens de paiement
- ✅ Service génération factures PDF professionnel
- ✅ Colonnes métriques artisans
- ✅ Colonnes URLs cartes recto/verso
- ✅ Colonnes statut paiement
- ✅ Colonnes validation paiements
- ✅ Triggers automatiques
- ✅ Index de performance
- ✅ Politiques RLS complètes
- ✅ Vue statistiques globales
