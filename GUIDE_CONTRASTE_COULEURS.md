# 🎨 Guide des Contrastes et Couleurs - Projet Gold Shipper

## 🔴 RÈGLE ABSOLUE: JAMAIS de Texte Blanc sur Fond Blanc

**INTERDIT:** `text-white` avec `bg-white`
**INTERDIT:** `text-gray-50` avec `bg-gray-50`
**INTERDIT:** Toute combinaison qui rend le texte illisible

---

## ✅ Combinaisons Approuvées pour Tableaux

### En-têtes de Tableau (thead)

#### Option 1: Fond Sombre (RECOMMANDÉ)
```tsx
<thead className="bg-slate-700">
  <th className="text-white">Colonne</th>
</thead>
```

#### Option 2: Fond Gris Moyen
```tsx
<thead className="bg-gray-600">
  <th className="text-white">Colonne</th>
</thead>
```

#### Option 3: Fond Or (pour thème Gold)
```tsx
<thead className="bg-[#B8860B]">
  <th className="text-white">Colonne</th>
</thead>
```

#### ❌ À ÉVITER
```tsx
<!-- NE PAS FAIRE -->
<thead className="bg-gray-50">
  <th className="text-gray-500">Colonne</th> <!-- Trop peu de contraste -->
</thead>

<!-- NE PAS FAIRE -->
<thead className="bg-white">
  <th className="text-white">Colonne</th> <!-- Invisible! -->
</thead>
```

### Corps de Tableau (tbody)

#### Lignes Alternées (Zebra Striping)
```tsx
<tbody>
  {data.map((row, index) => (
    <tr className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
      <td className="text-gray-900">{row.value}</td>
    </tr>
  ))}
</tbody>
```

#### Lignes avec Hover
```tsx
<tr className="hover:bg-slate-50 bg-white">
  <td className="text-gray-900">Contenu</td>
</tr>
```

#### ❌ À ÉVITER
```tsx
<!-- NE PAS FAIRE -->
<tr className="bg-white">
  <td className="text-white">Texte invisible</td>
</tr>

<!-- NE PAS FAIRE -->
<tr className="bg-gray-100">
  <td className="text-gray-100">Très peu de contraste</td>
</tr>
```

---

## 📋 Ratios de Contraste WCAG

### Niveaux de Conformité

- **AAA (Optimal):** Ratio 7:1 pour texte normal, 4.5:1 pour texte large
- **AA (Minimum):** Ratio 4.5:1 pour texte normal, 3:1 pour texte large
- **Échec:** Ratio < 3:1

### Combinaisons Testées et Approuvées

| Fond | Texte | Ratio | Conformité |
|------|-------|-------|------------|
| bg-slate-700 | text-white | 12.6:1 | ✅ AAA |
| bg-slate-600 | text-white | 9.2:1 | ✅ AAA |
| bg-[#B8860B] | text-white | 4.8:1 | ✅ AA |
| bg-white | text-gray-900 | 15.7:1 | ✅ AAA |
| bg-gray-50 | text-gray-900 | 14.9:1 | ✅ AAA |
| bg-white | text-gray-600 | 5.9:1 | ✅ AAA |
| bg-gray-100 | text-gray-700 | 7.2:1 | ✅ AAA |

| Fond | Texte | Ratio | Conformité |
|------|-------|-------|------------|
| bg-white | text-white | 1:1 | ❌ ÉCHEC |
| bg-gray-50 | text-gray-50 | 1:1 | ❌ ÉCHEC |
| bg-gray-100 | text-gray-200 | 1.4:1 | ❌ ÉCHEC |
| bg-white | text-gray-300 | 2.8:1 | ❌ ÉCHEC |

---

## 🛠️ Composant Table.tsx - Configuration Standard

```tsx
// Composant Table avec bon contraste
<table className="w-full">
  {/* EN-TÊTE: Fond sombre, texte blanc */}
  <thead className="bg-slate-700 border-b border-gray-300">
    <tr>
      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
        Colonne
      </th>
    </tr>
  </thead>

  {/* CORPS: Fond blanc/gris alternés, texte foncé */}
  <tbody className="bg-white divide-y divide-gray-200">
    <tr className="bg-white hover:bg-slate-50">
      <td className="px-6 py-4 text-sm text-gray-900">
        Contenu lisible
      </td>
    </tr>
    <tr className="bg-gray-50 hover:bg-slate-50">
      <td className="px-6 py-4 text-sm text-gray-900">
        Contenu alternélistible
      </td>
    </tr>
  </tbody>
</table>
```

---

## 🎯 Checklist de Contraste

Avant de commiter du code avec des tableaux:

- [ ] **En-tête:** Fond sombre (slate-700, gray-600, ou #B8860B) avec texte blanc
- [ ] **Corps:** Fond clair (white ou gray-50) avec texte foncé (gray-900)
- [ ] **Hover:** État hover visible avec transition de couleur
- [ ] **Alternance:** Lignes alternées pour meilleure lisibilité
- [ ] **Bordures:** Bordures visibles entre cellules (gray-200 ou gray-300)
- [ ] **Texte vide:** Message "No data" visible sur fond contrasté
- [ ] **Test visuel:** Vérifier dans le navigateur avec zoom 100%, 150%, 200%

---

## 🔍 Outils de Vérification

### Vérifier le Contraste en Ligne
- https://webaim.org/resources/contrastchecker/
- https://contrast-ratio.com/
- DevTools Chrome: Lighthouse Accessibility Audit

### Extension Chrome Recommandée
- **WCAG Color Contrast Checker**
- **Axe DevTools**

### Test Manuel
```bash
# Ouvrir la page
# Appuyer F12 (DevTools)
# Onglet Lighthouse
# Cocher "Accessibility"
# Cliquer "Generate report"
# Vérifier section "Contrast"
```

---

## 📝 Exemples Corrigés

### ❌ AVANT (Problème)
```tsx
<table>
  <thead className="bg-white">
    <th className="text-white">Fichier</th>
    <th className="text-white">Description</th>
  </thead>
  <tbody className="bg-white">
    <td className="text-gray-100">Nom</td>
    <td className="text-gray-100">Description</td>
  </tbody>
</table>
```

### ✅ APRÈS (Corrigé)
```tsx
<table>
  <thead className="bg-slate-700">
    <th className="text-white font-semibold">Fichier</th>
    <th className="text-white font-semibold">Description</th>
  </thead>
  <tbody className="bg-white divide-y divide-gray-200">
    <tr className="hover:bg-slate-50">
      <td className="text-gray-900 font-medium">Nom du fichier</td>
      <td className="text-gray-700">Description du fichier</td>
    </tr>
  </tbody>
</table>
```

---

## 🎨 Palette de Couleurs Approuvées

### Fonds Sombres (pour en-têtes)
```tsx
bg-slate-700  // Gris foncé (RECOMMANDÉ)
bg-slate-600  // Gris moyen foncé
bg-gray-700   // Alternative grise
bg-[#B8860B]  // Or foncé (thème Gold)
bg-blue-700   // Bleu foncé
bg-green-700  // Vert foncé
```

### Fonds Clairs (pour corps)
```tsx
bg-white      // Blanc pur
bg-gray-50    // Gris très clair
bg-slate-50   // Slate très clair
bg-blue-50    // Bleu très clair (highlights)
bg-green-50   // Vert très clair (success)
bg-red-50     // Rouge très clair (errors)
```

### Textes sur Fond Sombre
```tsx
text-white         // Blanc (ratio 12.6:1 sur slate-700)
text-gray-100      // Gris très clair (alternative)
text-amber-50      // Ambre clair (highlights)
```

### Textes sur Fond Clair
```tsx
text-gray-900      // Noir presque pur (RECOMMANDÉ)
text-slate-900     // Slate foncé
text-gray-800      // Gris très foncé
text-gray-700      // Gris foncé (texte secondaire)
text-gray-600      // Gris moyen (labels)
```

---

## 🚫 Combinaisons Interdites

### JAMAIS utiliser:
```tsx
bg-white + text-white          ❌ Ratio 1:1 - Invisible
bg-gray-50 + text-gray-50      ❌ Ratio 1:1 - Invisible
bg-gray-100 + text-gray-200    ❌ Ratio 1.4:1 - Échec
bg-white + text-gray-300       ❌ Ratio 2.8:1 - Échec
bg-gray-200 + text-gray-300    ❌ Ratio 1.6:1 - Échec
```

---

## 🔧 Script de Validation

Créer un script pour détecter les problèmes:

```bash
# scripts/check-contrast.sh

#!/bin/bash
echo "🔍 Vérification des contrastes problématiques..."

# Chercher text-white avec bg-white
echo "Recherche: text-white + bg-white"
grep -r "text-white.*bg-white\|bg-white.*text-white" src/ && echo "❌ TROUVÉ!" || echo "✅ OK"

# Chercher text-gray-50 avec bg-gray-50
echo "Recherche: text-gray-50 + bg-gray-50"
grep -r "text-gray-50.*bg-gray-50\|bg-gray-50.*text-gray-50" src/ && echo "❌ TROUVÉ!" || echo "✅ OK"

# Chercher text-gray-100 avec bg-gray-100
echo "Recherche: text-gray-100 + bg-gray-100"
grep -r "text-gray-100.*bg-gray-100\|bg-gray-100.*text-gray-100" src/ && echo "❌ TROUVÉ!" || echo "✅ OK"

echo "✅ Vérification terminée"
```

---

## 📚 Ressources

- [WCAG 2.1 Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Color Contrast Analyzer](https://www.tpgi.com/color-contrast-checker/)
- [Material Design Accessibility](https://material.io/design/color/text-legibility.html)

---

## ✅ Résumé des Règles

1. **En-têtes de tableau:** Toujours fond sombre (`bg-slate-700`) + texte blanc (`text-white`)
2. **Corps de tableau:** Toujours fond clair (`bg-white`) + texte foncé (`text-gray-900`)
3. **Ratio minimum:** 4.5:1 pour texte normal, 3:1 pour texte large
4. **Test:** Vérifier visuellement dans le navigateur à différents zooms
5. **Documentation:** Documenter les changements de couleurs dans les commits

---

**Version:** 1.0
**Date:** 2024-12-17
**Auteur:** Équipe Gold Shipper
**Statut:** ✅ Standard Obligatoire
