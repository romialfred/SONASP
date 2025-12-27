# Analyse de la Table SNP_artisans_miniers Existante

## Résumé de l'Analyse

La table `snp_artisans_miniers` existe déjà dans votre base de données. Voici ce qui manque et doit être ajouté :

## ✅ Ce qui est Déjà en Place

### Colonnes Principales
- ✅ `id`, `type_personne`, `type_artisan`
- ✅ `nom`, `prenoms`, `date_naissance`, `lieu_naissance`, `sexe`, `nationalite`
- ✅ `raison_sociale` (pour personnes morales)
- ✅ `telephone`, `email`
- ✅ `adresse`, `commune`, `region`, `pays`
- ✅ `type_piece_identite`, `numero_piece_identite`, dates de pièce
- ✅ `photo_url`, `piece_identite_url`
- ✅ `collecteur_id`, `numero_carte`, `observations`
- ✅ `created_at`, `updated_at`, `created_by`

### Index
- ✅ `idx_artisans_numero_carte`
- ✅ `idx_artisans_type_artisan`
- ✅ `idx_artisans_collecteur`
- ✅ `idx_artisans_telephone`
- ✅ `idx_artisans_created_at`

### Politiques RLS
- ✅ "Authenticated users can view artisans"
- ✅ "Authenticated users can insert artisans"
- ✅ "Authenticated users can update artisans"
- ✅ "Authenticated users can delete artisans"

### Triggers
- ✅ `trigger_generate_numero_carte` - Génère automatiquement le numéro de carte
- ✅ `trigger_create_carte` - Crée automatiquement la carte professionnelle
- ✅ `update_artisans_updated_at` - Met à jour le timestamp

## ❌ Ce qui Manque (3 colonnes)

### 1. `updated_by` (uuid)
**Utilité:** Audit trail - tracer qui a modifié l'enregistrement
**Type:** `uuid REFERENCES auth.users(id)`
**Importance:** 🔴 CRITIQUE pour la conformité et l'audit

### 2. `telephone_secondaire` (text)
**Utilité:** Numéro de téléphone alternatif pour joindre l'artisan
**Type:** `text`
**Importance:** 🟡 RECOMMANDÉ pour la communication

### 3. `numero_registre_commerce` (text)
**Utilité:** Pour les personnes morales (SARL, SA, etc.)
**Type:** `text`
**Importance:** 🟡 RECOMMANDÉ pour les entreprises

## 🔧 Améliorations à Apporter

### 1. Contrainte Pays
**Actuel:** Seulement ['Burkina Faso', 'Mali', 'Niger']
**Proposé:** Ajouter ['Côte d'Ivoire', 'Guinée', 'Sénégal', 'Mauritanie', 'Bénin', 'Togo']
**Raison:** Support multi-pays pour toute la région du Sahel

### 2. Contrainte Sexe
**Actuel:** Seulement ['M', 'F']
**Proposé:** Ajouter 'Autre'
**Raison:** Inclusion et conformité aux standards modernes

### 3. Index Pays
**À ajouter:** `idx_artisans_pays`
**Raison:** Optimisation des filtres par pays

## 📋 Installation - Étapes à Suivre

### ÉTAPE 1: Ajouter les Colonnes Manquantes

Exécutez dans **Supabase SQL Editor**:

```bash
supabase/migrations/20251227_002_add_missing_columns_artisans.sql
```

Cette migration va:
- ✅ Ajouter `updated_by` (audit trail)
- ✅ Ajouter `telephone_secondaire`
- ✅ Ajouter `numero_registre_commerce`
- ✅ Élargir la contrainte `pays` (9 pays au lieu de 3)
- ✅ Ajouter 'Autre' dans la contrainte `sexe`
- ✅ Créer les index manquants

### ÉTAPE 2: Insérer les Données de Test

Exécutez dans **Supabase SQL Editor**:

```bash
scripts/insert-artisans-burkina-final.sql
```

Ce script insère 20 artisans du Burkina Faso pour tester le système.

## 🔍 Vérification Post-Migration

Après avoir exécuté la migration, vérifiez:

```sql
-- 1. Vérifier que les colonnes sont ajoutées
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'snp_artisans_miniers'
AND column_name IN ('updated_by', 'telephone_secondaire', 'numero_registre_commerce')
ORDER BY column_name;
-- Résultat attendu: 3 lignes

-- 2. Vérifier les contraintes
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE 'snp_artisans_miniers_%'
ORDER BY constraint_name;

-- 3. Compter les artisans
SELECT
  pays,
  type_artisan,
  COUNT(*) as total
FROM snp_artisans_miniers
GROUP BY pays, type_artisan
ORDER BY pays, type_artisan;
```

## 🎯 Résultat Final

Après l'exécution des 2 scripts:
- ✅ Table complète avec toutes les colonnes nécessaires
- ✅ Support multi-pays (9 pays du Sahel)
- ✅ Audit trail complet (`created_by`, `updated_by`)
- ✅ 20 artisans de test prêts à utiliser
- ✅ Système opérationnel dans l'application

## 📊 Structure Finale de la Table

| Colonne | Type | Description | Statut |
|---------|------|-------------|--------|
| id | uuid | Identifiant unique | ✅ Existe |
| numero_carte | text | Numéro carte (SONASP/AM/2025/BF/0001) | ✅ Existe |
| type_personne | text | physique / morale | ✅ Existe |
| type_artisan | text | exploitant / collecteur / etc. | ✅ Existe |
| nom | text | Nom (personne physique) | ✅ Existe |
| prenoms | text | Prénoms | ✅ Existe |
| raison_sociale | text | Nom entreprise (personne morale) | ✅ Existe |
| numero_registre_commerce | text | N° registre commerce | ⚠️ À AJOUTER |
| telephone | text | Téléphone principal | ✅ Existe |
| telephone_secondaire | text | Téléphone alternatif | ⚠️ À AJOUTER |
| email | text | Email | ✅ Existe |
| pays | text | Pays (Burkina Faso, Mali, etc.) | ✅ Existe |
| region | text | Région | ✅ Existe |
| commune | text | Commune | ✅ Existe |
| adresse | text | Adresse complète | ✅ Existe |
| collecteur_id | uuid | Collecteur associé | ✅ Existe |
| created_by | uuid | Créé par | ✅ Existe |
| updated_by | uuid | Modifié par | ⚠️ À AJOUTER |
| created_at | timestamptz | Date création | ✅ Existe |
| updated_at | timestamptz | Date modification | ✅ Existe |

## 🚀 Prochaines Étapes

1. ✅ Exécuter la migration `20251227_002_add_missing_columns_artisans.sql`
2. ✅ Exécuter le script d'insertion `insert-artisans-burkina-final.sql`
3. ✅ Vérifier dans l'application que les artisans s'affichent
4. ✅ Tester la création d'un nouvel artisan
5. ✅ Tester la génération de carte professionnelle

## 📝 Notes Importantes

- Les artisans sont **INDÉPENDANTS** (pas de `mining_company_id`)
- Le `numero_carte` est généré **automatiquement** par trigger
- Une carte professionnelle est créée **automatiquement** après insertion
- RLS est **activé** - seuls les utilisateurs authentifiés peuvent accéder
- Support **multi-pays** pour toute la région du Sahel
