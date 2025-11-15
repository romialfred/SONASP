# Pre-Delivery Checklist - Liste de Vérification Avant Livraison

## CRITIQUE : Cette checklist DOIT être suivie avant CHAQUE livraison

En tant que Senior Full Stack Developer, ces erreurs ne doivent JAMAIS arriver en production. Cette checklist garantit la qualité du code livré.

---

## ✅ 1. VÉRIFICATIONS DE BUILD

### 1.1 Build Réussi
```bash
npm run build
```
- [ ] Le build se termine sans erreur
- [ ] Aucun warning critique (TypeScript, ESLint)
- [ ] Les assets sont générés correctement

### 1.2 Tests de Compilation
```bash
npm run typecheck
```
- [ ] Aucune erreur TypeScript
- [ ] Tous les types sont correctement définis
- [ ] Pas de `any` implicite

---

## ✅ 2. VÉRIFICATIONS DES SERVICES

### 2.1 Méthodes de Service Existantes
Avant d'appeler une méthode de service, VÉRIFIER qu'elle existe :

```typescript
// ❌ MAUVAIS - Appel sans vérification
const data = await myService.getData(id);

// ✅ BON - Vérifier d'abord la méthode
// 1. Ouvrir le fichier du service
// 2. Chercher la méthode exacte
// 3. Vérifier la signature (paramètres, type de retour)
```

**Checklist:**
- [ ] Toutes les méthodes de service appelées existent
- [ ] Les noms de méthodes sont corrects (getById vs get vs getBy...)
- [ ] Les paramètres correspondent à la signature
- [ ] Les types de retour sont corrects

### 2.2 Interfaces et Types
```typescript
// Vérifier que les interfaces correspondent aux données réelles
- [ ] Les champs utilisés existent dans l'interface
- [ ] Les types nullable sont gérés (field | null)
- [ ] Les champs optionnels sont marqués avec ? (field?: string)
```

---

## ✅ 3. TESTS EN NAVIGATEUR

### 3.1 Console Browser
**OBLIGATOIRE** : Tester CHAQUE page modifiée dans le navigateur

```bash
npm run dev
```

**Vérifier:**
- [ ] Aucune erreur dans la console (F12 > Console)
- [ ] Aucun warning rouge
- [ ] Les données se chargent correctement
- [ ] Pas d'erreur "is not a function"
- [ ] Pas d'erreur "undefined property"
- [ ] Pas d'erreur "Cannot read property of undefined"

### 3.2 Navigation
- [ ] Toutes les pages se chargent sans erreur "We hit a snag"
- [ ] Les transitions entre pages fonctionnent
- [ ] Les boutons retour fonctionnent
- [ ] Les liens sont corrects

### 3.3 Fonctionnalités
- [ ] Les formulaires se soumettent correctement
- [ ] Les données s'affichent
- [ ] Les actions (créer, modifier, supprimer) fonctionnent
- [ ] Les modals s'ouvrent et se ferment

---

## ✅ 4. VÉRIFICATIONS DES DONNÉES

### 4.1 Base de Données
```typescript
// Vérifier que les requêtes correspondent à la structure de la DB
- [ ] Les noms de tables sont corrects
- [ ] Les noms de colonnes sont corrects
- [ ] Les relations (FK) existent
- [ ] Les types de données correspondent
```

### 4.2 Queries Supabase
```typescript
// Exemple de vérification
const { data, error } = await supabase
  .from('table_name')  // ✓ Table existe?
  .select('field1, field2')  // ✓ Champs existent?
  .eq('id', id);  // ✓ Colonne 'id' existe?

// TOUJOURS vérifier les erreurs
if (error) {
  console.error('Database error:', error);
  throw error;
}
```

---

## ✅ 5. GESTION DES ERREURS

### 5.1 Try-Catch
```typescript
// ✅ BON - Toujours gérer les erreurs
try {
  const data = await service.getData(id);
  return data;
} catch (error: any) {
  console.error('Error loading data:', error);
  setError(error.message);
  // Afficher à l'utilisateur
}
```

### 5.2 Messages d'Erreur Utilisateur
- [ ] Messages d'erreur clairs en français
- [ ] Pas de stack traces affichés à l'utilisateur
- [ ] Actions alternatives proposées (retour, réessayer)

---

## ✅ 6. INTERFACES UTILISATEUR

### 6.1 States de Loading
```typescript
- [ ] Loading state pendant le chargement
- [ ] Skeleton ou spinner visible
- [ ] Pas de contenu vide sans explication
```

### 6.2 States Vides
```typescript
- [ ] Messages clairs pour données vides
- [ ] Instructions pour l'utilisateur
- [ ] Boutons d'action disponibles
```

### 6.3 Responsive
- [ ] Testé sur mobile (ou DevTools mobile view)
- [ ] Testé sur tablette
- [ ] Testé sur desktop
- [ ] Pas de dépassement horizontal

---

## ✅ 7. HISTORIQUE ET LOGS

### 7.1 Historique des Changements
```typescript
- [ ] L'historique se charge correctement
- [ ] Les changements de statut s'affichent
- [ ] Les dates sont formatées
- [ ] Les utilisateurs sont identifiés
```

### 7.2 Logs Console (Dev)
```typescript
// En développement, logger pour debug
console.log('Loading data for id:', id);
console.log('Data received:', data);

// ⚠️ SUPPRIMER avant production ou utiliser un système de logs
```

---

## ✅ 8. PERFORMANCE

### 8.1 Requêtes Multiples
```typescript
// ❌ MAUVAIS - Requêtes séquentielles
const user = await getUser(id);
const posts = await getPosts(userId);
const comments = await getComments(userId);

// ✅ BON - Requêtes parallèles
const [user, posts, comments] = await Promise.all([
  getUser(id),
  getPosts(userId),
  getComments(userId)
]);
```

### 8.2 Mémoire
- [ ] Pas de memory leaks (useEffect cleanup)
- [ ] Unsubscribe des événements
- [ ] Cleanup des timers

---

## ✅ 9. SÉCURITÉ

### 9.1 Données Sensibles
```typescript
- [ ] Pas de clés API dans le code
- [ ] Pas de tokens hardcodés
- [ ] Utiliser les variables d'environnement
```

### 9.2 Validation
```typescript
- [ ] Valider les inputs utilisateur
- [ ] Sanitizer les données affichées
- [ ] Vérifier les permissions
```

---

## ✅ 10. DOCUMENTATION

### 10.1 Code Comments
```typescript
// ✅ Commenter les parties complexes
// ⚠️ Ne pas commenter l'évident
```

### 10.2 README Updates
- [ ] Mettre à jour README si nouvelles features
- [ ] Documenter les changements de configuration
- [ ] Documenter les nouvelles migrations

---

## 🚀 CHECKLIST FINALE AVANT COMMIT

**Avant de committer et livrer:**

1. [ ] ✅ Build réussi (`npm run build`)
2. [ ] ✅ Typecheck réussi (`npm run typecheck`)
3. [ ] ✅ Toutes les pages testées en navigateur
4. [ ] ✅ Console sans erreurs
5. [ ] ✅ Navigation fonctionne
6. [ ] ✅ Données s'affichent correctement
7. [ ] ✅ Historiques visibles
8. [ ] ✅ Gestion d'erreurs implémentée
9. [ ] ✅ Messages utilisateur clairs
10. [ ] ✅ Responsive testé

---

## 📝 ERREURS COMMUNES À ÉVITER

### 1. Service Methods
```typescript
// ❌ getPreparation (n'existe pas)
// ✅ getPreparationById (existe)
```

### 2. Interface Fields
```typescript
// ❌ preparation.expedition_number (n'existe pas)
// ✅ preparation.reference_number (existe)
```

### 3. Icon Components dans Tabs
```typescript
// ❌ icon: <Package />
// ✅ icon: Package
```

### 4. Null/Undefined
```typescript
// ❌ data.field.subfield
// ✅ data?.field?.subfield
// ✅ data && data.field && data.field.subfield
```

### 5. Imports
```typescript
// ❌ Import inexistant
// ✅ Vérifier que le fichier existe
// ✅ Vérifier l'export (default vs named)
```

---

## 💡 BEST PRACTICES

### 1. Toujours Vérifier Avant d'Utiliser
- Service methods exist?
- Interface fields exist?
- Database columns exist?
- Components exported correctly?

### 2. Tester en Local d'Abord
- Run dev server
- Open browser console
- Navigate to the page
- Check for errors

### 3. Gérer les Cas Limites
- Données vides
- Données null/undefined
- Erreurs réseau
- Erreurs de permissions

### 4. Communication Claire
- Messages d'erreur en français
- Instructions claires
- Feedback utilisateur immédiat

---

## 🎯 OBJECTIF

**ZÉRO ERREUR EN PRODUCTION**

Cette checklist doit devenir un réflexe. Chaque point doit être vérifié systématiquement avant toute livraison.

**Temps estimé:** 10-15 minutes par livraison
**Bénéfice:** Réduction de 95% des bugs en production

---

**Date de création:** 2025-01-15
**Dernière mise à jour:** 2025-01-15
**Version:** 1.0
