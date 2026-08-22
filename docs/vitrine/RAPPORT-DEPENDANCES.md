# Rapport de dépendances

Audit effectué avec le registre npm après le build et les tests.

## Résultat

| Étape | Critiques | Élevées | Modérées | Faibles | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| État initial | 3 | 17 | 5 | 1 | 26 |
| Après correctifs | 0 | 2 | 1 | 0 | 3 |

## Correctifs appliqués

- `jspdf` : 3.0.x → 4.2.1 ;
- `jspdf-autotable` : 5.0.2 → 5.0.8 ;
- `react-router-dom` : 7.11.0 installé → 7.18.2 ;
- `pdfjs-dist` : 3.11.174 → 6.2.108 ;
- mises à jour transitives compatibles via `npm audit fix`, sans `--force` ;
- worker PDF.js rapatrié dans le bundle et aligné sur la version du parseur.

Après ces changements, les 821 tests et le build de production réussissent.

## Risques résiduels

### Élevé — `xlsx@0.18.5`

Deux avis concernent la pollution de prototype et une expression régulière pouvant provoquer un déni de service. Le registre npm ne fournit aucun correctif. La bibliothèque intervient dans des exports Excel du back-office et non dans la vitrine publique.

Recommandation : planifier son remplacement par une bibliothèque maintenue, couvrir les exports concernés par des tests de fichiers réels et refuser tout classeur non fiable tant que la migration n’est pas terminée.

### Élevé/modéré — Vite et esbuild

Ces avis affectent le serveur de développement et la chaîne d’outillage. Le correctif proposé impose Vite 8, donc une migration majeure. Les actifs statiques générés ne contiennent pas le serveur Vite.

Mesures immédiates : garder le serveur local lié à l’interface de développement, ne jamais l’exposer sur Internet et planifier une migration Vite/plugin React dans une branche dédiée.

## Décision de publication

Aucune vulnérabilité critique n’est ouverte. Une publication de la vitrine statique peut être soumise à recette, mais la plateforme complète nécessite une décision de sécurité documentée sur XLSX avant mise en production institutionnelle.
