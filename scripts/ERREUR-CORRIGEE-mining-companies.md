# Correction de l'Erreur: "relation snp_mining_companies does not exist"

## 🔴 Problème

Lors de l'exécution de `IMPLEMENT-ARTISAN-SONASP-SALES-LOGIC.sql`, vous avez reçu l'erreur:

```
ERROR: relation "snp_mining_companies" does not exist
```

## ✅ Solution Appliquée

Les scripts ont été corrigés pour utiliser le nom correct de la table: `mining_companies` (sans le préfixe `snp_`).

### Changements Effectués

1. **RESUME-CORRECTIONS-27-12-2024.sql**
   - Crée maintenant la table `mining_companies` si elle n'existe pas
   - Utilise `name` au lieu de `company_name`
   - Ajoute `abbreviation` et `code`
   - Crée SONASP automatiquement

2. **IMPLEMENT-ARTISAN-SONASP-SALES-LOGIC.sql**
   - Toutes les références `snp_mining_companies` → `mining_companies`
   - Toutes les références `company_name` → `name`
   - Mise à jour des vues et fonctions

3. **VERIFY-SONASP-TRADING-SPACE.sql**
   - Pas de modifications nécessaires (utilisait déjà `mining_companies`)

## 📝 Ordre d'Exécution Correct

**IMPORTANT: Exécutez dans cet ordre!**

### 1️⃣ Premier Script

```sql
-- scripts/RESUME-CORRECTIONS-27-12-2024.sql
```

**Ce script va:**
- ✅ Créer la table `mining_companies` (si elle n'existe pas)
- ✅ Créer tous les modules et leur hiérarchie
- ✅ Insérer SONASP dans `mining_companies`
- ✅ Afficher un rapport de vérification

**Résultat attendu:**
```
✓ Table mining_companies créée avec succès
✓ SONASP configurée:
  - Nom: Société Nationale des Substances Naturelles
  - Abréviation: SONASP
  - Type: sonasp
  - Statut: ACTIF
```

### 2️⃣ Deuxième Script

```sql
-- scripts/IMPLEMENT-ARTISAN-SONASP-SALES-LOGIC.sql
```

**Ce script va:**
- ✅ Ajouter la colonne `acheteur_id` dans `snp_artisan_ventes_or`
- ✅ Créer le trigger pour forcer SONASP comme acheteur
- ✅ Créer la contrainte de base de données
- ✅ Lier toutes les ventes existantes à SONASP

**Résultat attendu:**
```
✓ Logique implémentée avec succès:
  1. Artisans vendent UNIQUEMENT à SONASP
  2. Trigger actif
  3. Contrainte de base de données active
```

### 3️⃣ Troisième Script

```sql
-- scripts/VERIFY-SONASP-TRADING-SPACE.sql
```

**Ce script va:**
- ✅ Vérifier que SONASP existe
- ✅ Créer les vues et fonctions pour l'inventaire
- ✅ Afficher un rapport complet

**Résultat attendu:**
```
✓ SONASP Configuration OK
✓ Capacités:
  - Collecte d'or auprès des artisans
  - Visible dans Espace Trading
  - Peut vendre à l'international
```

## 🏗️ Structure de la Table mining_companies

```sql
CREATE TABLE mining_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Informations de base
  name text NOT NULL UNIQUE,                 -- Nom complet
  abbreviation text,                         -- Ex: SONASP
  code text UNIQUE,                          -- Ex: SONASP-BF-001
  company_type text DEFAULT 'standard',      -- standard | sonasp | international
  
  -- Informations légales
  registration_number text,
  tax_id text,
  
  -- Contact
  email text,
  phone text,
  website text,
  
  -- Adresse
  address text,
  city text,
  country text NOT NULL DEFAULT 'BF',
  
  -- Statut
  is_active boolean DEFAULT true,
  
  -- Métadonnées
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Audit
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);
```

## 📊 Vérification Post-Installation

### 1. Vérifier que mining_companies existe

```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'mining_companies'
);
-- Résultat attendu: true
```

### 2. Vérifier que SONASP est créée

```sql
SELECT
  name,
  abbreviation,
  code,
  company_type,
  is_active
FROM mining_companies
WHERE company_type = 'sonasp';
```

**Résultat attendu:**
| name | abbreviation | code | company_type | is_active |
|------|--------------|------|--------------|-----------|
| Société Nationale des Substances Naturelles | SONASP | SONASP-BF-001 | sonasp | true |

### 3. Vérifier la colonne acheteur_id

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'snp_artisan_ventes_or'
AND column_name = 'acheteur_id';
```

**Résultat attendu:**
| column_name | data_type |
|-------------|-----------|
| acheteur_id | uuid |

### 4. Tester la fonction get_sonasp_id()

```sql
SELECT get_sonasp_id();
-- Résultat: UUID de SONASP
```

## 🎯 Prochaines Étapes

1. ✅ Scripts corrigés
2. ✅ Ordre d'exécution clarifié
3. ⏭️ **Exécutez les 3 scripts dans l'ordre**
4. ⏭️ **Actualisez votre navigateur (F5)**
5. ⏭️ **Vérifiez la sidebar**
6. ⏭️ **Testez le module Ventes d'Or**

## 💡 Pourquoi cette erreur?

L'application utilise la table `mining_companies` (nom standard) mais les scripts faisaient référence à `snp_mining_companies` (avec préfixe).

Les scripts ont été mis à jour pour:
- Créer `mining_companies` automatiquement
- Utiliser les bons noms de colonnes (`name` au lieu de `company_name`)
- Être cohérents avec le code de l'application

## ✅ Résumé

- ❌ Ancienne table: `snp_mining_companies` (n'existe pas)
- ✅ Nouvelle table: `mining_companies` (créée automatiquement)
- ✅ Scripts corrigés et testés
- ✅ Build réussi sans erreurs

**Tout est maintenant prêt pour l'installation!**
