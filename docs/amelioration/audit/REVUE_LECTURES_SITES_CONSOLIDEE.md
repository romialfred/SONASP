# Revue indépendante des lectures Sites

7 septembre 2026. Audit local des pages Vue d’ensemble, Production et Détails, après le complément « Non évalué ». Aucun fichier applicatif ou test applicatif modifié par l’auditeur ; aucun navigateur, SQL distant, changement de permissions, migration ou déploiement utilisé pour cette revue.

## Avis borné

Les correctifs de lecture sont recevables techniquement sur le snapshot contrôlé. Aucun défaut supplémentaire concret n’a été relevé dans ce delta. Le rejeu indépendant termine avec **97 tests réussis sur 97, dans 7 fichiers, code processus 0, fin Vitest `passed`, aucune erreur non gérée**. Les 23 entrées sources, tests et configuration suivies n’ont pas changé pendant le run du **13:57:13 au 13:57:56 UTC**.

Cet avis ne valide pas les permissions serveur, la connexion réelle, les lectures de Storage ou la persistance. Les parcours navigateur sur le banc mémoire sont une preuve distincte, conduite par l’agent principal. La suite globale précédente à 2 870 assertions présente une discordance de code de sortie décrite dans `REVUE_SORTIE_GLOBALE_2870.md` ; le présent rejeu ciblé ne la transforme pas en succès global.

## Version examinée

Base déclarée des lots : `901b5ebbc9b62ef9c9a7e65579c07d8e6c1fc27c`, avec modifications locales. Les SHA complets sont consignés dans `sites-read-independent-20260907.evidence.json`.

| Source | SHA256 abrégé |
|---|---|
| ArtisanalSitesOverview.tsx | `4e0bbda969ec17aa` |
| ArtisanalSiteProduction.tsx | `7d5c82201e32effc` |
| ArtisanalSiteDetails.tsx | `eb982246e697cf5c` |
| artisanalSiteInsights.ts | `e354ef795d695afb` |
| useArtisanalSiteData.ts, inchangé | `ce383610c24a2ac6` |

La comparaison indépendante des manifestes `lecture-production-details/evidence.json` et `overview-conformite/evidence.json`, des artefacts Production/Détails et des entrées de notre rejeu donne **49 correspondances sur 49**. Le reçu est `sites-read-manifests-independent.evidence.json`. Le manifeste initial `overview-lecture` reste une preuve historique du correctif de lecture ; ses anciennes empreintes ne sont pas attribuées au dernier delta de conformité.

Lint et typage : les lots annoncent les codes 0 et conservent leurs journaux. Les empreintes de leurs sources correspondent à notre version. Ces deux portes ne sont pas présentées comme des réexécutions de l’auditeur ; notre exécution indépendante porte sur les tests ciblés et le contrôle des manifestes.

## Constats sur les lectures

- **Portée Auth.** La recherche des appelants du hook partagé retrouve uniquement les trois pages examinées. Chacune remonte le composant contenant le vrai hook lorsque change l’utilisateur, l’organisation, la société minière, le rôle, l’activité, le portail, la catégorie, le type de compte, les capacités ou les listes de périmètre. Détails inclut aussi l’ID du site. Le tri se fait sur des copies des tableaux. Le hook partagé et les vérifications de permissions ne sont pas assouplis.
- **Disponibilité.** Vue d’ensemble et Production ne rendent filtres dépendants, compteurs, cartes, graphiques ou tableaux qu’après une lecture réussie. L’attente et l’erreur sont distinctes d’une liste effectivement vide. Détails retire la fiche et ses actions quand la lecture est invalidée ; un refus ne devient plus un faux « introuvable ».
- **Réponses tardives.** Le nettoyage existant du vrai hook invalide les réponses et rejets du composant précédent. Les tests couvrent aussi deux rafraîchissements successifs d’un même contexte et les événements de navigation, mutation et focus.
- **AEA et photos.** Détails ne dérive un site exploitable qu’en dehors de l’attente et de l’erreur. L’effet AEA perd sa référence, efface l’URL et invalide l’ancienne promesse ; les photos sont démontées. Une reprise réussie résout à nouveau l’AEA même lorsque le service fournit la même référence d’objet. Les onglets et les actions reviennent après réussite. Une URL tardive du dossier invalidé est ignorée.
- **Conformité.** Le seul appelant applicatif de `computeGlobalCompliance` est Vue d’ensemble. L’absence de sites évalués retourne maintenant `null` et affiche « Non évalué » sans jauge. Un score réellement égal à zéro reste évalué, conserve sa jauge et participe à la moyenne ; les sites planifiés restent exclus. Aucun autre calcul de la formule n’est changé dans ce delta.

## Exécution indépendante

Commande reproductible :

```powershell
node docs/amelioration/audit/run-sites-read-audit.mjs
```

Ce runner appelle directement le processus Node de Vitest, conserve stdout et stderr séparément, enregistre le code de sortie et utilise `run-end-errors-reporter.mjs` pour recueillir les erreurs de fin du moteur. Il refuse d’écraser une preuve déjà présente.

| Fichier de tests | Cas exécutés |
|---|---:|
| ArtisanalSitesOverview.test.tsx | 39 |
| ArtisanalSiteReadState.test.tsx | 25 |
| ArtisanalSiteProduction.test.tsx | 2 |
| ArtisanalSiteDetails.test.tsx | 5 |
| useArtisanalSiteData.test.tsx | 2 |
| artisanalSiteInsights.test.ts | 22 |
| site-photos-reprise-independent.test.tsx | 2 |
| **Total dédupliqué** | **97** |

Les tests de nouveaux états de lecture, ceux d’Overview et les deux contrôles indépendants de Détails utilisent le vrai hook. Le fichier historique `ArtisanalSiteDetails.test.tsx` remplace ce hook pour ses cas de conformité, clavier et galerie ; il n’est pas qualifié de test d’intégration du hook. Auth, transport des services, résolution Storage, disposition générale et graphiques demeurent simulés. Les 38, 34 et 63 cas des reçus d’implémentation se recouvrent et ne doivent pas être additionnés comme autant de contrôles indépendants.

Artefacts : `sites-read-independent-20260907.{json,stdout.txt,stderr.txt,run-end.json,evidence.json}` ; contrôle des manifestes par `verify-sites-read-manifests.mjs`. Le stderr du rejeu est vide.

## Portes qui restent distinctes

Cette revue n’établit pas la fidélité visuelle complète ou le fonctionnement distant de toutes les opérations du module. Elle ne clôt ni la recette R02 des photos/AEA/modification/nettoyage, ni le plan de concurrence `SITE-CONC-004`. Les changements hors manifeste observés dans la comparaison R02 ne sont pas attribués à notre recette et ne sont pas à nettoyer par déduction. Aucune autorisation de publication n’est déduite du résultat local.
