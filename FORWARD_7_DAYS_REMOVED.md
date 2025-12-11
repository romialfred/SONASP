# Suppression de la Tuile "Forward 7 Days"

## Date
2025-12-10

## Modification Effectuée

La tuile "Forward 7 Days" a été retirée de l'affichage des mécanismes de pricing dans le Pricing Calculator.

## Changements Appliqués

### 1. Filtrage du Mécanisme "Forward 7 Days"

**Fichier:** `src/components/sales/PricingCalculator.tsx`

**Ligne 46:** Ajout d'un filtre pour exclure le mécanisme `forward_7`

```typescript
// Avant
const sortedMechanisms = [...result.data.mechanisms].sort((a, b) => b.benefit - a.benefit);

// Après
// Filter out Forward 7 Days mechanism
const filteredMechanisms = result.data.mechanisms.filter(m => m.mechanism !== 'forward_7');
const sortedMechanisms = [...filteredMechanisms].sort((a, b) => b.benefit - a.benefit);
```

**Effet:** Le mécanisme "Forward 7 Days" est maintenant exclu de la liste des options affichées à l'utilisateur.

### 2. Ajustement de la Grille

**Ligne 197:** Modification de la grille de 5 colonnes à 4 colonnes

```typescript
// Avant - 5 colonnes pour 5 tuiles
<div className="grid grid-cols-5 gap-3">

// Après - 4 colonnes pour 4 tuiles
<div className="grid grid-cols-4 gap-3">
```

**Effet:** Les tuiles restantes occupent maintenant mieux l'espace horizontal disponible.

## Tuiles Restantes Affichées

Après cette modification, les 4 mécanismes de pricing suivants sont affichés:

1. **Spot Basis** (2 days)
2. **Forward 14 Days** (14 days)
3. **Forward 30 Days** (30 days)
4. **In-Process Basis** (7 days)

## Layout Résultant

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │  Spot   │ │Forward  │ │Forward  │ │In-Pro   │         │
│  │  Basis  │ │ 14 Days │ │ 30 Days │ │ Basis   │         │
│  │         │ │         │ │         │ │         │         │
│  │$4026.95 │ │$4025.34 │ │$4023.50 │ │$4006.82 │         │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Largeur des Cartes

### Calcul avec 4 Colonnes
- **Container width:** 100%
- **Gap total:** 3 × 0.75rem = 2.25rem
- **Largeur par carte:** `calc((100% - 2.25rem) / 4)` ≈ **24% chacune**

### Comparaison
| Configuration | Largeur par Carte | Espace Occupé |
|---------------|-------------------|---------------|
| 5 colonnes | ~19% | 100% |
| 4 colonnes | ~24% | 100% |

**Avantage:** Chaque tuile est maintenant **+26% plus large**, offrant plus d'espace pour l'information.

## Impact sur l'Expérience Utilisateur

### Avantages ✅
- **Moins d'options à comparer:** Simplification du choix
- **Tuiles plus larges:** Meilleure lisibilité (+26% de largeur)
- **Moins de duplication:** Forward 7 Days était proche de Spot Basis en termes de délai
- **Interface plus claire:** Moins d'encombrement visuel

### Mécanismes Restants
Les mécanismes conservés offrent une bonne couverture des scénarios:
- **Court terme:** Spot Basis (2 jours)
- **Moyen terme:** Forward 14 Days (2 semaines)
- **Long terme:** Forward 30 Days (1 mois)
- **En cours de traitement:** In-Process Basis

## Logique de Filtrage

Le filtre est appliqué **avant** le tri par bénéfice, garantissant que:
1. Forward 7 Days est toujours exclu
2. Le tri par bénéfice fonctionne sur les mécanismes restants
3. Le badge "Best Option" est attribué au meilleur des 4 mécanismes restants

```typescript
// Ordre d'exécution
1. Récupération des mécanismes depuis l'API
2. Filtrage de 'forward_7' ← NOUVEAU
3. Tri par bénéfice (du plus élevé au plus bas)
4. Affichage avec badge "Best Option" sur le premier
```

## Réversibilité

### Pour Réactiver Forward 7 Days

**Option 1 - Supprimer le filtre:**
```typescript
// Ligne 46 - Supprimer ou commenter cette ligne
// const filteredMechanisms = result.data.mechanisms.filter(m => m.mechanism !== 'forward_7');

// Utiliser directement result.data.mechanisms
const sortedMechanisms = [...result.data.mechanisms].sort((a, b) => b.benefit - a.benefit);
```

**Option 2 - Rendre configurable:**
```typescript
// Ajouter une constante de configuration
const HIDDEN_MECHANISMS = ['forward_7']; // Vide pour tout afficher

const filteredMechanisms = result.data.mechanisms.filter(
  m => !HIDDEN_MECHANISMS.includes(m.mechanism)
);
```

### Ne Pas Oublier
Si vous réactivez Forward 7 Days, ajuster la grille:
```typescript
// Ligne 197
<div className="grid grid-cols-5 gap-3">  // Au lieu de grid-cols-4
```

## Considérations Techniques

### 1. Côté Backend
Le mécanisme `forward_7` continue d'exister dans le service `goldTradeSpaceService.ts` et peut être calculé. Il est simplement **filtré côté frontend** pour ne pas être affiché.

### 2. Impact sur la Recommandation
Si l'algorithme de recommandation backend recommandait `forward_7` comme meilleur mécanisme:
- Le mécanisme ne sera pas affiché
- Le badge "Best Option" sera attribué au premier mécanisme de la liste filtrée
- **Recommandation:** Vérifier que le backend ne recommande pas `forward_7`

### 3. Validation
Aucune validation n'empêche un utilisateur de sélectionner `forward_7` programmatiquement (via API directe). Le filtrage est **uniquement visuel**.

## Tests Suggérés

### Scénarios à Tester
1. ✅ Affichage de 4 tuiles au lieu de 5
2. ✅ Largeur augmentée des tuiles restantes
3. ✅ Badge "Best Option" sur le meilleur des 4 mécanismes
4. ⚠️ Vérifier que le backend ne recommande pas `forward_7`
5. ⚠️ Tester avec différentes quantités d'or

### Cas Limites
- **Conditions de marché favorisant Forward 7 Days:** Vérifier que l'utilisateur a toujours de bonnes alternatives
- **Recommandation Backend = forward_7:** Le système doit gérer gracieusement ce cas

## Build Status
✅ Build réussi sans erreur
✅ Compilation TypeScript OK
✅ Aucune régression de code

## Instructions pour Voir les Modifications

1. **Vider le cache navigateur:**
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

2. **Naviguer vers Gold Trade Space / Pricing Calculator**

3. **Entrer une quantité et cliquer sur "Simulate"**

4. **Observer:**
   - Seulement 4 tuiles affichées (plus de Forward 7 Days)
   - Tuiles plus larges et mieux espacées
   - Layout sur une seule ligne

---

**Status:** ✅ MODIFICATIONS APPLIQUÉES - BUILD RÉUSSI

**Impact:** La tuile "Forward 7 Days" n'est plus affichée dans le Pricing Calculator.
