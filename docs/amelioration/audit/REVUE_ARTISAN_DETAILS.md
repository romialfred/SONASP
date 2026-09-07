# Revue indépendante — lectures du détail Artisan

Date : 7 septembre 2026. Auditeur : `audit_independant`. Périmètre limité à `ArtisanMinierDetails.tsx`, ses sources annexes et les tests associés. Il ne s’agit pas d’une validation des formulaires de création/modification, des cartes, des ventes ou des infractions.

## Défauts examinés et correction

L’état antérieur transformait un échec de lecture des ventes ou des infractions en liste vide, puis affichait des zéros et des messages d’absence. Une lecture annexe lente retardait également l’identité. La première correction distingue chargement, résultat vide réussi et échec ; elle permet une reprise indépendante de chaque source sans recharger l’identité ou l’autre source.

L’audit a trouvé deux défauts supplémentaires dans cette première correction :

1. Les lectures restaient indexées sur l’identifiant artisan et le booléen collecteur. Un changement d’organisation, de mine, de rôle d’accès ou d’utilisateur conservant ce booléen pouvait afficher les données antérieures ou accepter une réponse tardive de l’ancien contexte.
2. Le passage au contexte Collecteur depuis le panneau Infractions masquait l’onglet sans sélectionner un panneau accessible, laissant la fiche sans contenu de section.

L’implémenteur a ajouté une frontière de composant indexée sur l’artisan et le contexte complet. Un changement de contexte remonte la fiche en chargement, remet les recherches et l’onglet à leur état initial, et exécute les nettoyages des anciennes lectures. Les capacités et rattachements sont sérialisés sans modifier leurs valeurs ou les permissions serveur. Les infractions ne sont pas chargées dans le contexte Collecteur. Cette correction est relue et couverte par les scénarios ci-dessous.

## Tests réellement exécutés

Commande :

```sh
node docs/amelioration/audit/run-artisan-details-audit.mjs
```

**38 tests réussis, 0 échec : 32 tests de l’implémenteur et 6 cas indépendants.** Sources, configuration et tests ont conservé les mêmes empreintes pendant l’exécution. L’empreinte du composant est `a77682eb925fff2cc921453fe186ed87e8ecf9910061ec33b272d82994bd1088`.

Preuves : [résultat horodaté et empreintes](artisan-details-independent.evidence.json), [sortie détaillée](artisan-details-independent.txt), [tests indépendants](artisan-details-independent.test.tsx).

Les six cas indépendants sont : organisation seule, mine seule et rôle d’accès seul avec identité inchangée et annexes tardives ; identité de l’ancien utilisateur répondant après le nouveau ; bascule Infractions → Collecteur ; reprise des ventes de A échouant après navigation vers B. Les anciennes réponses ne réapparaissent pas, les nouveaux zéros proviennent d’une lecture vide réussie et le panneau Informations redevient accessible au Collecteur.

Les tests de l’implémenteur couvrent également les chargements lents, les refus distincts de chaque source, la reprise échouée puis réussie, l’absence de faux zéro, les filtres et les autres propriétés de contexte. Les services restent remplacés par des doubles : ils ne démontrent pas que la base applique les mêmes droits.

## Décision bornée et limites

Aucun défaut supplémentaire n’est confirmé dans les 38 scénarios de ce lot. Le correctif peut poursuivre les portes techniques d’intégration. **Aucun formulaire ni parcours UI/base n’est VALIDÉ.**

Restent à exécuter : interface réelle avec acteurs autorisés/refusés, changement de contexte réellement authentifié, erreurs réseau/API, persistance et relecture des données existantes, contrôle visuel desktop/mobile/zoom. Aucun test serveur RLS/MFA, aucune écriture et aucun nettoyage de base n’ont été réalisés ici. Les résumés d’identité, pièces et cartes ont leur propre périmètre de contrôle ; ce lot ne certifie pas leurs lectures ou workflows. Les états d’échec de l’identité principale, les autres actions et le design global restent dans l’inventaire, sans exclusion du dénominateur.
