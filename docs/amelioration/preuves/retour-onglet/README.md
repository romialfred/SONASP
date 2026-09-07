# Retour dans l’onglet — correctif local R05

Date : 7 septembre 2026. Source : commit local `c42b76e1`, branche `codex/amelioration-integrale`.

## Défaut reproduit et périmètre

Le hook commun aux pages Sites relançait la lecture à chaque événement `focus` de la fenêtre. Il passait immédiatement en chargement, ce qui retirait le contenu de ces pages et affichait le sablier. Sur le banc, une réponse retardée de cinq secondes rend ce défaut observable.

Le correctif retire ce déclencheur. La navigation, les mutations et l’actualisation explicite continuent à relire les données ; la protection contre les réponses tardives et le changement de périmètre demeure. La page Production dispose maintenant du bouton Actualiser, désactivé pendant le chargement.

Ce périmètre n’établit pas que toute page blanche sur toute la plateforme avait cette origine. Aucun changement Auth, MFA, permissions, migration ou service worker n’a été effectué dans ce lot.

## Vérifications

- Avant correction : le nouveau test du hook échoue avec `loading: true` après retour simulé (processus de test 42551, code de sortie 1).
- Suite finale : **113 tests sur 113 réussis**, 9 fichiers, code de sortie 0 ; résultat intégral dans `tests-verifies.json`.
- TypeScript `tsc --noEmit -p tsconfig.app.json` : code 0.
- ESLint sur les cinq fichiers source/test modifiés : code 0.
- Contrôle des libellés français et `git diff --check` ciblé : code 0.
- Compilation Vite finale : code 0, 3 370 modules transformés ; génération PWA réussie.

La suite comprend le hook Sites, les pages et formulaires Sites, les états d’erreur/vide et changements de périmètre, ainsi que les tests existants Auth, MFA et actualisation PWA. La suite globale de la plateforme n’a pas été réexécutée dans ce lot.

`tests-apres.json` (110/113) et `tests-final.json` (112/113) sont des **résultats intermédiaires en échec**, conservés pour la traçabilité. Les anciens tests déclenchaient volontairement une actualisation au focus ; ils utilisent désormais le bouton ou l’événement de mutation, sans retirer les assertions de sécurité et d’état. Le deuxième échec a révélé l’absence du bouton Actualiser dans Production, ajoutée ensuite. Seul `tests-verifies.json` est le résultat final.

## Vérification de l’interface

Banc local isolé à `http://127.0.0.1:5188`, composants et hook réels, données/Auth/Storage simulés en mémoire. Aucun enregistrement en base.

1. Avant correction, saisir Site QA, retarder la lecture puis déclencher le retour d’onglet simulé : contenu retiré et loader visible (`avant-retour.jpg`, `avant-retour.txt`).
2. Après correction, saisir Site QA, choisir Nord et Régions, puis déclencher trois retours simulés : contenu et choix conservés, aucune nouvelle lecture (`apres-retour.txt`, `apres-retour.jpg`, `apres-filtres.jpg`).
3. Sur Production, le retour simulé conserve les indicateurs et laisse Actualiser disponible (`production-retour.txt`). Le clic sur Actualiser déclenche bien la lecture et son état de chargement (`production-actualiser.txt`).

Ces commandes émettent `blur`, `visibilitychange`, `focus` et `pageshow` ; elles ne constituent pas un changement natif d’onglet dans une session Chrome authentifiée. Cette dernière vérification reste à faire : l’accès du débogueur à la session était indisponible, puis les onglets 5192 ont été observés sur la page de connexion. Aucune extraction de session ni aucun contournement de l’authentification n’a été réalisé.

## Audit et disponibilité

L’agent audit_independant a relu le diff, le rapport final et les captures. Avis favorable, sans défaut bloquant identifié sur ce périmètre. Il n’a pas réexécuté indépendamment les tests et confirme la limite de la recette simulée.

Candidate locale : `http://127.0.0.1:5192`, build `local-mtrhis96`, dossier `node_modules/.cache/retour-onglet-r05`. Contrôles HTTP : `/login` 200, `/build-version.json` 200 avec cet identifiant, bundle `index-DMkv62Wi.js` confirmé. Le serveur précédent R03 du port 5192 a été remplacé ; les autres prévisualisations sont préservées.

Un rechargement explicite de l’application est nécessaire pour charger cette candidate dans un onglet qui utilisait encore l’ancien bundle. Aucune publication distante, aucun push Git et aucune migration Supabase dans ce lot. Toute publication reste soumise au Go explicite de l’utilisateur.
