# ✅ MODULE BUSINESS RULES - PARAMÉTRAGE RÉVISÉ

## Vue d'Ensemble

Le module Business Rules dans les Paramètres a été réorganisé pour une meilleure clarté et une gestion plus intuitive. Seul le fichier `ParametersPage.tsx` a été modifié.

---

## Ce Qui a Été Modifié

### 1. ✅ Réorganisation des Sections

Le module Business Rules est maintenant divisé en **4 sections distinctes** :

#### 📊 **Section 1: Conversion Rates** (Inchangée)
- Taux de conversion grams/ounces
- Taux de conversion kg/ounces

#### ⚖️ **Section 2: Seuils de Variance des Poids** (NOUVELLE)
Affichage séparé et clair pour les deux seuils principaux:

**Seuil Usine → Aéroport**
- Variance maximale acceptable entre le poids de l'usine et l'aéroport
- Par défaut: 2.0%
- Icône: Balance (Scale) avec fond jaune-ambre

**Seuil Aéroport → Raffinerie**
- Variance maximale acceptable entre le poids de l'aéroport et la raffinerie
- Par défaut: 1.5%
- Icône: Balance (Scale) avec fond jaune-ambre

#### 💰 **Section 3: Configuration du Cours de l'Or** (NOUVELLE)
Nouvelle section dédiée aux paramètres liés au cours de l'or:

- **Marge sur London AM** - Marge appliquée sur le cours (ex: 2.5%)
- **Prix Minimum de l'Or** - Protection contre erreurs (ex: 1800 USD/oz)
- **Prix Maximum de l'Or** - Protection contre erreurs (ex: 3000 USD/oz)
- **Pourcentage Royalties** - Royalties net smelted (ex: 3.0%)
- **Frais de Transport par Défaut** - Frais d'expédition (ex: 500 USD)

Icône: Dollar ($) avec fond jaune

#### 🔴 **Section 4: Autres Seuils de Contrôle** (Conditionnelle)
Affiche automatiquement les autres thresholds s'ils existent:
- Exemple: Seuil de perte au raffinage (Refining Loss)
- Icône: Triangle d'alerte avec fond rouge

---

## Comment Utiliser

### Accéder au Module

1. Connexion en tant qu'utilisateur **Management**
2. Navigation: **Administration → Paramètres**
3. Onglet: **Business Rules**

### Configurer les Seuils de Poids

Dans la section **"Seuils de Variance des Poids"** :

1. **Seuil Usine → Aéroport** : Modifiez la valeur (ex: 0.8 pour 0.8%)
2. **Seuil Aéroport → Raffinerie** : Modifiez la valeur (ex: 0.5 pour 0.5%)
3. Cliquez sur **"Save Business Rules"**

### Configurer le Cours de l'Or

Dans la section **"Configuration du Cours de l'Or"** :

1. Si aucune règle n'existe, un message s'affiche:
   - "Aucune règle de cours d'or configurée"
   - Instructions pour ajouter des règles

2. Pour ajouter les règles, exécutez le script SQL:
   - Fichier: `ADD_GOLD_PRICE_RULES.sql`
   - Via: Supabase SQL Editor

3. Une fois les règles ajoutées, elles apparaissent automatiquement:
   - Marge sur London AM
   - Prix Minimum/Maximum
   - Pourcentage Royalties
   - Frais de Transport

---

## Script SQL pour le Cours de l'Or

### Fichier: `ADD_GOLD_PRICE_RULES.sql`

Ce script ajoute 5 règles par défaut pour le cours de l'or:

```sql
-- 1. Marge sur London AM (2.5%)
-- 2. Prix Minimum (1800 USD/oz)
-- 3. Prix Maximum (3000 USD/oz)
-- 4. Pourcentage Royalties (3.0%)
-- 5. Frais de Transport (500 USD)
```

### Comment Appliquer

1. **Via Supabase Dashboard**:
   ```
   Projet → SQL Editor → New Query
   ```

2. **Copier-coller** le contenu de `ADD_GOLD_PRICE_RULES.sql`

3. **Exécuter** la requête

4. **Vérifier** que les 5 règles apparaissent:
   ```sql
   SELECT * FROM business_rules WHERE rule_category = 'gold_price';
   ```

5. **Rafraîchir** la page des Paramètres

6. Les règles apparaissent maintenant dans la section "Configuration du Cours de l'Or"

---

## Structure Visuelle

### Avant (Ancien)
```
┌─────────────────────────────────┐
│ Conversion Rates                │
│ - Grams to Ounces              │
│ - Kg to Ounces                 │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Variance Thresholds             │
│ - Mine to Airport              │
│ - Airport to Refinery          │
│ - Refining Loss                │
└─────────────────────────────────┘
```

### Après (Nouveau)
```
┌─────────────────────────────────┐
│ 📊 Conversion Rates             │
│ - Grams to Ounces              │
│ - Kg to Ounces                 │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ ⚖️  Seuils de Variance des Poids│
│ - Seuil Usine → Aéroport       │
│ - Seuil Aéroport → Raffinerie  │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ 💰 Configuration du Cours de l'Or│
│ - Marge sur London AM          │
│ - Prix Minimum                 │
│ - Prix Maximum                 │
│ - Pourcentage Royalties        │
│ - Frais de Transport           │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ 🔴 Autres Seuils de Contrôle    │
│ - Refining Loss                │
│ (si existant)                  │
└─────────────────────────────────┘
```

---

## Avantages de la Nouvelle Organisation

✅ **Séparation Claire** - Les seuils de poids sont maintenant dans leur propre section

✅ **Section Dédiée** - Le cours de l'or a sa propre section avec icône dorée

✅ **Traduction Française** - Tous les libellés sont en français

✅ **Icônes Distinctes** - Chaque section a une icône et couleur spécifique:
- 📊 Bleu pour conversions
- ⚖️ Ambre pour poids
- 💰 Jaune pour or
- 🔴 Rouge pour autres seuils

✅ **État Vide Géré** - Message informatif si aucune règle d'or n'existe

✅ **Extensible** - Facile d'ajouter de nouvelles règles dans n'importe quelle catégorie

---

## Règles d'Or Disponibles

### 1. Marge sur London AM
- **Clé**: `gold_price_margin_london_am`
- **Défaut**: 2.5%
- **Usage**: Marge appliquée sur le cours London AM

### 2. Prix Minimum
- **Clé**: `gold_price_minimum`
- **Défaut**: 1800 USD/oz
- **Usage**: Validation - empêche les prix trop bas

### 3. Prix Maximum
- **Clé**: `gold_price_maximum`
- **Défaut**: 3000 USD/oz
- **Usage**: Validation - empêche les prix trop élevés

### 4. Pourcentage Royalties
- **Clé**: `gold_royalty_percentage`
- **Défaut**: 3.0%
- **Usage**: Calcul des royalties net smelted

### 5. Frais de Transport
- **Clé**: `gold_freight_cost_default`
- **Défaut**: 500 USD
- **Usage**: Frais d'expédition par défaut

---

## Fichiers Modifiés

### Fichier Unique Modifié
- ✅ `src/pages/admin/ParametersPage.tsx`

### Modifications Apportées
1. Import de l'icône `DollarSign`
2. Restructuration des cartes Business Rules
3. Ajout de la section "Seuils de Variance des Poids"
4. Ajout de la section "Configuration du Cours de l'Or"
5. Section "Autres Seuils" conditionnelle
6. Traduction française des libellés

### Aucune Autre Modification
- ❌ Aucun service modifié
- ❌ Aucune base de données modifiée (sauf si vous exécutez le SQL)
- ❌ Aucun autre module touché
- ❌ Aucun composant UI modifié

---

## Utilisation dans le Code

### Récupérer une Règle d'Or

```typescript
import { getBusinessRuleValue } from '@/services/businessRulesService';

// Récupérer la marge London AM
const margin = await getBusinessRuleValue('gold_price_margin_london_am');
// Retourne: 2.5

// Récupérer le prix minimum
const minPrice = await getBusinessRuleValue('gold_price_minimum');
// Retourne: 1800
```

### Valider un Prix

```typescript
const goldPrice = 2500; // USD/oz
const minPrice = await getBusinessRuleValue('gold_price_minimum');
const maxPrice = await getBusinessRuleValue('gold_price_maximum');

if (goldPrice < minPrice || goldPrice > maxPrice) {
  console.error('Prix hors limites!');
}
```

### Calculer avec Marge

```typescript
const londonAM = 2600; // USD/oz
const margin = await getBusinessRuleValue('gold_price_margin_london_am');

const sellingPrice = londonAM * (1 + margin / 100);
// Résultat: 2665 USD/oz (avec marge de 2.5%)
```

---

## Test de la Configuration

### 1. Vérifier l'Interface
- ✅ Ouvrir Administration → Paramètres → Business Rules
- ✅ Vérifier que les 4 sections s'affichent
- ✅ Vérifier les icônes et couleurs

### 2. Tester les Seuils de Poids
- ✅ Modifier le seuil Usine → Aéroport à 0.8%
- ✅ Sauvegarder
- ✅ Vérifier la mise à jour

### 3. Ajouter les Règles d'Or
- ✅ Exécuter `ADD_GOLD_PRICE_RULES.sql`
- ✅ Rafraîchir la page
- ✅ Vérifier que 5 règles apparaissent

### 4. Modifier une Règle d'Or
- ✅ Changer la marge à 3.0%
- ✅ Sauvegarder
- ✅ Vérifier la persistance

---

## État de Build

✅ **Build Réussi**
- Aucune erreur de compilation
- Aucun warning TypeScript
- Bundle généré correctement

✅ **Prêt pour Déploiement**
- Fichier unique modifié
- Aucun impact sur autres modules
- Rétrocompatible

---

## Résumé

✅ Module Business Rules réorganisé avec 4 sections claires
✅ Section dédiée "Seuils de Variance des Poids" (Usine-Aéroport, Aéroport-Raffinerie)
✅ Nouvelle section "Configuration du Cours de l'Or" avec 5 règles
✅ Interface en français avec icônes distinctives
✅ Script SQL fourni pour ajouter les règles d'or
✅ Aucun autre module touché
✅ Build réussi et prêt à utiliser

**Fichiers à consulter:**
- Interface modifiée: `src/pages/admin/ParametersPage.tsx`
- Script SQL: `ADD_GOLD_PRICE_RULES.sql`
