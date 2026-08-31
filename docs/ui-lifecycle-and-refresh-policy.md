# Politique de cycle de vie et d’actualisation de l’interface

## Invariant

Le retour sur un onglet SONASP ne doit jamais démonter le shell applicatif ni
remplacer une page déjà utilisable par un loader global. La sidebar, le header,
le footer, la route et les saisies locales restent montés tant que la session
n’est pas réellement expirée.

## Cause racine corrigée

`vite-plugin-pwa@1.3.0` installe, en mode `prompt`, un listener Workbox sur
`controlling`. Sans callback `onNeedReload`, la bibliothèque appelle directement
`window.location.reload()`. Quand un utilisateur acceptait une mise à jour dans
un autre onglet, `clientsClaim` rendait le nouveau worker contrôleur de tous les
onglets SONASP. Chaque onglet exécutait alors ce reload, y compris un formulaire
masqué ; l’utilisateur ne voyait le résultat qu’à son retour.

Chaîne observée dans le code livré par la dépendance :

```text
worker en attente
→ activation dans l’onglet A
→ controllerchange / controlling dans A, B, C
→ fallback window.location.reload() dans chaque onglet
→ bootstrap React + loader global + reconstruction du shell
```

`PwaUpdatePrompt` fournit désormais `onNeedReload` et mémorise l’intention par
onglet. Seul l’onglet ayant reçu le clic « Mettre à jour maintenant » peut être
rechargé. Les autres gardent leur interface et proposent « Recharger maintenant »
sans interrompre le travail.

## Amplificateur côté authentification corrigé

Supabase peut réémettre `SIGNED_IN` pour la session courante à la reprise d’un
onglet. Ce renouvellement est maintenant traité comme celui du même principal
dès que la session initiale est connue, même si une revalidation du profil est
en cours. Il ne remet ni `user` à `null`, ni `profileLoading` à `true`.

Les revalidations explicites du profil et `USER_UPDATED` sont atomiques : un
profil déjà affiché reste en place jusqu’à la réussite de son remplacement. Une
panne transitoire conserve l’interface et expose l’erreur localement. Les règles
RLS et les contrôles serveur restent l’autorité de sécurité.

## Politique des loaders

- **Bootstrap plateforme** : autorisé uniquement lors du premier chargement du
  bundle privé ou de la restauration initiale d’une session.
- **Chargement de page** : reste dans la zone `<main>` ; le shell demeure visible.
- **Actualisation locale** : conserve les données précédentes et utilise au plus
  un indicateur dans le composant concerné.
- **Token refresh, focus, online, pageshow** : aucun loader global.
- **Session réellement expirée** : fermeture locale contrôlée par
  `SessionManager`, puis transition vers la connexion.

## Politique focus, réseau et données

Le projet n’utilise ni React Query, ni SWR, ni Apollo, ni store Redux/Zustand.
Il n’existe donc aucune invalidation globale de cache au focus. Un listener
`visibilitychange` subsiste volontairement dans `SessionManager` : au retour
visible, il vérifie l’échéance d’inactivité sans enregistrer une activité, sans
refetch et sans reload. Sous l’échéance, il ne modifie aucun état React.

Les données périssables (notifications, cours, statuts) peuvent être rechargées
silencieusement par leur composant. Les référentiels, permissions, menus et
profil ne sont revalidés qu’au bootstrap ou après une action explicite.

## PWA et multi-onglets

Règles obligatoires :

1. `registerType` reste `prompt` et `skipWaiting` reste `false`.
2. Tout appel au reload PWA passe par `reloadCurrentDocument`.
3. `onNeedReload` doit toujours être fourni au hook d’enregistrement.
4. Une activation externe ne recharge jamais l’onglet courant.
5. La fermeture du prompt ne déclenche ni activation ni reload.

## Usage local et développement — correction du 30 août 2026

L’adresse habituelle `http://localhost:5180` (également accessible via
`127.0.0.1:5180`) est désormais réservée au build compilé, sans `/@vite/client`,
WebSocket HMR ni surveillance des fichiers. La cible de lancement par défaut est
« SONASP Local » :

```bash
npm start
```

Cette commande reconstruit la version puis lance `serve:local` sur un port strict.
Après un build déjà vérifié, `npm run serve:local` sert uniquement ce build.
Ne pas lancer un serveur Vite de développement en forçant `--port 5180`.

`npm run dev` / « SONASP Dev » utilisent **5181**. Ce mode reste réservé au travail
sur le code : il peut recharger une page à la reconnexion de son WebSocket, même
sans changement de fichier. Le client Vite attend notamment le retour visible
d’un onglet pour reprendre certaines tentatives de reconnexion, puis appelle
`location.reload()` après une réponse positive. Supprimer un listener de focus
dans React ou modifier le sablier ne peut pas empêcher ce reload externe.

Reproduction contrôlée : sur un serveur Vite isolé, arrêt/redémarrage du serveur,
trace « server connection lost. Polling for restart... », puis apparition du
loader initial sans clic et réinitialisation de la saisie. Le code installé de
Vite confirme le chemin `vite:ws:disconnect → waitForSuccessfulPing → reload`.
Cette reproduction établit le mécanisme ; elle ne constitue pas une preuve que
chaque occurrence historique rapportée par l’utilisateur avait cette même cause.

La cible historique « SONASP Test » reste disponible sur `127.0.0.1:5190`.
Une nouvelle version locale s’applique par un build explicite et un rechargement
volontaire, après enregistrement du travail. Un build n’est pas un déploiement
de production. Ne jamais recopier une session entre `localhost` et `127.0.0.1` :
ce sont des origines distinctes.

## Protections de non-régression

Les tests doivent conserver les garanties suivantes :

- `controlling` externe : aucun reload, prompt local seulement ;
- `blur`, `visibilitychange`, `focus`, `pageshow` : aucune activation PWA ;
- `SIGNED_IN` du même principal pendant une revalidation : même shell, même
  nœud de formulaire, même valeur non enregistrée ;
- `TOKEN_REFRESHED` du même utilisateur : aucun nouveau contrôle MFA ;
- retour visible sous le délai : aucun sign-out ;
- retour visible au-delà du délai : un unique sign-out local ;
- `app-shell`, `app-sidebar`, `app-header` et `app-footer` restent les repères
  stables des validations d’intégration et E2E.
