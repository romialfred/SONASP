# Vitrine publique : header et accès SONASP dorés

## Périmètre

Implémentation de la maquette fournie le 31 août 2026 : bandeau institutionnel
vert profond, cours de l'or dans une capsule bordée d'or, navigation centrée,
header ivoire à filet doré et boutons d'accès dorés. Logo, photographie,
contenus métier et données du cours de l'or conservés.

`PortalAccessButton` est partagé entre le header, son menu mobile, le hero et
l'appel à l'action final. Les colonnes d'icônes ont la même largeur de 20 px :
le libellé possède ainsi son propre axe central, indépendamment des icônes.
L'icône d'accès et la flèche sont décoratives (`aria-hidden`).

La connexion reste `/login`, comme dans le correctif d'entrée Owner déjà
présent dans le worktree. Aucun changement aux guards, permissions, services,
données, migrations ou politiques de sécurité dans ce lot.

## Interactions et accessibilité

- Dégradé or/champagne, texte vert sombre, icônes Lucide existantes.
- Survol souris : élévation de 2 px, reflet ponctuel, flèche de 3 px.
- Focus clavier contrasté et état pressé explicite.
- Préférence de mouvement réduit : aucun déplacement ni reflet.
- Hauteur minimale de 54 px pour les deux actions du hero.
- Ratios de contraste texte/fonds du dégradé : 9,72 ; 11,30 ; 8,14 ; 6,96.
- Styles limités à la vitrine publique, sans modification des boutons privés.

## Contrôles réalisés

Les assertions du header et du hero échouaient avant intégration sur l'absence
du nouveau composant, puis passent après correction.

Commande de non-régression :

```powershell
npx vitest run src/pages/public/PublicLayout.test.tsx src/pages/public/PublicHomePage.test.tsx src/pages/public/PublicComponents.performance.test.tsx src/components/auth/PortalEntry.integration.test.tsx src/components/auth/MinePortalGuard.test.tsx
npx vitest run src/pages/public/PortalAccessButton.styles.test.ts
```

Résultat : **58 tests, 6 fichiers réussis** (54 tests de parcours et 4 contrats
CSS exécutés séparément). Ces contrôles couvrent notamment
l'entrée SONASP, les garde-fous Owner/Mine existants, les icônes décoratives,
le menu mobile, Échap, le libellé anglais et la priorité du fond doré au survol
sur les anciennes règles vertes. ESLint ciblé et `git diff --check`
réussis. Build de production réussi (3 222 modules).

La capture et les mesures avant modification ont été examinées. **La validation
visuelle après modification, le centrage mesuré au pixel et les breakpoints ne
sont pas encore validés** : l'outil navigateur a bloqué l'aperçu local sur 5192
après une première connexion avant disponibilité du serveur. Une autorisation
explicite a été demandée pour terminer ces contrôles. Ne pas présenter les
tests DOM comme une preuve de conformité visuelle.

## Livraison locale

Build statique sur `http://127.0.0.1:5190/`, sans client HMR ni rechargement
automatique. Les assets précédents sont conservés pour les sessions ouvertes ;
l'entrée HTML est remplacée en dernier. Aucune publication en ligne ni commit.

Version servie vérifiée par HTTP : `local-mthnjkq6`, réponse 200.
Les contrats de fond doré au survol, colonnes symétriques et hauteurs égales
sont également présents dans les feuilles CSS du build final.
