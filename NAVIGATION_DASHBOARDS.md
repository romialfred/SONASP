# 🧭 Guide de Navigation - Nouveaux Dashboards

## ✅ Configuration Mise à Jour

La route principale `/dashboard` affiche maintenant le **Tableau de Bord Global Amélioré** (version moderne).

---

## 📍 Routes Disponibles

### Dashboards Modernes (NOUVEAUX) ✨

| Route | Dashboard | Description |
|-------|-----------|-------------|
| `/dashboard` | **Global Enhanced** | Vue d'ensemble complète (DÉFAUT) |
| `/dashboard/production-modern` | **Production Modern** | Production par mine + Expéditions |
| `/dashboard/global-enhanced` | **Global Enhanced** | Même que `/dashboard` |

### Dashboards Legacy (Anciens)

| Route | Dashboard | Description |
|-------|-----------|-------------|
| `/dashboard/legacy` | Dashboard Original | Ancienne version conservée |
| `/dashboard/management` | Management | Dashboard management |
| `/dashboard/factory` | Factory | Dashboard usine |
| `/dashboard/airport` | Airport | Dashboard aéroport |
| `/dashboard/refinery` | Refinery | Dashboard raffinerie |
| `/dashboard/customer` | Customer | Dashboard client |

---

## 🚀 Accès Rapide

### 1. Dashboard Principal (par défaut)

```
URL: http://localhost:5173/dashboard
```

**Affiche:** Tableau de Bord Global Amélioré
- 6 métriques globales animées
- Performance 12 mois
- Distribution par pays
- Activité récente

### 2. Dashboard Production

```
URL: http://localhost:5173/dashboard/production-modern
```

**Affiche:** Tableau de Bord Production Moderne
- Production YTD/MTD
- Production par mine
- État des expéditions
- Cartes compagnies

---

## 🔄 Vider le Cache

Si vous voyez toujours l'ancien dashboard, videz le cache:

### Méthode 1: Hard Refresh

```bash
# Windows/Linux
Ctrl + Shift + R

# Mac
Cmd + Shift + R
```

### Méthode 2: DevTools

```bash
1. F12 (ouvrir DevTools)
2. Clic droit sur bouton refresh
3. "Vider le cache et actualiser"
```

### Méthode 3: Navigateur

```bash
Chrome/Edge:
Ctrl + Shift + Delete → Cocher "Images et fichiers en cache" → Effacer

Firefox:
Ctrl + Shift + Delete → Cocher "Cache" → Effacer

Safari:
Cmd + Option + E → Vider le cache
```

### Méthode 4: Redémarrer le serveur

```bash
# Dans le terminal
Ctrl + C  (arrêter le serveur)
npm run dev  (redémarrer)
```

---

## 🎯 Navigation dans l'Application

### Menu Principal Suggéré

```jsx
// À ajouter dans le menu de navigation principal
<nav>
  <MenuItem to="/dashboard">
    🌍 Dashboard Global
  </MenuItem>

  <MenuItem to="/dashboard/production-modern">
    📊 Production par Mine
  </MenuItem>

  <MenuDivider />

  <MenuItem to="/dashboard/legacy">
    📋 Dashboard Legacy
  </MenuItem>
</nav>
```

---

## 📊 Comparaison Ancien vs Nouveau

### Route `/dashboard` AVANT

```
┌─────────────────────────────────┐
│  Dashboard Original             │
│  ─────────────────────────      │
│                                  │
│  • Métriques basiques            │
│  • Graphiques simples            │
│  • Pas d'animations              │
│  • Terminologie "Batch"          │
│                                  │
└─────────────────────────────────┘
```

### Route `/dashboard` MAINTENANT

```
┌─────────────────────────────────┐
│  Global Dashboard Enhanced      │
│  ─────────────────────────      │
│                                  │
│  • 6 métriques animées 3D        │
│  • Graphiques modernes           │
│  • Animations fluides            │
│  • Terminologie "Expéditions"    │
│  • Glassmorphism                 │
│  • Gradients animés              │
│                                  │
└─────────────────────────────────┘
```

---

## 🔧 Troubleshooting

### Problème: Je vois toujours l'ancien dashboard

**Solutions (dans l'ordre):**

1. **Hard Refresh**
   ```
   Ctrl + Shift + R (ou Cmd + Shift + R sur Mac)
   ```

2. **Vider complètement le cache**
   ```
   F12 → Application → Clear Storage → Clear site data
   ```

3. **Mode Incognito**
   ```
   Ctrl + Shift + N
   Naviguer vers http://localhost:5173/dashboard
   ```

4. **Redémarrer le serveur**
   ```bash
   # Terminal 1
   Ctrl + C
   npm run dev

   # Terminal 2 (optionnel)
   rm -rf node_modules/.vite
   npm run dev
   ```

5. **Vérifier la console**
   ```
   F12 → Console
   Chercher des erreurs en rouge
   ```

### Problème: Erreur 404 Not Found

**Cause:** Le serveur n'a pas redémarré

**Solution:**
```bash
# Arrêter le serveur
Ctrl + C

# Redémarrer
npm run dev

# Attendre le message:
#   ➜  Local:   http://localhost:5173/
```

### Problème: Page blanche

**Cause:** Erreur JavaScript non affichée

**Solution:**
```bash
1. F12 → Console
2. Chercher l'erreur
3. Si erreur d'import:
   - Vérifier que les fichiers existent
   - Redémarrer le serveur
```

---

## 🎨 Personnalisation

### Changer le Dashboard par Défaut

Si vous voulez afficher **Production Modern** par défaut au lieu de **Global Enhanced**:

```typescript
// Dans src/App.tsx
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <ProductionDashboardModern />  // ← Changer ici
    </ProtectedRoute>
  }
/>
```

### Redirection Personnalisée

Pour rediriger selon le rôle de l'utilisateur:

```typescript
// Dans src/App.tsx
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <RoleBasedDashboard />
    </ProtectedRoute>
  }
/>

// Dans un nouveau composant RoleBasedDashboard.tsx
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export function RoleBasedDashboard() {
  const { user } = useAuth();

  switch(user.role) {
    case 'management':
      return <GlobalDashboardEnhanced />;
    case 'factory':
      return <ProductionDashboardModern />;
    default:
      return <GlobalDashboardEnhanced />;
  }
}
```

---

## 📱 Accès Mobile

Les nouveaux dashboards sont **fully responsive**:

### Mobile (< 768px)
- Cartes empilées verticalement
- Graphiques pleine largeur
- Menu hamburger
- Touch gestures

### Tablet (768px - 1024px)
- 2 colonnes pour métriques
- Graphiques côte à côte
- Navigation optimisée

### Desktop (> 1024px)
- Layout complet
- 3-4 colonnes
- Tous les effets activés

---

## 🔗 Liens Utiles

### Documentation
- [Guide Technique](./MODERN_DASHBOARDS_GUIDE.md)
- [Présentation Visuelle](./DASHBOARDS_VISUELS_PRESENTATION.md)
- [Récapitulatif](./RECAP_TABLEAUX_DE_BORD_MODERNES.md)

### Routes Directes (Développement)
```
Dashboard Global:    http://localhost:5173/dashboard
Production Modern:   http://localhost:5173/dashboard/production-modern
Dashboard Legacy:    http://localhost:5173/dashboard/legacy
```

---

## ✅ Vérification

### Checklist Post-Mise à Jour

- [ ] Serveur redémarré
- [ ] Cache navigateur vidé
- [ ] Hard refresh effectué (Ctrl+Shift+R)
- [ ] Dashboard moderne s'affiche
- [ ] Animations fonctionnent
- [ ] Données se chargent
- [ ] Responsive fonctionne

### Test Rapide

1. **Accéder à** `http://localhost:5173/dashboard`
2. **Vérifier:** Vous devez voir 6 cartes animées avec gradients
3. **Hover:** Les cartes doivent grossir au survol
4. **Données:** Les métriques doivent être chargées
5. **Graphiques:** Performance 12 mois doit s'afficher

---

## 🎯 Résumé des Changements

### Ce Qui a Changé

| Élément | Avant | Maintenant |
|---------|-------|------------|
| Route `/dashboard` | DashboardPage (ancien) | GlobalDashboardEnhanced (nouveau) ✅ |
| Ancien dashboard | Supprimé | Conservé sur `/dashboard/legacy` |
| Terminologie | "Batch" | "Expéditions" ✅ |
| Design | Basique | Moderne avec animations ✅ |
| Graphiques | Simples | Interactifs et animés ✅ |

### Ce Qui est Nouveau

- ✅ Dashboard Global Enhanced sur route principale
- ✅ Dashboard Production Modern sur route dédiée
- ✅ Animations et effets 3D
- ✅ Responsive complet
- ✅ Terminologie mise à jour
- ✅ Documentation complète

---

## 🚀 Commandes Utiles

### Développement

```bash
# Démarrer le serveur
npm run dev

# Builder pour production
npm run build

# Vider le cache Vite
rm -rf node_modules/.vite && npm run dev

# Nettoyer complètement
rm -rf node_modules/.vite dist && npm run dev
```

### Débogage

```bash
# Vérifier les routes configurées
grep -n "path=\"/dashboard" src/App.tsx

# Vérifier les imports
grep -n "GlobalDashboardEnhanced" src/App.tsx

# Voir les erreurs TypeScript
npm run typecheck
```

---

**Date:** 13 Décembre 2025
**Version:** 1.1.0
**Status:** ✅ Route Principale Mise à Jour
**Accès:** http://localhost:5173/dashboard

---

## 💡 Note Importante

**Si vous voyez toujours l'ancien dashboard après avoir suivi ce guide:**

1. Vérifiez que le serveur tourne bien (`npm run dev`)
2. Videz complètement le cache (Ctrl+Shift+Delete)
3. Essayez en mode navigation privée
4. Vérifiez la console (F12) pour des erreurs
5. Redémarrez le serveur complètement

Le nouveau dashboard **doit** s'afficher automatiquement sur `/dashboard` maintenant! 🎉
