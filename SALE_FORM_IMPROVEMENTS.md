# Sale Creation Form - Design & Functionality Improvements (Updated)

## Latest Improvements - October 29, 2025

### 1. Sale Calculations Report - Reduced Line Spacing
- **Changement:** Suppression de `max-w-4xl` sur le conteneur principal
- **Résultat:** Le formulaire occupe maintenant toute la largeur disponible à gauche du Field Guide

### 2. Affichage Amélioré de la Carte Mécanisme
La carte du mécanisme de pricing affiche maintenant:
- **Nom et description du mécanisme** (Spot Basis, Forward 7 days, etc.)
- **Prix par once** avec ajustement en pourcentage
- **Quantité provenant de la simulation** - Nouvelle section
- **Montant brut à payer** - Calcul automatique (Quantité × Prix)

```
┌─────────────────────────────────────────────────┐
│ Selected Pricing Mechanism                      │
│ Spot Basis                                      │
│ Payment and delivery within 2 business days     │
│                                     $2570.43    │
├─────────────────────────────────────────────────┤
│ Quantity from Simulation    Gross Amount        │
│ 35 oz                       $89,965.05         │
└─────────────────────────────────────────────────┘
```

### 3. Verrouillage du Prix
- **Quand venant d'une simulation:** Le champ prix est désactivé (disabled)
- **Indicateur visuel:** Fond vert émeraude + texte "Price is locked"
- **Modification autorisée:** Seule la quantité peut être modifiée

### 4. Amélioration de la Requête Customers
- **Requête optimisée:** Sélection explicite des colonnes nécessaires
- **Gestion des erreurs:** Messages d'erreur clairs pour l'utilisateur
- **Logs de débogage:** Console.log pour diagnostiquer les problèmes
- **Filtrage intelligent:** Gère les cas où status peut être NULL

## Problème Potentiel: Customers Non Affichés

### Causes Possibles
1. **Row Level Security (RLS):** Les politiques RLS peuvent bloquer l'accès aux customers
2. **Données manquantes:** La table customers peut être vide
3. **Permissions utilisateur:** L'utilisateur connecté n'a pas les droits de lecture

### Solution de Diagnostic

Exécutez le fichier SQL `check-customers.sql` dans votre SQL Editor Supabase:

```sql
-- Vérifier le nombre de customers
SELECT COUNT(*) as total_customers FROM customers;

-- Voir tous les customers
SELECT id, name, email, country, status
FROM customers
ORDER BY name;

-- Vérifier les politiques RLS
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'customers';
```

### Actions Correctives

#### Option 1: Ajuster les RLS Policies
Si les customers existent mais ne s'affichent pas, créez/modifiez la politique RLS:

```sql
-- Permettre la lecture des customers pour les utilisateurs authentifiés
CREATE POLICY "Authenticated users can read customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);
```

#### Option 2: Créer des Customers de Test
Si la table est vide:

```sql
INSERT INTO customers (name, email, country, status) VALUES
  ('ABC Gold Refinery', 'contact@abcgold.com', 'Switzerland', 'active'),
  ('XYZ Metals Trading', 'info@xyzmetals.com', 'United Arab Emirates', 'active'),
  ('Global Precious Metals', 'sales@globalpm.com', 'United States', 'active');
```

## Migration Requise

N'oubliez pas d'exécuter la migration pour ajouter `mechanism_type` et `customer_pending`:

```sql
-- Fichier: 20251029080000_add_mechanism_type_and_customer_pending_status.sql
```

Cette migration ajoute:
- Colonne `mechanism_type` dans la table `sales`
- Status `customer_pending` aux valeurs autorisées

## Test du Flux Complet

1. **Gold Trade Space** → Simuler un prix
2. **Cliquer "Continue"** → Navigation vers Create Sale
3. **Vérifier:**
   - Prix pré-rempli et verrouillé
   - Quantité pré-remplie mais modifiable
   - Carte du mécanisme affiche quantité et montant brut
   - Liste des customers s'affiche correctement
4. **Compléter le formulaire** et soumettre

## Résumé des Fichiers Modifiés

- `src/pages/sales/SaleCreate.tsx` - Formulaire de création de vente
- `supabase/migrations/20251029080000_add_mechanism_type_and_customer_pending_status.sql` - Migration DB
- `check-customers.sql` - Script de diagnostic

## Prochaines Étapes

1. Exécuter la migration dans Supabase
2. Vérifier que les customers existent et sont accessibles
3. Tester le flux de simulation → création de vente
4. Ajuster les RLS policies si nécessaire
