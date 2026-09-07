# Audit du hook Sites et correctif minimal proposé pour Overview

7 septembre 2026. Lecture seule des sources pendant le gel de la suite globale ; aucun nouveau test ni modification applicative. Cette note propose le prochain patch, elle ne le déclare pas réalisé.

## Contrat réellement observé

`useArtisanalSiteData` est utilisé par exactement trois pages applicatives : `ArtisanalSitesOverview`, `ArtisanalSiteProduction` et `ArtisanalSiteDetails`. Le formulaire Sites utilise ses propres lectures et n’est pas un appelant de ce hook.

Le hook charge le couple sites/productions par `artisanalSiteService.loadSiteData()`. Ce service refuse les échecs de ses lectures et ne remplace pas les données par des fixtures. La pagination stricte appartient au service et n’a pas à être réécrite pour ce défaut d’affichage.

Le hook recharge sur `location.key`, révision de rafraîchissement et message d’erreur. Il écoute également `SITE_DATA_CHANGED` et le retour du focus fenêtre. Chaque effet possède une variable `current` invalidée à son nettoyage : une réponse ancienne arrivée après un nouvel effet ou après démontage n’écrase donc pas le nouvel état. Les deux tests actuels couvrent ces déclencheurs et une réponse tardive après rafraîchissement.

En revanche, le hook n’observe pas Auth. Un changement d’organisme ou d’habilitation du même compte ne crée pas, à lui seul, une nouvelle lecture. Il conserve aussi `sites` et `productions` lors du chargement et dans le `catch`. Après un échec initial les tableaux restent vides ; après un échec de rafraîchissement ils contiennent encore le dernier résultat. C’est aux appelants de ne pas présenter ces valeurs comme un résultat nouvellement confirmé.

Les routes privées rendent leurs enfants sans clé de périmètre. `ProtectedRoute` contrôle l’accès et peut retourner un écran de refus, mais ne garantit pas un remontage quand un utilisateur passe entre deux périmètres tous deux autorisés sur la même route. Ce contrôle de route ne remplace donc pas une frontière de données locale.

## État des trois appelants

| Appelant | Périmètre Auth | Chargement et erreur | Conclusion bornée |
| --- | --- | --- | --- |
| Overview | Aucun wrapper de contexte autour du vrai hook | Les tuiles, carte, graphiques et lignes restent rendus ; seule une alerte s’ajoute à l’erreur. Le vide de tableau est conditionné par `!loading`, mais pas par l’absence d’erreur. | P1 à traiter : anciens éléments conservés ou faux zéros/absence ; changement de périmètre non invalidant. |
| Production | Aucun wrapper de contexte | L’erreur remplace le contenu, mais les métriques et certaines lignes restent visibles pendant le chargement. | Voisin préexistant : portée et attente à cadrer séparément. L’état d’erreur lui-même est déjà distinct. |
| Details | Wrapper complet ajouté par SITE-SCOPE, incluant le vrai hook, ID, Auth et états AEA/photos | Le chargement initial est distinct ; après une réussite, une erreur ultérieure laisse la fiche ancienne avec une alerte car `site` reste présent. | Le changement de contexte est corrigé ; qualifier séparément le comportement de relecture échouée avant de déclarer la fiche entièrement validée. |

Il s’agit d’une analyse de chemins de code. Aucun nouveau scénario navigateur ou de base n’est attribué à ces constats.

## Patch recommandé, limité à Overview

1. Ajouter un composant enveloppe qui lit Auth et construit la même clé complète que Details et les registres Collecteurs : utilisateur, organisme, société minière, rôle d’accès, rôle, type d’organisme, activité, portail, catégorie, type de compte et listes triées de capacités/modules/sites/responsabilités/domaines.
2. Déplacer le corps existant, y compris **l’appel réel à `useArtisanalSiteData`**, dans le composant enfant indexé par cette clé. Le changement de périmètre remonte le hook et remet à zéro les recherches, filtres, pagination et états de panneaux. Ne pas poser seulement une clé sur une carte ou sur le tableau.
3. Conserver le header, les contrôles autorisés et le style existants. Entourer tous les blocs dépendant des données — tuiles, carte/classements, vigilance, graphiques, contributions et tableau — par une branche d’état : attente explicite pendant `loading`, erreur et bouton « Réessayer » si `error`, contenu chiffré uniquement après une lecture réussie.
4. N’afficher « aucun site » et les vrais zéros qu’après une réussite avec un ensemble vide. Une erreur ne doit pas entrer dans cette branche. Ne pas se limiter à vider les tableaux dans le `catch` : les anciens calculs afficheraient alors des zéros tout aussi non confirmés.
5. Réutiliser `refresh` et le nettoyage existants. Aucun changement de service, RPC, droits, schéma, règles de conformité, formulaires ou Storage n’est nécessaire.

Ce patch touche uniquement `ArtisanalSitesOverview.tsx` et son test une fois le gel levé. Il ferme le défaut de cette page sans changer silencieusement le comportement des deux autres appelants du hook. Une refonte générale du hook vers une machine d’états n’est pas nécessaire pour ce correctif borné.

Si l’équipe choisit ensuite de centraliser la portée Auth dans le hook, elle devra prévoir un masque **synchrone** des données de l’ancien périmètre, un état associé à la clé courante et des tests pour ses trois appelants. Ajouter seulement une dépendance Auth à `useEffect` laisse un rendu possible des anciennes données avant l’effet et ne remet pas les filtres locaux à zéro. Cette extension ne doit pas être glissée dans le patch minimal sans requalifier son périmètre.

## Vérifications à exécuter après autorisation de dégeler

- Rejet initial : alerte et reprise, aucune statistique zéro, aucune jauge, aucune liste vide confirmée.
- Réussite avec données puis rafraîchissement en attente et rejet : anciens noms, montants, compteurs, graphiques et actions de ligne masqués ; reprise vers une vraie liste vide possible.
- Changement d’organisation ou de rôle d’accès à utilisateur/route constants : anciennes données masquées dès le rendu et nouvelle lecture du vrai hook, puis nouvelle réponse visible.
- Réponse ou rejet tardif de l’ancien contexte après réussite du nouveau : aucun remplacement ni erreur parasite.
- Navigation, événement `SITE_DATA_CHANGED` et focus fenêtre : mécanismes conservés ; pas de double soumission métier car la page ne réalise qu’une lecture.
- Filtres/pagination sous données réussies et nouvelles mentions « référence non disponible » / « Fiches à actualiser » : conserver les comportements du lot d’indicateurs.
- Vérification de l’interface réelle sur le build courant, en distinguant le résultat de lecture des preuves de persistance R02.

Aucune de ces vérifications futures n’est comptée comme exécutée dans cette note. Les voisins Production/Details, l’alignement des filtres des graphiques, le score global sans site noté et la concurrence d’écriture SITE-CONC-004 restent des sujets distincts.
