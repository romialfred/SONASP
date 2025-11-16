# 🔄 Cache Clearing Guide - Gold Shipper

## Problème : Code Modifié mais Erreur Persiste

Si vous voyez toujours une erreur après avoir corrigé le code et rebuilder, c'est probablement un **problème de cache**.

---

## 🚨 Symptômes

- ✅ Le code source est correct
- ✅ `npm run build` réussit sans erreur
- ❌ Le navigateur affiche toujours l'ancienne erreur
- ❌ La console montre une erreur sur du code qui n'existe plus

**Exemple** :
```
Source Code: const months = [...] ✅ CORRECT
Build: ✓ built in 30.25s ✅ SUCCESS
Browser: ReferenceError: months is not defined ❌ OLD VERSION
```

---

## 💡 Cause

Le navigateur charge une **version en cache** de votre application, pas la nouvelle version buildée.

### Pourquoi ça arrive ?

1. **Service Worker (PWA)** : L'app est une PWA, elle met en cache les assets
2. **Browser Cache** : Le navigateur cache les fichiers JavaScript
3. **Vite Dev Server** : Le serveur de dev peut garder des modules en cache
4. **Hot Module Replacement** : Parfois le HMR ne détecte pas tous les changements

---

## ✅ Solutions (Dans l'Ordre)

### Solution 1 : Hard Refresh du Navigateur (RAPIDE)

**Pour Chrome/Edge** :
```
Windows/Linux : Ctrl + Shift + R
Mac : Cmd + Shift + R
```

**Pour Firefox** :
```
Windows/Linux : Ctrl + F5
Mac : Cmd + Shift + R
```

**Pour Safari** :
```
Mac : Cmd + Option + E (vider le cache) puis Cmd + R
```

### Solution 2 : Vider le Cache Navigateur (MOYEN)

**Chrome/Edge** :
1. Ouvrir DevTools (F12)
2. Aller à "Network" tab
3. Cocher "Disable cache"
4. Recharger la page (F5)

**OU avec DevTools ouverts** :
1. Clic droit sur le bouton refresh
2. Sélectionner "Empty Cache and Hard Reload"

### Solution 3 : Clear Service Worker (IMPORTANT POUR PWA)

**Chrome/Edge** :
1. Ouvrir DevTools (F12)
2. Aller à "Application" tab
3. Cliquer sur "Service Workers" dans le menu gauche
4. Cliquer "Unregister" pour chaque service worker
5. Aller à "Storage" → "Clear site data"
6. Recharger la page (F5)

**Firefox** :
1. Ouvrir DevTools (F12)
2. Aller à l'onglet "Storage"
3. Développer "Service Workers"
4. Clic droit → "Unregister"
5. Recharger la page (F5)

### Solution 4 : Rebuild Complet + Clear Cache

```bash
# 1. Arrêter le serveur de dev (Ctrl+C)

# 2. Supprimer les dossiers de build et cache
rm -rf dist/ node_modules/.vite/

# 3. Rebuilder
npm run build

# 4. Redémarrer le dev server
npm run dev

# 5. Dans le navigateur : Hard Refresh (Ctrl+Shift+R)
```

### Solution 5 : Mode Incognito (TEST RAPIDE)

Ouvrir l'application dans une **fenêtre de navigation privée** :
- Pas de cache
- Pas de service workers
- Version fraîche de l'app

Si ça marche en incognito → C'est définitivement un problème de cache

```
Chrome/Edge : Ctrl + Shift + N
Firefox : Ctrl + Shift + P
Safari : Cmd + Shift + N
```

### Solution 6 : Force Browser to Reload All Assets

**Ajouter un timestamp** à l'URL :
```
http://localhost:5173/?v=123456
```

Ou utiliser le script fourni :
```bash
npm run dev:fresh
```

---

## 🔧 Scripts Automatiques

### Script 1 : Fresh Build (Recommandé)

Ajouté dans `package.json` :
```json
{
  "scripts": {
    "dev:fresh": "rm -rf dist/ node_modules/.vite/ && npm run build && npm run dev",
    "build:fresh": "rm -rf dist/ node_modules/.vite/ && npm run build"
  }
}
```

**Utilisation** :
```bash
# Development avec cache vide
npm run dev:fresh

# Build production avec cache vide
npm run build:fresh
```

### Script 2 : Clear Service Worker

Créer `public/clear-sw.html` :
```html
<!DOCTYPE html>
<html>
<head>
    <title>Clearing Service Workers...</title>
    <script>
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) {
                    registration.unregister();
                }
                console.log('✅ All service workers unregistered');
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            });
        }
    </script>
</head>
<body>
    <h1>Clearing Service Workers...</h1>
    <p>You will be redirected shortly...</p>
</body>
</html>
```

**Utilisation** :
```
Naviguer vers : http://localhost:5173/clear-sw.html
```

---

## 📋 Checklist de Vérification

Quand vous avez modifié du code et l'erreur persiste :

1. [ ] Le code source est-il correct ? (`cat src/file.tsx`)
2. [ ] Le build réussit-il ? (`npm run build`)
3. [ ] Le serveur de dev tourne-t-il ? (Check terminal)
4. [ ] Avez-vous fait un Hard Refresh ? (Ctrl+Shift+R)
5. [ ] Le cache navigateur est-il désactivé ? (DevTools → Network → Disable cache)
6. [ ] Les Service Workers sont-ils désinscrits ? (DevTools → Application)
7. [ ] Avez-vous testé en mode incognito ?
8. [ ] Avez-vous redémarré le serveur de dev ?

Si TOUTES les réponses sont OUI et l'erreur persiste → Le problème est ailleurs (vérifier le code)

---

## 🎯 Workflow Recommandé

### Pour le Développement

```bash
# 1. Faire les modifications
vim src/pages/MyComponent.tsx

# 2. Sauvegarder (Vite HMR devrait auto-reload)

# 3. Si ça ne marche pas :
# - Hard Refresh (Ctrl+Shift+R)

# 4. Si toujours pas :
# - Redémarrer dev server (Ctrl+C puis npm run dev)

# 5. Si ENCORE pas :
npm run dev:fresh
```

### Pour le Build Production

```bash
# 1. Build propre
npm run build:fresh

# 2. Tester localement
npm run preview

# 3. Clear browser cache
# Ctrl+Shift+R dans le navigateur

# 4. Vérifier que tout fonctionne

# 5. Deploy
```

---

## 🚀 Prévention

### Désactiver le Cache Pendant le Dev

**Chrome/Edge DevTools** :
1. F12 pour ouvrir DevTools
2. Aller à "Network" tab
3. ✅ Cocher "Disable cache"
4. **Garder DevTools OUVERT** pendant le développement

**Firefox** :
1. F12 pour ouvrir DevTools
2. Cliquer sur l'icône ⚙️ (Settings)
3. ✅ Cocher "Disable Cache (when toolbox is open)"
4. **Garder DevTools OUVERT**

### Vite Configuration

Dans `vite.config.ts`, ajouter :
```typescript
export default defineConfig({
  server: {
    hmr: {
      overlay: true
    }
  },
  build: {
    // Force nouveau hash à chaque build
    rollupOptions: {
      output: {
        // Ajouter timestamp au nom des fichiers
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  }
});
```

---

## 🔍 Diagnostic

### Vérifier quelle version est servie

```bash
# 1. Ouvrir DevTools (F12)
# 2. Aller à "Network" tab
# 3. Recharger (F5)
# 4. Chercher "index.js" ou "main.js"
# 5. Regarder la colonne "Size" :
#    - Si "(disk cache)" ou "(from cache)" → CACHE !
#    - Si taille en KB → Version fraîche ✅
```

### Vérifier le timestamp du build

```bash
# Voir la date de compilation
ls -lh dist/assets/*.js

# Le fichier doit être récent (< 1 minute)
```

### Vérifier le contenu du build

```bash
# Chercher un mot-clé de votre nouveau code
grep -r "months" dist/assets/*.js

# Si trouvé → Build OK ✅
# Si pas trouvé → Rebuild !
```

---

## 📞 Support

Si après TOUTES ces étapes l'erreur persiste :

1. **Vérifier que le code source est vraiment correct**
   ```bash
   grep -A 5 "const months" src/pages/production/BudgetManagementPage.tsx
   ```

2. **Vérifier que le build contient les changements**
   ```bash
   grep "months" dist/assets/*.js
   ```

3. **Tester avec un autre navigateur**

4. **Consulter le DEBUGGING_GUIDE.md**

---

## 💡 Résumé Rapide

| Problème | Solution Rapide |
|----------|-----------------|
| Code modifié mais erreur persiste | **Ctrl+Shift+R** (Hard Refresh) |
| Service Worker cache | DevTools → Application → Unregister |
| Dev server ne reload pas | Restart : **Ctrl+C** puis **npm run dev** |
| Build cache | **npm run build:fresh** |
| Test rapide | **Mode Incognito** (Ctrl+Shift+N) |

---

**Action Immédiate pour Votre Problème** :

```bash
# 1. Terminal : Redémarrer le serveur
# Ctrl+C pour arrêter
npm run dev

# 2. Navigateur :
# - Ouvrir DevTools (F12)
# - Application → Service Workers → Unregister tous
# - Hard Refresh : Ctrl+Shift+R
```

Si ça ne marche toujours pas :
```bash
npm run dev:fresh
# Puis dans le navigateur : Ctrl+Shift+R
```

---

**Date de création** : 2025-01-15
**Dernière mise à jour** : 2025-01-15
