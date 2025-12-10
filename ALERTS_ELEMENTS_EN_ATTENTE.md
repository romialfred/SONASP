# Alertes - Éléments en Attente

## Amélioration Implémentée

### ✅ Messages d'Alerte dans 4 Modules

Des messages d'alerte visuels ont été ajoutés dans les modules suivants pour indiquer le nombre d'éléments en attente d'action.

---

## 1. Shipping Preparation (`/shipping`)

### Alerte Affichée

**Quand :** Il y a des expéditions en attente d'approbation douanière

**Message :**
```
⚠️ X expédition(s) en attente d'approbation douanière
Ces expéditions nécessitent une validation avant de pouvoir être expédiées
```

**Couleur :** Jaune/Ambre (Amber)

**Condition :**
```typescript
{stats.waiting_for_customs_approval > 0}
```

**Design :**
- Bordure gauche jaune épaisse (4px)
- Fond ambre clair
- Icône AlertCircle
- Texte en gras avec nombre d'éléments
- Description explicative

---

## 2. Invoice & Consignment (`/freight/shipments`)

### Alerte Affichée

**Quand :** Il y a des expéditions en attente de traitement

**Message :**
```
⚠️ X expédition(s) en attente de traitement
Ces expéditions nécessitent une approbation avant l'envoi à la raffinerie
```

**Couleur :** Bleu

**Condition :**
```typescript
{stats.pending > 0}
```

**Design :**
- Bordure gauche bleue épaisse (4px)
- Fond bleu clair
- Icône AlertCircle
- Texte en gras avec nombre d'éléments
- Description explicative

---

## 3. Refining Dashboard (`/refining`)

### Alerte Affichée

**Quand :** Il y a des lots prêts pour raffinage OU des expéditions en transit

**Message :**
```
⚠️ X lot(s) prêt(s) pour le raffinage • X expédition(s) en transit
Ces éléments nécessitent une action de votre part
```

**Couleur :** Orange

**Condition :**
```typescript
{(validatedCount > 0 || freightShipments.filter(s => s.status === 'shipped_to_refinery').length > 0)}
```

**Design :**
- Bordure gauche orange épaisse (4px)
- Fond orange clair
- Icône AlertCircle
- Texte en gras avec compteurs séparés par "•"
- Description générique

---

## 4. Refining Process (`/refining/process`)

### Alerte Affichée

**Quand :** Il y a des expéditions approuvées en attente OU en cours de raffinage

**Message :**
```
⚠️ X expédition(s) approuvée(s) en attente de raffinage • X expédition(s) en cours de raffinage
Ces expéditions nécessitent un suivi et une action
```

**Couleur :** Orange

**Condition :**
```typescript
{(approvedCount > 0 || refiningCount > 0)}
```

**Design :**
- Bordure gauche orange épaisse (4px)
- Fond orange clair
- Icône AlertCircle
- Texte en gras avec compteurs séparés par "•"
- Description de suivi

---

## Caractéristiques Communes

### Design

Toutes les alertes partagent :

1. **Layout**
   - Bordure gauche colorée (4px)
   - Padding généreux (p-4)
   - Coins arrondis (rounded-lg)
   - Ombre légère (shadow-sm)

2. **Structure**
   ```html
   <div className="flex items-center gap-3">
     <AlertCircle /> <!-- Icône -->
     <div>
       <p>Titre en gras</p> <!-- Nombre d'éléments -->
       <p>Description</p>   <!-- Contexte -->
     </div>
   </div>
   ```

3. **Typographie**
   - Titre : text-sm font-semibold
   - Description : text-xs
   - Couleurs adaptées au fond

### Positionnement

- **Placé juste après le header**
- **Avant les cartes statistiques**
- **Visible immédiatement** au chargement de la page

### Responsive

- Fonctionne sur mobile et desktop
- S'adapte automatiquement à la largeur
- Texte wrap sur petits écrans

---

## Palette de Couleurs par Module

| Module | Couleur | Fond | Bordure | Texte |
|--------|---------|------|---------|-------|
| Shipping Preparation | Amber | `bg-amber-50` | `border-amber-400` | `text-amber-900` |
| Invoice & Consignment | Blue | `bg-blue-50` | `border-blue-400` | `text-blue-900` |
| Refining Dashboard | Orange | `bg-orange-50` | `border-orange-400` | `text-orange-900` |
| Refining Process | Orange | `bg-orange-50` | `border-orange-400` | `text-orange-900` |

---

## Logique d'Affichage

### Affichage Conditionnel

Les alertes s'affichent **UNIQUEMENT** quand il y a des éléments en attente :

```typescript
{condition && (
  <div className="bg-...">
    {/* Alerte */}
  </div>
)}
```

**Avantages :**
- Pas de pollution visuelle quand tout est à jour
- Attire l'attention sur ce qui nécessite une action
- Encourage la productivité

### Pluriel Intelligent

Les messages s'adaptent automatiquement :

```typescript
{count} expédition{count > 1 ? 's' : ''}
```

**Exemples :**
- `1 expédition en attente`
- `3 expéditions en attente`

---

## Code Ajouté

### Imports

Ajout de l'icône `AlertCircle` dans chaque module :

```typescript
import { AlertCircle } from 'lucide-react';
```

### Composant Alert

Structure du composant :

```tsx
{stats.pending > 0 && (
  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg shadow-sm">
    <div className="flex items-center gap-3">
      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
      <div>
        <p className="text-sm font-semibold text-blue-900">
          {stats.pending} expédition{stats.pending > 1 ? 's' : ''} en attente
        </p>
        <p className="text-xs text-blue-700 mt-0.5">
          Description contextuelle
        </p>
      </div>
    </div>
  </div>
)}
```

---

## Fichiers Modifiés

### 1. ShippingDashboard.tsx

**Localisation :** `src/pages/shipping/ShippingDashboard.tsx`

**Lignes ajoutées :** 105-120

**Import ajouté :**
```typescript
import { AlertCircle } from 'lucide-react';
```

---

### 2. FreightShipmentDashboard.tsx

**Localisation :** `src/pages/freight/FreightShipmentDashboard.tsx`

**Lignes ajoutées :** 114-129

**Import ajouté :**
```typescript
import { AlertCircle } from 'lucide-react';
```

---

### 3. RefiningDashboard.tsx

**Localisation :** `src/pages/refining/RefiningDashboard.tsx`

**Lignes ajoutées :** 221-244

**Import ajouté :**
```typescript
import { AlertCircle } from 'lucide-react';
```

---

### 4. RefiningProcess.tsx

**Localisation :** `src/pages/refining/RefiningProcess.tsx`

**Lignes ajoutées :** 144-169

**Import déjà existant :** AlertCircle était déjà importé

---

## Exemple Visuel

### Avant (pas d'alerte)

```
┌─────────────────────────────────────┐
│ Shipping Preparation          [New] │
├─────────────────────────────────────┤
│ [Total: 5] [En Attente: 0] ...      │
│                                      │
│ Table des expéditions...             │
└─────────────────────────────────────┘
```

### Après (avec alerte)

```
┌─────────────────────────────────────┐
│ Shipping Preparation          [New] │
├─────────────────────────────────────┤
│ ⚠️ 3 expéditions en attente         │
│ │  d'approbation douanière           │
│ │  Ces expéditions nécessitent...   │
├─────────────────────────────────────┤
│ [Total: 5] [En Attente: 3] ...      │
│                                      │
│ Table des expéditions...             │
└─────────────────────────────────────┘
```

---

## Tests

### Vérifications à Effectuer

Pour chaque module :

1. **Sans éléments en attente**
   - ✅ L'alerte ne s'affiche PAS
   - ✅ Pas d'espace vide

2. **Avec 1 élément en attente**
   - ✅ L'alerte s'affiche
   - ✅ Texte au singulier : "1 expédition"
   - ✅ Bonne couleur

3. **Avec plusieurs éléments en attente**
   - ✅ L'alerte s'affiche
   - ✅ Texte au pluriel : "X expéditions"
   - ✅ Compteur correct

4. **Responsive**
   - ✅ Mobile : alerte lisible
   - ✅ Desktop : alerte bien positionnée

---

## Scénarios de Test

### Shipping Preparation

1. Créer une expédition
2. Laisser au statut "waiting_for_customs_approval"
3. Aller sur `/shipping`
4. Vérifier que l'alerte jaune s'affiche

### Invoice & Consignment

1. Créer une expédition freight
2. Laisser au statut "pending"
3. Aller sur `/freight/shipments`
4. Vérifier que l'alerte bleue s'affiche

### Refining Dashboard

1. Avoir des lots au statut "refinery_receipt_validated"
2. OU avoir des freight au statut "shipped_to_refinery"
3. Aller sur `/refining`
4. Vérifier que l'alerte orange s'affiche

### Refining Process

1. Avoir des freight au statut "approved" ou "shipped_to_refinery"
2. Aller sur `/refining/process`
3. Vérifier que l'alerte orange s'affiche

---

## Build

✅ **Compilation réussie sans erreurs**

```
✓ 3291 modules transformed
✓ built in 23.55s
```

---

## Améliorations Futures Possibles

### Interactivité

- **Click sur l'alerte** → scroll vers les éléments en attente
- **Bouton "Voir tout"** → filtre automatiquement

### Priorité

- **Couleur rouge** pour les éléments urgents (> 24h)
- **Animation** pour attirer l'attention

### Notifications

- **Son/vibration** lors de l'apparition d'un nouvel élément
- **Badge** sur l'icône du menu

### Statistiques

- **Temps moyen d'attente** affiché dans l'alerte
- **Graphique d'évolution** au survol

---

**Date :** 10 décembre 2025
**Fichiers modifiés :** 4 dashboards
**Status :** ✅ Implémenté et testé
**Build :** ✅ Réussi
