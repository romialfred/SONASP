# Affichage Licence d'Exportation avec Popup

## Amélioration Implémentée

### ✅ Affichage du Numéro de Licence

Le numéro de licence s'affiche maintenant de façon visible et interactive dans la section "Informations d'Expédition".

**Localisation :** Ligne "License d'Exportation"

**Design :**
- Numéro affiché en **gras**
- **Bordure pointillée** sous le numéro pour indiquer qu'il est interactif
- Change de couleur au survol (bleu) avec **transition douce**
- Curseur "help" pour indiquer l'interactivité

---

## ✅ Popup au Survol de la Souris

Au survol du numéro de licence, un **popup élégant** apparaît avec toutes les informations de la licence.

### Contenu du Popup

Le popup affiche :

1. **Titre** : "Détails de la Licence" avec icône 📄
2. **Numéro de Licence** : Affiché en gras
3. **Date d'Émission** : Si disponible
4. **Date d'Expiration** : Si disponible
5. **Statut de Validité** :
   - ✅ **Licence Valide** (point vert) si non expirée
   - ❌ **Licence Expirée** (point rouge) si expirée

### Design du Popup

- **Fond blanc** avec bordure grise
- **Ombre portée** élégante pour effet de profondeur
- **Largeur** : 320px (80rem)
- **Transition** : Apparition douce (fade in/out)
- **Positionnement** : Au-dessus du numéro de licence
- **Flèche** : Pointant vers le numéro (double bordure pour effet 3D)

---

## Fonctionnalités Techniques

### Animation et Interactivité

```css
- invisible → visible au survol
- opacity: 0 → 1 avec transition de 200ms
- Utilise les classes Tailwind "group" et "group-hover"
```

### Responsive Design

- Le popup s'adapte automatiquement
- Z-index élevé (z-50) pour être au-dessus de tout
- Position absolue pour ne pas décaler le layout

### Validation de Date

```typescript
{new Date(license.expiry_date) > new Date() ? (
  // Licence Valide
) : (
  // Licence Expirée
)}
```

---

## Vérification des Données

### Si la licence ne s'affiche toujours pas :

1. **Vérifier que l'export_license_id est bien enregistré dans shipping_preparations**

```sql
SELECT
  id,
  reference_number,
  export_license_id
FROM shipping_preparations
WHERE id = 'votre-id-shipping';
```

2. **Vérifier que la licence existe dans export_licenses**

```sql
SELECT
  id,
  license_number,
  issue_date,
  expiry_date
FROM export_licenses
WHERE id = 'id-de-la-licence';
```

3. **Vérifier les logs dans la console du navigateur**

```javascript
// Les logs affichent :
console.log('License data:', license);
```

---

## Code Ajouté

**Fichier modifié :** `src/pages/shipping/ShippingPreparationDetailsEnhanced.tsx`

**Lignes modifiées :** 508-574

### Structure HTML/JSX

```jsx
<div className="group relative inline-block">
  {/* Numéro de licence avec style interactif */}
  <span className="cursor-help border-b border-dotted">
    {license.license_number}
  </span>

  {/* Popup tooltip */}
  <div className="invisible group-hover:visible">
    {/* Contenu du popup */}
  </div>
</div>
```

---

## Exemple Visuel

### Avant le survol

```
License d'Exportation : EL-2025-001
                        ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲
                        (bordure pointillée)
```

### Au survol

```
┌─────────────────────────────────┐
│ Détails de la Licence      📄   │
├─────────────────────────────────┤
│ Numéro : EL-2025-001            │
│ Date d'Émission : 1er janv 2025 │
│ Date d'Expiration : 31 déc 2025 │
├─────────────────────────────────┤
│ ● Licence Valide                │
└─────────────────────────────────┘
        ▼
License d'Exportation : EL-2025-001
```

---

## Styles Tailwind Utilisés

| Classe | Description |
|--------|-------------|
| `group` | Conteneur parent pour le hover |
| `group-hover:visible` | Affiche au survol du groupe |
| `cursor-help` | Curseur d'aide (point d'interrogation) |
| `border-b border-dotted` | Bordure inférieure pointillée |
| `hover:border-blue-500` | Change la couleur au survol |
| `transition-opacity` | Transition douce de l'opacité |
| `shadow-xl` | Ombre portée importante |
| `z-50` | Index de superposition élevé |

---

## Test

Pour tester l'implémentation :

1. **Aller sur une préparation d'expédition** qui a une licence d'exportation
2. **Localiser la ligne "License d'Exportation"**
3. **Vérifier** :
   - ✅ Le numéro de licence s'affiche
   - ✅ Il y a une bordure pointillée sous le numéro
   - ✅ Au survol, le texte devient bleu
   - ✅ Un popup apparaît avec toutes les infos
   - ✅ Le popup montre le statut "Valide" ou "Expirée"

---

## Notes Importantes

1. **Si "Non spécifié" s'affiche** : La licence n'est pas associée à cette expédition
2. **Si le popup ne s'affiche pas** : Vérifier que les données (issue_date, expiry_date) existent
3. **Le popup apparaît au survol** : Pas besoin de clic

---

## Build

✅ **Build réussi sans erreurs**
```
✓ 3291 modules transformed
✓ built in 24.75s
```

---

**Date :** 10 décembre 2025
**Fichier modifié :** `src/pages/shipping/ShippingPreparationDetailsEnhanced.tsx`
**Status :** ✅ Implémenté et testé
