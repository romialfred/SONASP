# Audit indépendant des captures Clients

Date : 7 septembre 2026. Auditeur : `audit_independant`. Sources examinées : rapport QA Chrome initial, complément IAB du coordinateur et **15 captures JPEG finales 06 à 20** du dossier `preuves/presentation-clients`.

**Les fichiers finaux sont recevables pour l’inspection visuelle des zones qu’ils montrent.** Les défauts visuels signalés dans cette itération ont été corrigés et réexaminés. Cette décision ne valide aucun formulaire, aucune persistance ni aucun portail réel.

## Contrôle des artefacts

Les 15 fichiers ont été ouverts visuellement par l’auditeur. Leurs SHA-256, dimensions et format réel ont été recalculés et comparés au manifeste complémentaire : **15 correspondances, aucune erreur de hash, de dimension ou de format**. Les fichiers sont des JPEG, de 1536 × 1024 sur ordinateur ou 390 × 844 sur mobile. Voir [preuve de contrôle des artefacts](captures-clients-independent.evidence.json) et [manifeste complémentaire](../preuves/presentation-clients/manifest-complement-iab.json).

Les premières captures mobiles comportant un grand canvas blanc ont été rejetées. Elles ne sont pas des preuves recevables du rendu mobile. L’avis porte sur les JPEG repris à viewport stabilisé, pas sur ces anciens fichiers. Les captures 01–05 du rapport Chrome initial conservent leur version et leurs limites antérieures ; elles ne certifient pas la dernière version du code.

## Constats visuels de l’itération

| Zones inspectées | Fichiers finaux | Observation indépendante |
|---|---|---|
| Répertoire ordinateur | 17 | Titre, actions, filtres, compteurs entre parenthèses et colonnes financières alignées visibles ; pays en français ; fixtures clairement signalées |
| Détail et transactions ordinateur | 06, 07 | Identité, conditions, crédit zéro et actions visibles ; `Transactions (2)` remplace le badge détaché ; deux références et leurs montants lisibles |
| Modification ordinateur | 08 | Champs sur deux colonnes et volet de contexte séparé ; crédit zéro visible ; section bancaire présente en bas du viewport |
| Formulaire mobile | 09, 18, 19, 10 | Titre et retour sur lignes distinctes, contrôles sur une colonne, conditions, crédit, banque et boutons accessibles dans les sections capturées ; focus visible sur des contrôles |
| Détail mobile | 12, 20, 13 | Synthèse, début d’identité, banque et actions inférieures lisibles ; volet de contexte replacé dans le flux |
| Erreur de répertoire | 14 | Alerte explicite et action de reprise ; aucune table vide présentée comme résultat réussi |
| Erreur des ventes | 15 | Identité conservée, alerte et valeurs indisponibles ; aucune vente ou somme fictive substituée à l’erreur |
| Répertoire vide | 16 | Populations à zéro et montants non disponibles distingués ; pas de vente inventée |

Une seconde anomalie a été détectée dans les premiers JPEG natifs : les KPI mobiles tronquaient montants et devises (`445000,00…`, `222500,00…`) et le texte `Non disponible`. Le coordinateur a limité le correctif au CSS Clients, autorisé le retour à la ligne et empilé les KPI sous 480 px. Les captures 11, 12, 15 et 16 ont été reprises puis ouvertes de nouveau. Les montants complets, leur devise et l’état indisponible sont désormais lisibles sur ces vues.

## Ce que ces preuves ne démontrent pas

- Les fichiers sont des **viewports et sections successives**, pas des captures intégrales d’un formulaire ou d’un document. Le shell possède un défilement interne. Certaines zones intermédiaires, le tableau mobile après défilement horizontal et l’ensemble du graphique ne sont pas montrés intégralement.
- Le rapport IAB décrit des interactions et mesures DOM ; l’auditeur de fichiers ne les a pas rejouées dans une session authentifiée indépendante. Une capture ne prouve ni la destination opérationnelle de chaque action ni les droits serveur.
- Le zoom navigateur natif à 200 %, le parcours clavier complet, les contrastes mesurés et les autres résolutions ne sont pas validés par ces images. Aucun résultat WCAG global n’est annoncé.
- Le bandeau indique des données fictives et un enregistrement indisponible. **Il n’existe aucune preuve UI → API réelle → base → détail → rechargement → modification → nettoyage dans ce banc.**
- Le manifeste identifie les images et leurs dates ; il n’atteste pas les octets d’un bundle de livraison pour chaque capture. Les changements visibles ont été vérifiés, mais une version intégrée déployée doit encore être identifiée et contrôlée.
- Seul le pilote Clients dans le contexte de présentation SONASP est montré ; les autres modules et portails ne sont pas couverts par cet avis.

L’état de recette reste **partiel**, sans note globale, sans retrait de critère non exécuté et sans autorisation de déploiement.
