# Complément d’audit — contexte d’accès des registres

Ce complément succède au correctif local décrit dans `CORRECTION.md`. L’audit indépendant a reproduit un défaut supplémentaire : les deux pages pouvaient conserver le périmètre précédent après un changement d’organisation ou de rôle d’accès du même utilisateur, sans navigation.

La preuve indépendante initiale `docs/amelioration/audit/collector-comptoir-scope-before.json` contient **4 échecs sur 4** : conservation des lignes de l’ancien organisme, puis absence de nouvelle lecture lors d’un changement de rôle avec une réponse ancienne retardée. Aucun schéma, droit ou formulaire n’a été modifié pour corriger ce défaut.

Chaque page possède désormais une frontière de composant indexée par son contexte complet : utilisateur, organisme, société minière, rôle d’accès, rôle, type d’organisme, activité du profil, portail, catégorie d’acteur, type de compte, capacités, modules, sites affectés, responsabilités et domaines. Les listes sont triées avant construction de cette clé pour éviter une nouvelle lecture due au seul ordre de leurs éléments. La clé Collecteurs inclut aussi l’ID de la fiche.

Une modification de ce contexte détruit les anciens états locaux avant le nouveau rendu : résultats, recherches/filtres, erreurs, notifications et, pour Collecteurs, justification et échéance de délégation. Le mécanisme de requête courante ignore les réponses de l’ancienne instance après démontage. Les contrôles serveur et les permissions applicatives existantes restent l’autorité d’accès.

## Résultats

Le rejeu `apres-scope-final.json` passe **78/78 tests dans 9 fichiers**, comprenant les quatre reproductions indépendantes ainsi qu’un nouveau scénario de remise à zéro de la délégation après changement des capacités. Le test et la configuration de permission existants ne sont pas affaiblis ; seuls les doubles Auth des tests de page sont renseignés pour ce nouveau consommateur du contexte.

Le manifeste final du lot est `correction-scope-evidence.json`. Les preuves `apres-final.json` et `correction-evidence.json` sont conservées comme étape antérieure au complément de contexte. La vérification distante de l’ordre du RPC est consignée séparément lorsqu’elle est fournie par root ; aucun test SDK à transport simulé ne la remplace.

Les limites de `CORRECTION.md` et `pagination-compatibilite.md` restent applicables. Aucun commit, push, déploiement, changement de schéma ni écriture distante par cet agent pour le correctif Collecteurs/Comptoirs.
