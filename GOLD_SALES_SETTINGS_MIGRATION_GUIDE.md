# Migration Gold Sales Settings - Guide d'Application

## 📋 Résumé

Cette migration ajoute le champ `effective_date` (date de début d'application) à la table `gold_sales_settings` et améliore la structure avec des index et des commentaires.

## 🎯 Changements Apportés

### 1. Nouvelle Colonne
- **`effective_date`** (date) - Date de début d'application du paramétrage
  - Par défaut: Date du jour
  - Permet de tracer quand chaque paramétrage entre en vigueur

### 2. Amélioration de la Documentation
- Commentaires SQL sur toutes les colonnes pour meilleure compréhension
- Clarification Mine (Vendeur) / Client (Acheteur)

### 3. Optimisation des Performances
- Index composite sur `(mining_company_id, customer_id)` pour recherches rapides
- Index sur les paramètres actifs
- Index sur la date d'effet pour tri chronologique

## 📝 Instructions d'Application

### Étape 1: Ouvrir Supabase SQL Editor

1. Allez sur: **https://boolqagzdqbahqnpawpb.supabase.co**
2. Connectez-vous
3. Cliquez sur **"SQL Editor"** dans le menu de gauche
4. Cliquez sur **"New Query"**

### Étape 2: Copier le SQL

Copiez le contenu du fichier **`APPLY_GOLD_SALES_SETTINGS_MIGRATION.sql`** (à la racine du projet) :

```sql
-- Ajouter la colonne effective_date si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gold_sales_settings'
    AND column_name = 'effective_date'
  ) THEN
    ALTER TABLE gold_sales_settings
    ADD COLUMN effective_date date NOT NULL DEFAULT CURRENT_DATE;

    RAISE NOTICE 'Colonne effective_date ajoutée';
  ELSE
    RAISE NOTICE 'Colonne effective_date existe déjà';
  END IF;
END $$;

-- Ajouter des commentaires sur les colonnes pour documentation
COMMENT ON COLUMN gold_sales_settings.mining_company_id IS 'Mine (Vendeur)';
COMMENT ON COLUMN gold_sales_settings.customer_id IS 'Client (Acheteur)';
COMMENT ON COLUMN gold_sales_settings.max_stock_percentage IS 'Pourcentage maximum du stock vendable à ce client';
COMMENT ON COLUMN gold_sales_settings.sale_method IS 'Méthode de vente';
COMMENT ON COLUMN gold_sales_settings.refining_fees_paid_by_customer IS 'Frais de raffinage payés par le client';
COMMENT ON COLUMN gold_sales_settings.transport_fees_paid_by_customer IS 'Frais de transport payés par le client';
COMMENT ON COLUMN gold_sales_settings.is_active IS 'Paramétrage actif ou désactivé';
COMMENT ON COLUMN gold_sales_settings.effective_date IS 'Date de début d''application';

-- Ajouter un index composite pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_gold_sales_settings_mine_customer
ON gold_sales_settings(mining_company_id, customer_id);

-- Ajouter un index pour les paramètres actifs
CREATE INDEX IF NOT EXISTS idx_gold_sales_settings_active
ON gold_sales_settings(is_active) WHERE is_active = true;

-- Ajouter un index pour la date d'effet
CREATE INDEX IF NOT EXISTS idx_gold_sales_settings_effective_date
ON gold_sales_settings(effective_date DESC);
```

### Étape 3: Exécuter

1. Collez le SQL dans l'éditeur
2. Cliquez sur **"Run"** (ou Ctrl+Enter / Cmd+Enter)
3. Attendez la confirmation

### Étape 4: Vérifier

Vous devriez voir des messages comme:
```
✓ Colonne effective_date ajoutée
```

## ✅ Résultat

Après l'application, votre table `gold_sales_settings` aura:
- ✅ Le champ `effective_date` pour tracer la date d'application
- ✅ Des commentaires explicites sur chaque colonne
- ✅ Des index pour améliorer les performances
- ✅ Toutes les données existantes conservées avec `effective_date = CURRENT_DATE`

## 🎨 Nouveau Formulaire

Le nouveau formulaire professionnel inclut:

1. **Volet de droite moderne** (au lieu d'un modal)
2. **Toggle Actif/Désactivé** - Activez ou désactivez un paramétrage
3. **Date de début d'application** - Tracez quand le paramétrage entre en vigueur
4. **Mine (Vendeur)** - Avec affichage des informations complètes en bas
5. **Client (Acheteur)** - Avec affichage des informations complètes en bas
6. **Description des méthodes** - Chaque méthode de vente affiche sa description
7. **Interface professionnelle** - Cohérente avec le reste de l'application

## 📊 Impact

- ✅ **Aucune perte de données** - Migration sécurisée
- ✅ **Rétrocompatible** - Les paramètres existants reçoivent la date du jour
- ✅ **Performance améliorée** - Grâce aux nouveaux index
- ✅ **Meilleure UX** - Formulaire professionnel et informatif

## 🚀 Après la Migration

Une fois la migration appliquée, vous pouvez:
1. Créer de nouveaux paramétrages avec date de début personnalisée
2. Modifier les paramétrages existants
3. Activer/désactiver des paramétrages sans les supprimer
4. Tracer l'historique avec les dates d'effet

---

**Temps d'application: ~5 secondes**
**Risque: Aucun (idempotent et sécurisé)**
