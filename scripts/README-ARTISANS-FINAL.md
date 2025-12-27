# Guide d'Installation - Module Artisans Miniers

## Vue d'ensemble

Le module Artisans Miniers gère les artisans miniers **indépendants** (exploitants, collecteurs, intermédiaires, fournisseurs) au Burkina Faso et autres pays du Sahel.

**Note importante:** Les artisans miniers sont INDEPENDANTS et n'appartiennent PAS à une compagnie minière. Il n'y a donc **pas de colonne `mining_company_id`** dans la table.

## Structure des Tables

### SNP_artisans_miniers
Table principale contenant:
- Informations personnelles (nom, prénom, date de naissance, etc.)
- Informations d'entreprise (raison sociale pour personne morale)
- Coordonnées (téléphone, email, adresse)
- Localisation (pays, région, commune)
- Documents d'identité
- Type d'artisan (exploitant, collecteur, intermédiaire, fournisseur)

### SNP_cartes_professionnelles
Table des cartes professionnelles délivrées aux artisans avec:
- Numéro de carte
- Dates de délivrance et expiration
- Statut (actif, expiré, suspendu, révoqué)
- PDF de la carte générée

## Installation - Étapes à Suivre

### Étape 1: Créer les Tables
Exécutez dans **Supabase SQL Editor**:

```sql
-- Fichier: supabase/migrations/20251227_001_create_artisans_miniers_system.sql
```

Ce script va créer:
- ✅ Table `SNP_artisans_miniers`
- ✅ Table `SNP_cartes_professionnelles`
- ✅ Indexes pour les performances
- ✅ Triggers pour updated_at
- ✅ Politiques RLS (Row Level Security)
- ✅ Fonctions utilitaires

### Étape 2: Insérer les Données de Test
Exécutez dans **Supabase SQL Editor**:

```sql
-- Fichier: scripts/insert-artisans-burkina-final.sql
```

Ce script insère 20 artisans de test pour le Burkina Faso avec:
- 12 exploitants (personnes physiques)
- 4 collecteurs (2 physiques, 2 morales)
- 3 intermédiaires (2 physiques, 1 morale)
- 1 fournisseur (personne morale)

## Vérification

Après exécution, vérifiez dans Supabase:

```sql
-- Vérifier les artisans
SELECT
  numero_carte,
  type_artisan,
  COALESCE(nom || ' ' || prenoms, raison_sociale) as nom_complet,
  pays,
  region,
  commune
FROM "SNP_artisans_miniers"
ORDER BY numero_carte;
```

Vous devriez voir 20 artisans du Burkina Faso avec des numéros de carte comme:
- SONASP/AM/2025/BF/0001
- SONASP/AM/2025/BF/0002
- ...
- SONASP/AM/2025/BF/0020

## Structure de la Données

### Types d'Artisans
1. **Exploitant**: Extrait directement l'or des sites miniers
2. **Collecteur**: Achète l'or auprès des exploitants
3. **Intermédiaire**: Facilite les transactions entre parties
4. **Fournisseur**: Fournit du matériel et équipements aux artisans

### Types de Personnes
- **Physique**: Individu (nom + prénom)
- **Morale**: Entreprise (raison sociale + numéro registre commerce)

## Points Importants

### ✅ Ce qui est inclus
- Colonne `pays` pour supporter plusieurs pays (Burkina Faso, Mali, etc.)
- Colonne `updated_by` pour l'audit trail
- Colonne `collecteur_id` pour lier un exploitant à son collecteur
- Tous les champs requis selon le formulaire de l'application

### ❌ Ce qui n'est PAS inclus
- **Pas de `mining_company_id`**: Les artisans sont indépendants
- **Pas de `site_exploitation`**: Remplacé par région/commune
- **Pas de `adresse_complete`**: Remplacé par `adresse`

## Interface TypeScript Mise à Jour

Le service `artisanMinierService.ts` a été corrigé pour refléter la structure correcte:

```typescript
export interface ArtisanMinier {
  id: string;
  numero_carte: string;
  type_personne: 'physique' | 'morale';
  type_artisan: 'exploitant' | 'collecteur' | 'intermediaire' | 'fournisseur';

  // Personne physique
  nom?: string;
  prenoms?: string;
  date_naissance?: string;
  lieu_naissance?: string;
  sexe?: 'M' | 'F' | 'Autre';
  nationalite?: string;

  // Personne morale
  raison_sociale?: string;
  numero_registre_commerce?: string;

  // Contacts
  telephone: string;
  telephone_secondaire?: string;
  email?: string;

  // Localisation
  adresse?: string;
  commune?: string;
  region?: string;
  pays?: string;  // ← AJOUTÉ

  // Pièce d'identité
  type_piece_identite?: 'CNI' | 'Passeport' | 'Permis' | 'Autre';
  numero_piece_identite?: string;
  date_delivrance_piece?: string;
  date_expiration_piece?: string;
  lieu_delivrance_piece?: string;
  piece_identite_url?: string;

  // Photo
  photo_url?: string;

  // Collecteur associé
  collecteur_id?: string;

  // Observations
  observations?: string;

  // Audit
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;  // ← AJOUTÉ
}
```

## Support

Si vous rencontrez des problèmes:
1. Vérifiez que les migrations ont bien été exécutées
2. Vérifiez que l'utilisateur est authentifié (RLS activé)
3. Consultez les logs Supabase pour les erreurs
4. Vérifiez que le frontend utilise la structure correcte

## Prochaines Étapes

Une fois les tables créées et les données insérées:
1. ✅ L'application peut afficher la liste des artisans
2. ✅ Vous pouvez créer de nouveaux artisans via le formulaire
3. ✅ Vous pouvez générer des cartes professionnelles
4. ✅ Le système de suivi et validation est opérationnel
