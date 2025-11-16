# 🔍 Quality Control Checklist - Gold Shipper

## Vue d'ensemble
Ce fichier doit être consulté et vérifié **AVANT** et **APRÈS** chaque modification de page ou composant.

---

## ✅ Checklist Pré-Modification

### 1. Analyse du Code Existant
- [ ] Lire le composant complet avant toute modification
- [ ] Identifier toutes les dépendances (imports, props, contexts)
- [ ] Noter toutes les variables d'état (useState, useEffect)
- [ ] Identifier les constantes et fonctions utilisées
- [ ] Vérifier les props passées aux composants enfants

### 2. Vérification des Variables Scope
- [ ] Lister toutes les variables utilisées dans le composant
- [ ] Vérifier que les variables sont définies dans le bon scope
- [ ] Identifier les variables définies dans des sous-composants
- [ ] S'assurer que les nouvelles sections ont accès aux variables nécessaires

### 3. Structure JSX
- [ ] Comprendre la hiérarchie des composants
- [ ] Identifier les fragments (<> </>) et leurs fermetures
- [ ] Noter les conditions de rendu (if, ternary, &&)
- [ ] Vérifier l'imbrication des divs et leur fermeture

---

## 🛠️ Checklist Pendant la Modification

### 1. Variables et Constantes
- [ ] ✅ Définir les constantes au bon niveau (composant principal vs sous-composant)
- [ ] ✅ Vérifier que toutes les variables référencées sont accessibles
- [ ] ✅ Éviter les duplications de constantes
- [ ] ✅ Utiliser des noms de variables explicites et cohérents

**Exemple d'erreur courante** :
```typescript
// ❌ MAUVAIS - Variable définie dans sous-composant
function SubComponent() {
  const months = ['Jan', 'Feb', ...];
}

function ParentComponent() {
  return <div>{months[0]}</div>; // ❌ ReferenceError: months is not defined
}

// ✅ BON - Variable définie au bon niveau
function ParentComponent() {
  const months = ['Jan', 'Feb', ...];

  return (
    <>
      <SubComponent months={months} />
      <div>{months[0]}</div>
    </>
  );
}
```

### 2. Structure JSX et Fragments
- [ ] ✅ Toujours fermer les fragments ouverts
- [ ] ✅ Vérifier l'équilibre des accolades { }
- [ ] ✅ Compter les ouvertures et fermetures de divs
- [ ] ✅ Utiliser l'indentation correcte pour visualiser la structure

**Exemple d'erreur courante** :
```typescript
// ❌ MAUVAIS - Fragment non fermé
{condition ? (
  <>
    <Component1 />
    <Component2 />
  // ❌ Manque </>
) : (
  <Component3 />
)}

// ✅ BON - Fragment correctement fermé
{condition ? (
  <>
    <Component1 />
    <Component2 />
  </>
) : (
  <Component3 />
)}
```

### 3. Rendu Conditionnel
- [ ] ✅ Vérifier que toutes les branches sont complètes
- [ ] ✅ S'assurer que les conditions mutuellement exclusives sont gérées
- [ ] ✅ Tester tous les cas (if, else if, else)
- [ ] ✅ Éviter les nested ternaries complexes

**Pattern recommandé** :
```typescript
// ✅ BON - Conditions claires
{activeTab === 'browser' ? (
  <BrowserContent />
) : activeTab === 'matrix' ? (
  <MatrixContent />
) : (
  <DefaultContent />
)}

// OU avec fragments pour multiple éléments
{activeTab === 'browser' ? (
  <>
    <Header />
    <Content />
    <Footer />
  </>
) : (
  <>
    <OtherHeader />
    <OtherContent />
  </>
)}
```

### 4. Props et Types
- [ ] ✅ Typer toutes les props des composants
- [ ] ✅ Vérifier que les props passées correspondent aux types attendus
- [ ] ✅ Gérer les props optionnelles avec `?`
- [ ] ✅ Documenter les props complexes

---

## ✅ Checklist Post-Modification

### 1. Vérification Syntaxique
- [ ] ✅ **TOUJOURS exécuter `npm run build`**
- [ ] ✅ Vérifier qu'il n'y a aucune erreur TypeScript
- [ ] ✅ Vérifier qu'il n'y a aucune erreur ESLint
- [ ] ✅ S'assurer que le build se termine avec succès

### 2. Test de Compilation
```bash
# Commandes à exécuter systématiquement
npm run build          # Build production
npm run typecheck      # Vérification TypeScript
npm run lint           # Vérification ESLint (si configuré)
```

### 3. Tests Manuels Essentiels
- [ ] ✅ Ouvrir la page modifiée dans le navigateur
- [ ] ✅ Tester tous les onglets/tabs si applicable
- [ ] ✅ Tester tous les boutons et interactions
- [ ] ✅ Vérifier les changements d'état (filters, dropdowns, etc.)
- [ ] ✅ Tester le responsive design (mobile, tablet, desktop)
- [ ] ✅ Vérifier la console pour les erreurs JavaScript
- [ ] ✅ Tester le rechargement de la page (F5)

### 4. Vérification des Erreurs Runtime
- [ ] ✅ Ouvrir la console développeur (F12)
- [ ] ✅ Vérifier qu'il n'y a pas d'erreurs rouges
- [ ] ✅ Vérifier qu'il n'y a pas de warnings critiques
- [ ] ✅ Tester les cas limites (données vides, valeurs nulles)

### 5. Vérification Performance
- [ ] ✅ Vérifier que la page se charge rapidement
- [ ] ✅ S'assurer qu'il n'y a pas de page blanche lors des changements
- [ ] ✅ Vérifier que les transitions sont fluides
- [ ] ✅ Tester les changements d'onglet/tab (doivent être instantanés)

---

## 🚨 Erreurs Courantes à Éviter

### 1. ReferenceError: variable is not defined
**Cause** : Variable utilisée mais définie dans un autre scope
**Solution** : Déplacer la définition au niveau parent ou passer en props

### 2. Unexpected token '<' ou '>'
**Cause** : Fragment JSX non fermé ou mal imbriqué
**Solution** : Vérifier toutes les ouvertures/fermetures de fragments

### 3. Cannot read property 'X' of undefined
**Cause** : Accès à une propriété d'un objet null/undefined
**Solution** : Utiliser optional chaining `?.` ou vérifier avec if

### 4. Maximum update depth exceeded
**Cause** : useState appelé sans condition dans le render
**Solution** : Déplacer dans useEffect ou ajouter condition

### 5. Page blanche après modification
**Cause** : Erreur de syntaxe ou composant qui return null
**Solution** : Vérifier la console, corriger la syntaxe

---

## 🔧 Patterns Recommandés

### 1. Définition de Constantes
```typescript
// ✅ BON - Au niveau du composant principal
export function MyComponent() {
  const CONSTANTS = {
    months: ['Janvier', 'Février', ...],
    colors: { red: '#ef4444', green: '#10b981' }
  };

  return <div>...</div>;
}
```

### 2. Gestion d'État Conditionnel
```typescript
// ✅ BON - État avec valeur par défaut
const [data, setData] = useState<DataType | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// Rendu conditionnel clair
if (loading) return <Loading />;
if (error) return <Error message={error} />;
if (!data) return <NoData />;

return <Content data={data} />;
```

### 3. Sidebar Conditionnelle
```typescript
// ✅ BON - Sidebar qui change selon l'onglet
{!loading && (
  <Sidebar>
    {activeTab === 'browser' ? (
      <BrowserSidebar data={data} />
    ) : (
      <DefaultSidebar data={data} />
    )}
  </Sidebar>
)}
```

---

## 📝 Template de Vérification Rapide

Avant de commiter les changements, répondre OUI à toutes ces questions :

1. ✅ J'ai lu tout le code existant avant de modifier ?
2. ✅ J'ai vérifié que toutes les variables sont accessibles ?
3. ✅ J'ai compté les fragments ouverts et fermés ?
4. ✅ J'ai exécuté `npm run build` avec succès ?
5. ✅ J'ai testé la page dans le navigateur ?
6. ✅ J'ai vérifié la console développeur (pas d'erreurs) ?
7. ✅ J'ai testé tous les onglets/interactions ?
8. ✅ La page ne devient pas blanche lors des changements ?
9. ✅ Les transitions sont fluides et rapides ?
10. ✅ Le code est propre et bien indenté ?

---

## 🎯 Règles d'Or

1. **TOUJOURS lire avant d'écrire** - Comprendre le code existant
2. **TOUJOURS vérifier le scope** - Les variables sont-elles accessibles ?
3. **TOUJOURS fermer ce qu'on ouvre** - Fragments, divs, accolades
4. **TOUJOURS builder avant de tester** - `npm run build`
5. **TOUJOURS tester dans le navigateur** - La compilation ne suffit pas
6. **TOUJOURS vérifier la console** - Erreurs runtime invisibles au build
7. **JAMAIS de page blanche** - Garder le layout visible pendant les chargements
8. **JAMAIS assumer** - Vérifier que les dépendances existent

---

## 🔄 Workflow Recommandé

```
1. LIRE le code existant
   ↓
2. IDENTIFIER les variables/constantes nécessaires
   ↓
3. PLANIFIER les modifications
   ↓
4. MODIFIER le code
   ↓
5. BUILDER (`npm run build`)
   ↓
6. TESTER dans le navigateur
   ↓
7. VÉRIFIER la console
   ↓
8. TESTER toutes les interactions
   ↓
9. VALIDER la performance
   ↓
10. COMMIT si tout est OK
```

---

## 📚 Ressources Additionnelles

- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [ESLint Rules](https://eslint.org/docs/latest/rules/)
- [Vite Build](https://vitejs.dev/guide/build.html)

---

**Date de création** : 2025-01-15
**Dernière mise à jour** : 2025-01-15
**Auteur** : Senior Full Stack Developer

---

## ⚠️ IMPORTANT

Ce document doit être **CONSULTÉ AVANT CHAQUE MODIFICATION** de composant ou page.
Ne pas suivre ces guidelines peut entraîner des bugs critiques en production.
