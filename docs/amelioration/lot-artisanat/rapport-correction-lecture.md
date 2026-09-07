# Correction ART-LECT-001 — détail artisan

La fiche distingue maintenant une source en cours de chargement, une source indisponible et une lecture réussie sans résultat. Le rejet des ventes ne produit plus un nombre de ventes, une quantité ou un chiffre d'affaires à zéro. Le rejet des infractions ne produit plus un nombre nul ni un dossier présenté comme vierge.

Chaque source possède son message et son bouton de reprise. La reprise des ventes ne relance ni l'identité ni les infractions ; la reprise des infractions n'affecte pas les ventes. L'identité peut être consultée même si une source annexe est lente. Les réponses d'un dossier quitté sont ignorées. Le profil Collecteur conserve la lecture seule et ne déclenche aucune lecture des infractions.

L'audit a demandé d'étendre l'isolation au changement du contexte d'accès, même si l'identifiant artisan et le caractère Collecteur ne changent pas. La fiche est désormais remontée avec une clé de dossier/contexte : utilisateur, organisme, mine, rôle attribué, rôle, catégorie de compte si présente, type d'organisme, activité, capacités, modules, sites, responsabilités et portail. Les anciennes données sont masquées immédiatement ; les réponses tardives sont ignorées ; les onglets et recherches reviennent à leur état initial. Les listes du contexte sont triées sur copie, sans modifier le profil. `account_type` n'existe pas dans le type `UserProfile` actuel : il est pris en compte uniquement si présent, sans inventer ce champ dans le modèle métier.

Les seules sources applicatives modifiées dans ce lot sont `src/pages/artisan-minier/ArtisanMinierDetails.tsx` et son test adjacent. Aucun formulaire Artisan, service d'écriture, workflow, permission ou migration n'est modifié. Le problème de concurrence de l'UPSERT site reste ouvert et séparé.

## Vérifications ciblées réellement exécutées

| Vérification | Résultat | Preuve |
|---|---|---|
| `npx vitest run --maxWorkers=2 --reporter=verbose src/pages/artisan-minier/ArtisanMinierDetails.test.tsx` | 32/32 réussis, code 0, départ 2026-09-07 06:15:46 UTC | `test-lecture-artisan.log` |
| `npx eslint src/pages/artisan-minier/ArtisanMinierDetails.tsx src/pages/artisan-minier/ArtisanMinierDetails.test.tsx` | Code 0, aucune sortie | `eslint-lecture-artisan.log` |
| Relecture du périmètre Git | Deux fichiers applicatifs uniquement pour cette correction ; les autres changements du dépôt appartiennent aux travaux parallèles | Empreintes dans `manifest-qualification.json` |

Cas ajoutés ou corrigés : double échec sans faux zéro, reprise ventes indépendante, nouvelle erreur puis reprise infractions réussie, lecture vide réellement réussie, source lente, réponse tardive après changement de dossier, 16 changements de contexte pris isolément, identité/sources tardives après changement d'organisme et bascule de l'onglet Infractions au contexte Collecteur. Les tests existants de navigation, recherche, identité et restrictions Collecteur restent exécutés. Les services du résumé et des sources annexes sont simulés ; ces tests ne contactent pas une base métier.

Une première exécution a trouvé 13 réussites et un échec de sélecteur du test : plusieurs zones `role=status` coexistent normalement. Le sélecteur a été limité au chargement des ventes ; la suite est passée à 14/14. Après le complément demandé par l'audit sur les contextes, l'exécution documentée ci-dessus passe à 32/32.

## Limites et recette restante

Ces résultats valident le comportement de composant sous Vitest/jsdom. Ils ne valident ni la page dans un navigateur réel, ni Auth, RLS, les données déployées, ni la chaîne d'enregistrement/relecture/suppression exigée par la mission. La compilation et la suite globale sont coordonnées par le pilote après le gel des sources. L'audit indépendant doit relire la modification et ses preuves avant fermeture du défaut.

La recette réelle devra simuler successivement une panne des ventes et des infractions dans une préproduction autorisée, observer les états et les reprises sur ordinateur/mobile, puis restaurer les lectures. Le formulaire et la persistance de l'artisan doivent être testés séparément : aucune réussite de sauvegarde n'est déduite de cette correction de lecture.
