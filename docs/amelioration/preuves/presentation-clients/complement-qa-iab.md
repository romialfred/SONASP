# Complément de contrôle navigateur — Clients

7 septembre 2026. Agent principal, navigateur intégré, onglet de travail dédié au port local **5187**. Cette inspection complète la QA indépendante Chrome du rapport voisin ; elle ne constitue pas une validation indépendante de mon propre code.

## Portée et méthode

Composants applicatifs réels, données fixtures explicitement signalées par le bandeau permanent. Aucun accès réel Auth/MFA, aucune requête de recette vers la production, aucune persistance UI → API → base testée. La sauvegarde est volontairement refusée par ce banc de présentation.

Dimensions testées : **1536 × 1024** et **390 × 844**. Le cadre principal de l’application possède son propre défilement : les fichiers sont des captures de viewport et de sections successives, pas des captures intégrales de document. Le zoom navigateur à 200 % n’a pas été exécuté. Les dimensions temporaires ont été réinitialisées après le contrôle.

La première capture effectuée immédiatement après certains changements de viewport présentait un canvas incomplet. Ces captures ont été rejetées et reprises après observation de l’état responsive stabilisé. Les fichiers finaux sont les octets JPEG natifs renvoyés par CUA, avec extension `.jpg`, sans recadrage, génération ni retouche. Le manifeste complémentaire contient leurs dimensions et empreintes. Les fichiers 01–05 du rapport indépendant précédent ne sont pas réécrits ; ils conservent leur version et leurs limites propres.

## Contrôles effectivement observés

| Contrôle de présentation | Résultat observé | Preuves |
|---|---|---|
| Registre sur ordinateur | 25 fixtures, compteurs avant pagination, colonnes numériques alignées | 17 |
| Liste filtrée → détail → retour | Recherche Atlas et statut actif conservés dans `/customers?q=Atlas&page=1&status=active` au retour ; onglet actif sélectionné | Observation DOM/navigation dans la session ; pas de preuve DB |
| Détail du même client fixture | Identité, adresse, fiscalité, conditions, limite de crédit 0,00 USD, un compte bancaire | 06 |
| Transactions | Deux ventes fixtures, références et montants correspondants ; libellé `Transactions (2)` | 07 |
| Édition du client fixture | Crédit 0 conservé, champs et banque chargés | 08, 18, 19 |
| Pays | Libellés français ; `Antigua-et-Barbuda` conserve la valeur API `Antigua and Barbuda` | Observation DOM, tests complémentaires de localisation |
| Formulaire mobile | Titre et action de retour sur lignes distinctes, champs sur une colonne, sections inférieures accessibles | 09, 18, 19, 10 |
| Liste mobile | Pas de débordement horizontal de page : document 390 px, main clientWidth/scrollWidth 375/375 ; tableau défilant dans son cadre | 11 et mesure DOM dans la session |
| Détail mobile | Vue supérieure, banque et actions inférieures accessibles | 12, 20, 13 |
| Erreur du registre | Message `Répertoire indisponible`, reprise Actualiser ; aucune fausse liste vide | 14 |
| Erreur des ventes | `Ventes indisponibles` avec indicateurs indisponibles ; identité encore accessible | 15 |
| Répertoire vide réussi | Compteurs de population à zéro et message d’état vide ; pas de vente inventée | 16 |
| Console | Aucun message de niveau error recueilli sur les contrôles ordinaires de cette session | Lecture CUA dev.logs, hors simulations d’erreur intentionnelles |

Retour de l’audit visuel : les indicateurs monétaires étaient tronqués sur mobile. Le correctif utilise une colonne sous 480 px et permet le retour à la ligne des valeurs. Les captures 11, 12, 15 et 16 ont été reprises après correction : montant `445 000,00 $US`, moyenne `222 500,00 $US` et état `Non disponible` restent lisibles en entier.

L’agent indépendant a déjà testé la saisie obligatoire, la banque libre et le refus de sauvegarde du banc ; son annulation via dialogue natif est restée bloquée par le navigateur Chrome. Ce complément ne transforme pas ce scénario en réussite.

## Décision

Présentation partiellement contrôlée, à auditer indépendamment sur les fichiers finaux. **Aucun formulaire VALIDÉ.** Les 12 scénarios de recette intégrée, les comptes de chaque portail, Auth/MFA, les droits RLS réels, le rechargement après écriture et le nettoyage par identifiants de run restent non exécutés. Les autres portails et modules restent dans le périmètre de la mission.
