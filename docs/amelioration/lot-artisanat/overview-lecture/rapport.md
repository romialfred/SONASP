# Overview Sites — lecture, erreurs et changement de contexte

7 septembre 2026. Baseline locale examinée : `901b5ebb`. Correctif limité à `src/pages/artisanal-sites/ArtisanalSitesOverview.tsx` et son test. Plan suivi : `docs/amelioration/audit/PLAN_CORRECTION_LECTURE_OVERVIEW.md`.

## Défaut reproduit

Le vrai hook `useArtisanalSiteData` conserve ses tableaux pendant les relectures et après un rejet. Il ne dépend pas du profil Auth ; à route constante, un changement de périmètre ne déclenche donc pas de nouvelle lecture à lui seul. La page présentait les tableaux conservés, ou des zéros issus de tableaux vides, simultanément à l’erreur. Une clé posée uniquement sur la table n’aurait pas remis à zéro l’état du hook.

Les tests ajoutés contre le code avant correction ont produit **26 échecs et 10 réussites, sur 36 cas de page** (`red.log`). Les 28 nouveaux cas complètent les 8 tests de page existants ; deux nouveaux cas de conservation étaient déjà satisfaits avant le correctif.

## Changement réalisé

Un composant enveloppe indexe l’intégralité du contenu et son appel au vrai hook sur la même portée Auth que la page Details, sans l’ID de fiche. Ses 16 dimensions sont : utilisateur, organisation, société minière, rôle d’accès, rôle, type d’organisation, activité, ID et code de portail, catégorie d’acteur, type de compte, capacités, codes de modules, sites, responsabilités et domaines de modules. Les cinq listes sont triées pour éviter un rechargement dû à leur seul ordre.

Ce remontage efface les anciennes données dès le changement de contexte ainsi que la recherche, les filtres, les onglets, la pagination et le panneau de dates. Le nettoyage du hook existant continue d’ignorer les réponses et rejets obsolètes.

Le header, le bouton d’actualisation et l’action de création autorisée restent rendus. Tous les blocs issus des données, y compris les options de région, ont désormais trois états exclusifs :

- chargement : message accessible « Chargement des données des sites… » ;
- erreur : message existant, sans détail technique, et bouton « Réessayer » ;
- réussite : filtres, indicateurs, carte, vigilance, graphiques et tableau habituels.

Une réponse réussie vide peut afficher les vrais zéros et l’absence de sites. Un chargement ou un rejet ne peut plus afficher cette branche. Les seuils métier, références indisponibles, libellés fiscaux et « Fiches à actualiser » restent inchangés.

## Preuves locales

Le vrai `useArtisanalSiteData` est importé par la page pendant les tests. Aucun mock ne remplace ce hook. Le transport du service, Auth, la localisation de route, le cadre de page et les composants de graphiques sont doublés explicitement.

| Couverture | Cas |
| --- | ---: |
| Tests de page existants : filtres, noms, catégories, jauge et références indisponibles | 8 |
| Chargement initial/rejet/reprise, réussite vide, relecture échouée puis reprise vide | 3 |
| Changement isolé de chacune des 16 dimensions Auth | 16 |
| Profil absent | 1 |
| Réponse et rejet tardifs d’une relecture de l’ancien contexte | 2 |
| Déclencheurs navigation, mutation et focus | 3 |
| Réponse tardive après deux relectures du même contexte | 1 |
| Réinitialisation des filtres/pagination/panneau et stabilité lors du tri des listes | 2 |
| Tests préexistants du hook, non modifiés | 2 |
| **Total ciblé** | **38** |

Le premier rejeu après correction réussit **38/38** (`targeted.log`). Le rejeu final réussit également **38/38**, code 0, avec empreintes avant/après identiques (`frozen-tests.log`, `evidence.json`). ESLint sur les deux fichiers modifiés réussit avec code 0 (`lint.log`, vide car aucun diagnostic). `npm run typecheck:compiler` réussit avec code 0 (`typecheck.log`). `git diff --check` sur les deux fichiers retourne 0 ; seuls les avertissements Git de conversion LF/CRLF sont émis.

## Limites et périmètre préservé

Ces preuves vérifient le comportement du composant dans un DOM de test et le cycle réel du hook. Elles ne constituent pas une recette navigateur, une preuve visuelle, une connexion réelle ni une vérification de persistance en base. Aucun appel distant, SQL, changement de service, de hook partagé, de permission, de workflow, de formulaire, de Storage, commit ou déploiement n’a été effectué par cet agent.

Les pages Production et Details, l’alignement des filtres du graphique mensuel et le score global quand aucun site n’est noté restent hors de ce correctif. Les clés de contexte protègent les états d’affichage ; les contrôles d’accès existants dans les routes et services restent responsables de l’autorisation.
