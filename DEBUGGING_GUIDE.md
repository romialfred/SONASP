# 🐛 Debugging Guide - Gold Shipper

## Guide de Résolution des Erreurs Courantes

Ce document liste les erreurs les plus fréquentes et leurs solutions.

---

## 🔴 Erreurs Critiques

### 1. ReferenceError: [variable] is not defined

**Erreur affichée** :
```
ReferenceError: months is not defined
at BudgetManagementPage (BudgetManagementPage.tsx:1010:16)
```

**Cause** :
- Variable utilisée dans un scope où elle n'est pas définie
- Variable définie dans un sous-composant mais utilisée dans le parent
- Variable définie après son utilisation

**Solutions** :

#### Solution A : Déplacer la définition au niveau parent
```typescript
// ❌ AVANT (Erreur)
function ParentComponent() {
  return <div>{months[0]}</div>; // ❌ months non défini ici
}

function SubComponent() {
  const months = ['Jan', 'Feb'];
  return <div>{months[0]}</div>;
}

// ✅ APRÈS (Corrigé)
function ParentComponent() {
  const months = ['Jan', 'Feb']; // ✅ Défini au bon niveau

  return (
    <>
      <div>{months[0]}</div>
      <SubComponent months={months} />
    </>
  );
}

function SubComponent({ months }: { months: string[] }) {
  return <div>{months[0]}</div>;
}
```

#### Solution B : Passer en props
```typescript
// ✅ Définir dans parent et passer aux enfants
const ParentComponent = () => {
  const sharedData = { months: ['Jan', 'Feb'], colors: [...] };

  return (
    <>
      <Component1 data={sharedData} />
      <Component2 data={sharedData} />
    </>
  );
};
```

**Comment déboguer** :
1. Regarder l'erreur : quelle variable ? quelle ligne ?
2. Chercher où la variable est définie : `grep -n "const months" file.tsx`
3. Vérifier le scope : la variable est-elle dans le même composant ?
4. Déplacer ou passer en props

---

### 2. Unexpected token '<' ou 'SyntaxError'

**Erreur affichée** :
```
SyntaxError: Unexpected token '<'
Unterminated regular expression
```

**Cause** :
- Fragment JSX non fermé
- Div non fermée
- Accolade manquante dans JSX
- Mélange de syntaxe JS et JSX

**Solutions** :

#### Solution : Vérifier les fermetures
```typescript
// ❌ AVANT (Erreur)
return (
  <>
    <div>
      <Component1 />
    </div>
  // ❌ Manque </>
);

// ✅ APRÈS (Corrigé)
return (
  <>
    <div>
      <Component1 />
    </div>
  </>
);
```

**Outil de vérification** :
```bash
# Compter les ouvertures de fragments
grep -o "<>" file.tsx | wc -l

# Compter les fermetures de fragments
grep -o "</>" file.tsx | wc -l

# Les deux nombres doivent être égaux
```

---

### 3. Cannot read property 'X' of undefined

**Erreur affichée** :
```
TypeError: Cannot read property 'length' of undefined
at BudgetManagementPage.tsx:980
```

**Cause** :
- Accès à une propriété d'un objet null ou undefined
- Données non encore chargées
- Props non passées

**Solutions** :

#### Solution A : Optional Chaining
```typescript
// ❌ AVANT (Erreur)
const total = data.items.length; // ❌ Si data ou items est undefined

// ✅ APRÈS (Corrigé)
const total = data?.items?.length ?? 0; // ✅ Valeur par défaut
```

#### Solution B : Vérification conditionnelle
```typescript
// ✅ Vérifier avant d'utiliser
if (!data || !data.items) {
  return <Loading />;
}

return <div>{data.items.length}</div>;
```

#### Solution C : Valeurs par défaut
```typescript
// ✅ Props avec valeur par défaut
interface Props {
  items?: Item[];
}

function Component({ items = [] }: Props) {
  return <div>{items.length}</div>; // ✅ items est toujours un array
}
```

---

### 4. Maximum update depth exceeded

**Erreur affichée** :
```
Error: Maximum update depth exceeded.
This can happen when a component calls setState inside useEffect,
but useEffect doesn't have a dependency array.
```

**Cause** :
- setState appelé dans le render sans condition
- useEffect sans tableau de dépendances
- Boucle infinie de mises à jour

**Solutions** :

#### Solution A : Déplacer dans useEffect
```typescript
// ❌ AVANT (Erreur)
function Component() {
  const [count, setCount] = useState(0);
  setCount(count + 1); // ❌ Boucle infinie
  return <div>{count}</div>;
}

// ✅ APRÈS (Corrigé)
function Component() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(count + 1);
  }, []); // ✅ Exécuté une seule fois

  return <div>{count}</div>;
}
```

#### Solution B : Ajouter dépendances
```typescript
// ❌ AVANT (Erreur)
useEffect(() => {
  fetchData();
}); // ❌ Pas de tableau de dépendances

// ✅ APRÈS (Corrigé)
useEffect(() => {
  fetchData();
}, [selectedId]); // ✅ Se déclenche uniquement si selectedId change
```

---

### 5. Page Blanche (White Screen of Death)

**Symptômes** :
- Page complètement blanche
- Pas de contenu visible
- Spinner de chargement infini

**Causes courantes** :
1. Erreur JavaScript qui crash le composant
2. Composant qui return null
3. Condition de render qui ne match aucun cas
4. Layout remplacé par loading

**Solutions** :

#### Solution A : Vérifier la console
```bash
# Ouvrir DevTools (F12)
# Onglet Console
# Chercher les erreurs en rouge
```

#### Solution B : Garder le Layout
```typescript
// ❌ MAUVAIS - Remplace tout
if (loading) {
  return <Loading />; // ❌ Layout disparaît
}

return (
  <MainLayout>
    <Content />
  </MainLayout>
);

// ✅ BON - Garde le layout
return (
  <MainLayout>
    {loading ? (
      <Loading />
    ) : (
      <Content />
    )}
  </MainLayout>
);
```

#### Solution C : Error Boundary
```typescript
// Ajouter un Error Boundary
<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>
```

---

## ⚠️ Avertissements Courants

### 1. Warning: Each child in a list should have a unique "key" prop

**Solution** :
```typescript
// ❌ AVANT
{items.map(item => <div>{item.name}</div>)}

// ✅ APRÈS
{items.map(item => <div key={item.id}>{item.name}</div>)}
```

### 2. Warning: Can't perform a React state update on an unmounted component

**Solution** :
```typescript
useEffect(() => {
  let isMounted = true;

  fetchData().then(data => {
    if (isMounted) {
      setData(data); // ✅ Uniquement si monté
    }
  });

  return () => {
    isMounted = false; // Cleanup
  };
}, []);
```

---

## 🛠️ Outils de Débogage

### 1. Console Logging Stratégique
```typescript
// Ajouter des logs pour tracer l'exécution
console.log('🔍 Component rendering', { state, props });
console.log('📊 Data loaded', data);
console.log('❌ Error occurred', error);
```

### 2. React DevTools
```bash
# Installer l'extension Chrome/Firefox
# Inspecter les props et state
# Voir l'arbre des composants
```

### 3. Vérification du Build
```bash
# Toujours builder après modification
npm run build

# Si erreur, lire attentivement le message
# La ligne et le fichier sont indiqués
```

### 4. TypeScript Check
```bash
# Vérifier les erreurs TypeScript
npm run typecheck

# Résoudre toutes les erreurs avant de tester
```

---

## 📋 Checklist de Débogage

Quand vous avez une erreur :

1. [ ] Lire le message d'erreur complet
2. [ ] Noter le fichier et le numéro de ligne
3. [ ] Ouvrir le fichier à la ligne indiquée
4. [ ] Identifier la variable/fonction en cause
5. [ ] Vérifier où elle est définie
6. [ ] Vérifier le scope (est-elle accessible ?)
7. [ ] Ajouter des console.log pour tracer
8. [ ] Tester la modification
9. [ ] Relancer `npm run build`
10. [ ] Vérifier la console du navigateur

---

## 🔄 Workflow de Résolution

```
Erreur détectée
     ↓
Lire le message complet
     ↓
Identifier le type d'erreur
     ↓
Consulter ce guide
     ↓
Appliquer la solution
     ↓
Builder le projet
     ↓
Tester dans le navigateur
     ↓
Vérifier la console
     ↓
✅ Erreur résolue
```

---

## 📞 Ressources Supplémentaires

- **React Errors** : https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
- **TypeScript Errors** : https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
- **Vite Build Errors** : https://vitejs.dev/guide/troubleshooting.html

---

**Dernière mise à jour** : 2025-01-15
