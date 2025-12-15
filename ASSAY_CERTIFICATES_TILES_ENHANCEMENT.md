# Améliorations des Tuiles - Module Assay Certificates

## Résumé des Améliorations

Le module Assay Certificates a été enrichi avec des tuiles colorées, des informations lisibles, et des animations interactives.

---

## 1. Tuiles Colorées avec Gradients

### Avant
- Tuiles uniformes en blanc/gris
- Border gauche en Deep Gold uniquement

### Après
**6 variations de couleurs en rotation:**
- **Bleu:** `from-blue-50 to-blue-100 border-l-4 border-blue-500`
- **Émeraude:** `from-emerald-50 to-emerald-100 border-l-4 border-emerald-500`
- **Ambre:** `from-amber-50 to-amber-100 border-l-4 border-amber-500`
- **Violet:** `from-purple-50 to-purple-100 border-l-4 border-purple-500`
- **Rose:** `from-rose-50 to-rose-100 border-l-4 border-rose-500`
- **Cyan:** `from-cyan-50 to-cyan-100 border-l-4 border-cyan-500`

Les tuiles alternent automatiquement entre ces couleurs pour une meilleure distinction visuelle.

---

## 2. Suppression des Références UUID

### Avant
```
bb3a4d5e-1234-5678-abcd-123456789abc_Certificat_Analyse.pdf
```

### Après
```
Certificat_Analyse
```

**Implémentation:**
```typescript
cert.file_name.replace(/^[a-f0-9-]+_/, '').replace(/\.[^.]+$/, '')
```
- Supprime le préfixe UUID (format: `bb3a4d5e-...`)
- Retire l'extension de fichier (.pdf)
- Affiche seulement le nom lisible

---

## 3. Informations Lisibles et Formatées

### Poids
**Avant:** `44200g`
**Après:** `44.20 kg`
```typescript
{(shipping.total_net_weight_grams / 1000).toFixed(2)} kg
```

### Dates
**Avant:** `2025-01-15`
**Après:** `15 janv. 2025`
```typescript
new Date(shipping.created_at).toLocaleDateString('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
})
```

### Informations dans des Badges
- Chaque information (destinataire, poids, date) est dans un badge `bg-white/50`
- Icônes colorées pour identifier rapidement
- Typographie medium pour meilleure lisibilité

---

## 4. Icône Œil Colorée Dynamiquement

### Logique de Couleur
```typescript
className={`
  ${cert.approval_status === 'approved'
    ? 'bg-emerald-500 hover:bg-emerald-600'  // Vert si approuvé
    : 'bg-blue-500 hover:bg-blue-600'        // Bleu sinon
  }
  text-white shadow-md hover:shadow-lg
`}
```

**Résultat:**
- **Certificat Approuvé** → Bouton **Vert Émeraude** avec icône œil blanc
- **Certificat En Attente/Rejeté** → Bouton **Bleu** avec icône œil blanc
- Shadow animée au survol
- Taille: 32px × 32px (h-8 w-8)

---

## 5. Bordure Dynamique Animée au Survol

### Animation Interactive
```typescript
onMouseEnter={(e) => {
  const color = hasApproved
    ? 'rgba(16, 185, 129, 0.6)'   // Vert émeraude si approuvé
    : 'rgba(239, 68, 68, 0.6)';   // Rouge si en attente

  e.currentTarget.style.boxShadow = `0 0 0 3px ${color}, 0 10px 30px rgba(0,0,0,0.15)`;
  e.currentTarget.style.transform = 'translateY(-2px)';
}}

onMouseLeave={(e) => {
  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
  e.currentTarget.style.transform = 'translateY(0)';
}}
```

**Effet Visuel:**
1. **Au survol:** Bordure de 3px apparaît autour de la tuile
2. **Couleur:** Verte (certificats approuvés) ou Rouge (en attente)
3. **Animation:** La tuile se soulève légèrement (-2px)
4. **Shadow:** Ombre profonde pour effet de profondeur
5. **Transition:** Fluide en 300ms

---

## 6. Badges de Données d'Analyse

### Contenu d'Or (Au)
```html
<div className="bg-yellow-100 px-2 py-0.5 rounded">
  <span className="font-bold text-yellow-800">Au:</span>
  <span className="font-bold text-yellow-900">95.5 g/t</span>
</div>
```
- Background jaune doré
- Texte en gras
- Format: "Au: X g/t"

### Pureté
```html
<div className="bg-amber-100 px-2 py-0.5 rounded">
  <span className="font-semibold text-amber-800">99.9%</span>
</div>
```
- Background ambre
- Format: "X%"

---

## 7. Design Hiérarchique

### Structure de la Tuile
1. **Header:**
   - Icône Ship dans badge blanc semi-transparent
   - Numéro d'expédition en gras (text-base)
   - Bouton "+" pour ajouter

2. **Informations d'Expédition:**
   - 3 badges avec fond blanc/50
   - Icônes colorées (Package, Scale, Calendar)
   - Texte medium

3. **Section Certificats:**
   - Header "Certificats (X)" dans badge blanc/60
   - Liste de certificats avec:
     - Nom nettoyé (sans UUID)
     - Badges de données (Au, Pureté)
     - Date formatée
     - Badge de statut
     - Bouton œil coloré

---

## 8. États et Interactions

### État Normal
- Tuile avec gradient coloré
- Shadow légère
- Border gauche colorée

### État Hover (Survol)
- **Tuile entière:**
  - Bordure animée (verte ou rouge)
  - Élévation (-2px)
  - Shadow profonde
- **Certificats:**
  - Background blanc opaque
  - Shadow medium
- **Bouton œil:**
  - Shadow plus importante
  - Effet d'agrandissement

### État Vide (Pas de Certificats)
- Zone en pointillés
- Icône et message centré
- Bouton d'ajout suggéré

---

## Exemple Visuel de Tuile

```
┌─────────────────────────────────────┐
│ 🚢 HUM-KGM-0006/2025            [+] │  ← Header
│                                     │
│ 📦 Liberia Refinery              │  ← Destinataire
│ ⚖️  22.94 kg                      │  ← Poids
│ 📅 15 janv. 2025                 │  ← Date
│─────────────────────────────────────│
│ Certificats (2)                     │
│                                     │
│ 📄 Certificat_Analyse              │
│    [Au: 95.5 g/t] [99.9%]         │
│    📅 10 janv. 2025                │
│    [Approuvé] [👁️ Vert]          │  ← Bouton œil vert
│                                     │
│ 📄 Certificat_Pureté               │
│    [Au: 92.3 g/t]                  │
│    📅 12 janv. 2025                │
│    [En Attente] [👁️ Bleu]        │  ← Bouton œil bleu
└─────────────────────────────────────┘
     ↑ Bordure verte au survol
```

---

## Palette de Couleurs

### Tuiles
- Bleu: `#3B82F6` / `#DBEAFE`
- Émeraude: `#10B981` / `#D1FAE5`
- Ambre: `#F59E0B` / `#FEF3C7`
- Violet: `#A855F7` / `#F3E8FF`
- Rose: `#F43F5E` / `#FFE4E6`
- Cyan: `#06B6D4` / `#CFFAFE`

### Boutons Œil
- **Approuvé:** Émeraude `#10B981` → `#059669` (hover)
- **En Attente:** Bleu `#3B82F6` → `#2563EB` (hover)

### Bordures Animées
- **Certificats Approuvés:** `rgba(16, 185, 129, 0.6)` (vert transparent)
- **Certificats En Attente:** `rgba(239, 68, 68, 0.6)` (rouge transparent)

### Badges de Données
- **Au (Or):** Jaune `#FEF3C7` / `#92400E`
- **Pureté:** Ambre `#FEF3C7` / `#92400E`

---

## Responsive Design

### Mobile (1 colonne)
- Tuiles pleine largeur
- Informations empilées
- Boutons adaptés

### Tablette (2 colonnes)
- Grille 2×N
- Espacement optimisé

### Desktop (3 colonnes)
- Grille 3×N
- Vue d'ensemble complète

---

## Build Status

✅ Build réussi sans erreur
✅ TypeScript validé
✅ Animations fluides
✅ Performance optimisée

---

## Impact Utilisateur

1. **Visibilité améliorée:** Couleurs permettent d'identifier rapidement les expéditions
2. **Information claire:** Données formatées en français, sans codes techniques
3. **Interaction intuitive:** Bordure colorée indique le statut au survol
4. **Action rapide:** Bouton œil coloré selon statut d'approbation
5. **Esthétique moderne:** Gradients et animations professionnelles
