# Reprise d’onglet — constat et correction locale du 30 août 2026

## Résultat et périmètre

L’adresse habituelle `localhost:5180` sert désormais le build compilé, sans
client HMR. `npm start` reconstruit puis sert ce build. La configuration de
lancement « SONASP Local » est placée en premier et utilise cette commande.
Le développement reste accessible via `npm run dev`, sur **5181** ; aucun port
automatique ne peut le déplacer silencieusement sur celui de la plateforme.

Ce changement ne modifie ni les écrans métier, ni les données, ni les durées de
session, ni les autorisations, ni les contrôles MFA/RLS. Aucun déploiement distant,
commit ou push n’a été effectué. Les modifications préexistantes sont conservées.

## Éléments observés

- La session Owner était ouverte dans Chrome sur
  `http://localhost:5180/national-reserve/allocations/new`.
- Ses scripts comprenaient `/@vite/client` et `/src/main.tsx` : le navigateur
  utilisait toujours le serveur de développement, malgré la présence antérieure
  d’une commande de prévisualisation stable sur un autre port.
- `PlatformLoading` et son sablier ne contiennent ni timer de rechargement, ni
  écouteur de focus, ni appel réseau. C’est un affichage, pas le déclencheur.
- Le client Vite installé appelle `location.reload()` après la reconnexion de son
  WebSocket (`vite:ws:disconnect → waitForSuccessfulPing`). Certaines tentatives
  reprennent lorsque le document redevient visible. Ce mécanisme est extérieur à
  React, à Supabase Auth et au minuteur d’inactivité.
- Reproduction isolée sur 5182 : après arrêt/redémarrage du serveur de
  développement, trace `server connection lost. Polling for restart...`, puis
  écran « Ouverture de la plateforme » sans clic sur Recharger.
- Contre-test sur le même port avec le build statique : arrêt/redémarrage du
  serveur, saisie témoin conservée, vérifiée visuellement avant et après.
- Sur 5180, réponse HTTP 200 avec assets compilés ; absence de `/@vite/client` et
  de `/src/main.tsx`. Le navigateur charge `/assets/index-DJG5G4EW.js`.
- Build local observé : `local-mtflba4h`.

Cette reproduction établit une cause réelle de rechargement et son élimination
dans le mode local fourni. Elle ne prouve pas que toutes les occurrences
historiques rapportées par l’utilisateur provenaient de Vite. Le premier essai
court sur la session Owner avait conservé le filtre saisi.

## Vérifications

- Deux tests de configuration échouaient avant correction, puis passent.
- Nouveau test d’intégration avec `AuthProvider`, `MandatoryMfaGate`,
  `ProtectedRoute` et routes réelles : cinq cycles de reprise et de renouvellement
  de jeton conservent le même champ, sa valeur et un seul montage ; la déconnexion
  démonte le contenu privé et affiche la route de connexion.
- **9 fichiers / 55 tests ciblés réussis**, couvrant également PWA, session,
  expiration, Owner, Administrateur et frontières de portails.
- Le premier lancement de cette passe a été interrompu : le nouveau harnais
  n’avait pas de route `/login` et rebouclait sur sa redirection. Le harnais a été
  corrigé ; aucun test ni contrôle produit n’a été neutralisé.
- `npm run lint` et `npm run typecheck` réussis.
- Build de production réussi : 3 204 modules ; génération PWA réussie.
- `git diff --check` réussi.

La suite globale de 1 756 tests de la correction précédente n’a pas été relancée
pour ce changement de lancement local ; son résultat n’est pas présenté comme
une nouvelle validation globale.

## Limite du contrôle connecté

Après le rechargement volontaire nécessaire pour charger le bundle stable,
l’onglet Owner affichait la connexion. Une reconnexion a été demandée à
l’utilisateur. Aucune saisie de mot de passe, lecture de jeton ou modification de
compte réel n’a été effectuée. Le contrôle final de retour d’onglet dans une
session Owner reconnectée reste à confirmer.

## Exploitation

- Usage de la plateforme : `npm start`, port **5180**.
- Build déjà vérifié : `npm run serve:local`, port **5180**.
- Développement avec mises à jour à chaud : `npm run dev`, port **5181**.
- Prévisualisation historique : `npm run preview:stable`, port **5190**.
- Après modification du code : reconstruire explicitement puis recharger
  volontairement, après sauvegarde du travail en cours.

Ne pas réintroduire `vite --port 5180` comme lancement utilisateur. L’expiration
réelle, la révocation et la MFA restent obligatoires ; le test de stabilité ne
doit pas les désactiver.
