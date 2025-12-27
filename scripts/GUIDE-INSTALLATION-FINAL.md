# Guide d'Installation Final - Module Artisans Miniers

## 📊 Analyse de Votre Table Existante

Votre table `snp_artisans_miniers` existe déjà avec une excellente base. Il manque seulement **3 colonnes** pour être complète.

### ✅ Ce qui est Déjà en Place (Excellent !)

| Élément | Statut |
|---------|--------|
| Structure de base (colonnes principales) | ✅ OK |
| Index sur numero_carte, type_artisan, collecteur | ✅ OK |
| Politiques RLS pour utilisateurs authentifiés | ✅ OK |
| Trigger génération automatique numero_carte | ✅ OK |
| Trigger création automatique carte professionnelle | ✅ OK |
| Trigger mise à jour updated_at | ✅ OK |

### ⚠️ Ce qui Manque (3 colonnes seulement)

| Colonne | Importance | Raison |
|---------|------------|--------|
| `updated_by` | 🔴 CRITIQUE | Audit trail - tracer qui modifie |
| `telephone_secondaire` | 🟡 Recommandé | Contact alternatif |
| `numero_registre_commerce` | 🟡 Recommandé | Pour personnes morales |

## 🚀 Installation en 2 Étapes Simples

### ÉTAPE 1: Ajouter les Colonnes Manquantes (30 secondes)

Allez dans **Supabase SQL Editor** et exécutez:

```
supabase/migrations/20251227_002_add_missing_columns_artisans.sql
```

**Cette migration va:**
- ✅ Ajouter les 3 colonnes manquantes
- ✅ Élargir la liste des pays supportés (9 pays au lieu de 3)
- ✅ Ajouter 'Autre' dans les options de sexe
- ✅ Créer les index manquants pour l'optimisation

**Pays supportés après migration:**
- Burkina Faso 🇧🇫
- Mali 🇲🇱
- Niger 🇳🇪
- Côte d'Ivoire 🇨🇮
- Guinée 🇬🇳
- Sénégal 🇸🇳
- Mauritanie 🇲🇷
- Bénin 🇧🇯
- Togo 🇹🇬

### ÉTAPE 2: Insérer les Données de Test (1 minute)

Allez dans **Supabase SQL Editor** et exécutez:

```
scripts/insert-artisans-burkina-final.sql
```

**Ce script insère 20 artisans du Burkina Faso:**
- 12 exploitants (personnes physiques)
- 4 collecteurs (2 physiques + 2 entreprises)
- 3 intermédiaires (2 physiques + 1 entreprise)
- 1 fournisseur (entreprise)

## ✅ Vérification Post-Installation

### 1. Vérifier les Colonnes Ajoutées

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'snp_artisans_miniers'
AND column_name IN ('updated_by', 'telephone_secondaire', 'numero_registre_commerce');
```

**Résultat attendu:** 3 lignes

### 2. Compter les Artisans Insérés

```sql
SELECT COUNT(*) as total FROM snp_artisans_miniers;
```

**Résultat attendu:** 20 artisans

### 3. Voir les Artisans par Type

```sql
SELECT
  type_artisan,
  COUNT(*) as total,
  STRING_AGG(numero_carte, ', ' ORDER BY numero_carte) as numeros_cartes
FROM snp_artisans_miniers
GROUP BY type_artisan;
```

**Résultat attendu:**
- collecteur: 4 artisans
- exploitant: 12 artisans
- fournisseur: 1 artisan
- intermediaire: 3 artisans

## 🎯 Résultat dans l'Application

Après ces 2 étapes:

1. ✅ `/artisan-minier/liste` affiche 20 artisans
2. ✅ Vous pouvez créer de nouveaux artisans
3. ✅ Les filtres par type et pays fonctionnent
4. ✅ La génération automatique de carte fonctionne
5. ✅ L'audit trail est complet (created_by + updated_by)

## 📋 Exemple de Données Insérées

| Numéro Carte | Type | Nom | Commune | Région |
|--------------|------|-----|---------|--------|
| SONASP/AM/2025/BF/0001 | exploitant | OUEDRAOGO Abdoulaye | Ouagadougou | Centre |
| SONASP/AM/2025/BF/0002 | collecteur | KONE Mamadou | Bobo-Dioulasso | Hauts-Bassins |
| SONASP/AM/2025/BF/0004 | intermediaire | GOLD TRADING SARL | Ouagadougou | Centre |
| ... | ... | ... | ... | ... |

## 🔧 Architecture Technique

### Génération Automatique du Numéro de Carte

Format: `SONASP/AM/{année}/{pays}/{numéro}`

Exemple pour le Burkina Faso:
- SONASP/AM/2025/BF/0001
- SONASP/AM/2025/BF/0002
- ...

Pour le Mali:
- SONASP/AM/2025/ML/0001
- SONASP/AM/2025/ML/0002
- ...

### Création Automatique de la Carte Professionnelle

Quand un artisan est inséré:
1. Trigger `trigger_generate_numero_carte` génère le numéro
2. Trigger `trigger_create_carte` crée l'enregistrement dans `snp_cartes_professionnelles`
3. Date d'expiration = date_delivrance + 1 an
4. Statut initial = 'actif'

### Audit Trail Complet

Chaque modification est tracée:
- `created_by` → Qui a créé l'artisan
- `updated_by` → Qui a modifié l'artisan (NOUVEAU)
- `created_at` → Quand créé
- `updated_at` → Quand modifié (auto-update par trigger)

## 📱 Utilisation dans l'Application

### Page Liste des Artisans

Route: `/artisan-minier/liste`

Fonctionnalités:
- 📋 Tableau avec tous les artisans
- 🔍 Recherche par nom/numéro carte
- 🎯 Filtres par type et pays
- ➕ Bouton "Nouveau artisan"
- 👁️ Voir détails
- ✏️ Modifier
- 🗑️ Supprimer

### Formulaire Création/Modification

Champs automatiques:
- ✅ `numero_carte` → Généré automatiquement
- ✅ `created_at` → Timestamp automatique
- ✅ `updated_at` → Mis à jour automatiquement
- ✅ `created_by` → ID utilisateur connecté
- ✅ `updated_by` → ID utilisateur connecté

Champs conditionnels:
- Si `type_personne = 'physique'` → Nom, Prénoms requis
- Si `type_personne = 'morale'` → Raison sociale requise

## ⚠️ Points Importants

### 1. Les Artisans Sont Indépendants
- ❌ Pas de `mining_company_id`
- ✅ Les artisans ne sont pas liés à une compagnie minière
- ✅ Ils sont identifiés par leur `numero_carte` unique

### 2. Support Multi-Pays
- ✅ Un artisan peut être de n'importe quel pays du Sahel
- ✅ Le code pays est intégré dans le `numero_carte`
- ✅ Possibilité de filtrer par pays dans l'interface

### 3. Deux Types de Personnes
- **Physique:** Individu (nom + prénom requis)
- **Morale:** Entreprise (raison_sociale + numero_registre_commerce requis)

### 4. Quatre Types d'Artisans
- **Exploitant:** Extrait l'or directement
- **Collecteur:** Achète auprès des exploitants
- **Intermédiaire:** Facilite les transactions
- **Fournisseur:** Vend du matériel/équipement

## 🆘 Dépannage

### Les artisans ne s'affichent pas ?

```sql
-- 1. Vérifier que la table existe
SELECT COUNT(*) FROM snp_artisans_miniers;

-- 2. Vérifier les politiques RLS
SELECT * FROM pg_policies WHERE tablename = 'snp_artisans_miniers';

-- 3. Vérifier que vous êtes authentifié
SELECT auth.uid();  -- Doit retourner un UUID, pas NULL
```

### Erreur lors de l'insertion ?

Vérifiez les contraintes:
- `type_personne` doit être 'physique' ou 'morale'
- `type_artisan` doit être 'exploitant', 'collecteur', 'intermediaire' ou 'fournisseur'
- `telephone` est requis
- Si physique: `nom` requis
- Si morale: `raison_sociale` requise

## 📚 Documentation Complète

- `scripts/ANALYSE-TABLE-ARTISANS.md` → Analyse détaillée de votre table
- `scripts/README-ARTISANS-FINAL.md` → Documentation technique complète
- `supabase/migrations/20251227_002_add_missing_columns_artisans.sql` → Script migration

## ✅ Checklist Finale

- [ ] Migration `20251227_002_add_missing_columns_artisans.sql` exécutée
- [ ] Script `insert-artisans-burkina-final.sql` exécuté
- [ ] 20 artisans visibles dans Supabase
- [ ] 20 artisans visibles dans l'application (`/artisan-minier/liste`)
- [ ] Test création nouvel artisan réussi
- [ ] Test génération carte professionnelle réussi
- [ ] Filtres par type et pays fonctionnels

## 🎉 Prêt à Utiliser !

Une fois ces 2 étapes complétées, votre système de gestion des artisans miniers est **100% opérationnel** !

---

**Note:** Le build du projet a été vérifié et réussit sans erreur.
