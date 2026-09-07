# Lectures Production et Détails des sites

7 septembre 2026. Correctif local uniquement, sans migration, appel distant, modification de permissions ni de formulaire. Le hook partagé et Overview sont hors propriété de ce lot et n’ont pas été modifiés.

## Défauts reproduits

- Production présentait les compteurs, tableaux et classements avant la fin de la lecture, y compris les résultats d’une lecture précédente. Son hook ne redémarrait pas lors du changement d’organisation ou d’habilitation à utilisateur/route constants.
- Détails conservait la fiche, ses actions de modification, ses photos et son document AEA après l’échec d’un rafraîchissement. Une réponse AEA tardive pouvait encore apparaître dans la fiche invalidée.

La reproduction canonique `avant-reproduction.json` comporte **22 échecs et 3 réussites sur 25 scénarios**. Ce nombre inclut 16 variantes de contexte et ne désigne pas 22 anomalies indépendantes. `avant.json` est une première exécution conservée : plusieurs assertions d’absence y rencontraient des noms affichés deux fois (table et classement). Elles ont été rendues explicites avec une cardinalité nulle avant la seconde reproduction, toujours sur les sources non modifiées. Les deux sources originales sont conservées dans les fichiers `.before.txt`.

## Correction

`ArtisanalSiteProduction` utilise la même frontière de contexte que Détails : utilisateur, organisation, société minière, rôle, rôle d’accès, activité, portail, catégorie, type de compte, capacités, modules, sites affectés, responsabilités et domaines. Les tableaux sont triés pour qu’une permutation sans changement de droits ne déclenche pas de nouveau chargement. Le composant contenant le vrai hook est remonté à la nouvelle clé. Les réponses de l’ancien composant sont ignorées par le nettoyage existant du hook.

Un état de chargement unique remplace tous les résultats dépendant des lectures de Production. L’erreur propose « Réessayer ». Les statistiques et les états vides ne sont rendus qu’après une lecture réussie. Le header, les contrôles autorisés et les calculs existants sont conservés.

Dans Détails, un site exploitable n’est dérivé des données qu’en dehors des états d’attente et d’erreur. La branche existante d’indisponibilité et de reprise s’applique désormais aussi après un rafraîchissement échoué. Les photos sont démontées, les anciennes lectures de document AEA sont invalidées et leurs URL retirées ; une nouvelle réussite relance leur résolution, même si le service retourne la même référence d’objet. Les onglets et leurs fonctionnalités sont conservés après la reprise.

## Vérifications locales

```powershell
npx vitest run src/pages/artisanal-sites/ArtisanalSiteReadState.test.tsx src/pages/artisanal-sites/ArtisanalSiteProduction.test.tsx src/pages/artisanal-sites/ArtisanalSiteDetails.test.tsx src/hooks/useArtisanalSiteData.test.tsx --maxWorkers=2 --reporter=json --outputFile=docs/amelioration/lot-artisanat/lecture-production-details/apres.json
npx eslint src/pages/artisanal-sites/ArtisanalSiteProduction.tsx src/pages/artisanal-sites/ArtisanalSiteDetails.tsx src/pages/artisanal-sites/ArtisanalSiteReadState.test.tsx
npx tsc --noEmit -p tsconfig.app.json
git diff --check -- src/pages/artisanal-sites/ArtisanalSiteProduction.tsx src/pages/artisanal-sites/ArtisanalSiteDetails.tsx src/pages/artisanal-sites/ArtisanalSiteReadState.test.tsx
```

Tests ciblés : **34/34 sur 4 fichiers**, code 0. Lint et contrôle des espaces : code 0. Le résultat TypeScript final et les empreintes sont consignés dans `evidence.json` après sa terminaison.

Le nouveau fichier de tests utilise le **vrai hook**, ses événements de focus et de mutation, ses effets et nettoyages, ainsi que les calculs de production existants. Les lectures de service, Auth, Storage et le chrome sont remplacés par des doubles locaux ; les graphiques sont des coquilles de rendu pour vérifier leur présence/absence. Les tests couvrent attente, vrai vide, échec, reprise, les 16 variantes de contexte, les anciennes réponses/rejets, l’ancienne URL AEA et le retour des photos/onglets/actions après réussite. Les tests existants du hook, de conformité, clavier et galerie sont inclus sans modification.

Ces preuves ne constituent ni un test du navigateur réel, ni une validation de l’API, d’Auth/MFA, des permissions serveur ou de la persistance. Aucun déploiement, commit ni accès SQL n’a été effectué dans ce lot. La validation navigateur et l’audit indépendant sont coordonnés par l’agent principal.
