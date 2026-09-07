# Reprise locale avant la présentation de 20 h

7 septembre 2026. La présentation est reportée à 20 h ; le commanditaire demande de reprendre l’amélioration intégrale et de préparer les modifications, les commits et le déploiement **en local pour test**. Un nouveau Go explicite est obligatoire avant toute migration Supabase ou tout envoi de code sur Git distant. Cette instruction remplace le gel de présentation et les anciennes autorisations de publication. Aucun résultat fixture n'est requalifié en recette réelle.

## Version et organisation

Reprise depuis `04b1826c`, branche `codex/amelioration-integrale`, trois commits locaux devant `origin/SONASP_2026` après fetch. Les travaux non committés des lots identité/typographie et tableau de bord Artisan sont conservés. Les fichiers utilisateur et les documents d'autres sessions sont exclus des commits applicatifs.

| Lot | Responsable | Travail repris | Preuve attendue |
|---|---|---|---|
| Identité, navigation et typographie | Principal + auditeur indépendant | Vérifier et versionner les améliorations locales déjà montrées | Tests ciblés, captures existantes avec leurs limites, commit local |
| ART-DASH-002/003 | Auditeur indépendant | Vérifier la correction déjà présente des faux zéros et du filtre site | Tests de composants/service, avis indépendant |
| AFF-ACK-005 | Principal | Distinguer écriture confirmée, actualisation confirmée et relecture échouée | Reproduction rouge, tests, parcours dans l'interface locale |
| LECT-VOL-006 | environnement_recette | Pagination des lectures et détail site direct par identifiant | Frontières de pagination, erreurs explicites et tests de service |
| SITE-DOC-007 | inventaire_architecture | Erreurs et reprise du dépôt/affichage des photos | Tests de fichiers/pièces, interface et maintien AEA/catégorie |
| SITE-CONC-004 | Auditeur puis responsable backend | Préparer le contrat de concurrence à partir des règles existantes | Proposition locale ; aucune migration appliquée sans Go |

Les lots Clients, ventes/finance, production/logistique, supervision/administration et transverse restent dans le périmètre du prompt maître. Ils ne deviennent pas validés parce que les corrections prioritaires passent leurs tests. Les matrices historiques restent disponibles ; cette reprise n'est pas une clôture globale.

## Environnements et preuves

- `5180` : version locale stable préservée.
- `5192` : candidate locale intégrée, mise à jour seulement après compilation vérifiée.
- `5186` : banc visuel multiportail à données simulées, pas une vraie session métier.
- Banc d'affiliation SQL embarqué : base PGlite jetable, services réels et contrôles SQL, identités de test simulées ; ne prouve pas Supabase Auth/MFA/Storage distant.

Une connexion de test sur `5192` a été demandée pour reprendre la recette intégrée. Aucun mot de passe ni jeton n'est demandé dans le chat. Les modifications de schéma attendront un Go sur un plan concret ; les tests locaux indépendants continuent pendant ce temps.

Les preuves nouvelles distingueront : tests unitaires/composants, parcours navigateur avec doubles, SQL embarqué, session réelle et relecture distante. Les données d'essai créées seront identifiées et nettoyées après conservation des preuves. Aucun autre dossier n'entre dans le nettoyage.

## Reprise effectivement exécutée

L'utilisateur a ouvert une vraie session sur 5192. Le parcours R02 a créé un site non formalisé planifié et ses deux responsables, vérifié la présence dans la liste sans rechargement manuel et ouvert les règles de conformité. Une lecture SQL indépendante confirme les 18 champs attendus et les deux contacts. Voir `preuves/recette-r02/README.md`. La session est ensuite revenue sur la connexion ; une reconnexion est demandée pour poursuivre la modification, l'AEA, les photos et les autres formulaires.

Les essais supplémentaires du banc 5188 vérifient le traitement des photos dans un stockage mémoire, les erreurs et reprises des trois pages Sites, puis les erreurs mobiles et l'absence de note de conformité. Ils sont explicitement distincts de la recette réelle.

### Commits applicatifs locaux

| Commit | Correction |
| --- | --- |
| `d881dc0b` | Header, identité des acteurs, typographie et navigation active |
| `f4d8428c` | Erreurs du tableau des artisans et périmètre territorial |
| `e30b0381` | Lecture complète des registres paginés, refus des résultats partiels |
| `8016b698` | Écriture d'affiliation confirmée distincte d'une relecture échouée |
| `b654eb97` | Photos : erreurs individuelles, reprise, compensation bornée et conversion compatible CSP |
| `b643272b` | Collecteurs/Comptoirs : listes confirmées et isolation du contexte |
| `901b5ebb` | Retrait des comparaisons et objectifs sans source dans les sites |
| `5d0d29f9` | États de lecture exclusifs des trois pages Sites et indice non évalué |

Aucun commit n'a été envoyé au dépôt distant. Aucun schéma Supabase n'a été modifié pendant cette reprise. Les autorisations de publication restent celles exposées en tête de ce document.

### Historique des vérifications intégrées

L'ancienne suite à 2 838 tests contient deux échecs ensuite corrigés et reste conservée comme échec. La suivante compte 2 870 assertions réussies mais a retourné le code 1 : cette discordance non expliquée interdit de la qualifier de porte globale réussie. Les traces ErrorBoundary, rejouées isolément avec sortie 0, n'expliquent pas ce code à elles seules.

Après le dernier delta Sites, l'auditeur a rejoué **97/97 tests**, sortie 0, sans erreur non gérée et avec sources stables. La nouvelle porte intégrée `run-integration-locale.mjs` capture séparément les flux, le code de sortie, les erreurs de fin Vitest et les empreintes ; elle contrôle aussi typage, lint et build. Son résultat final est conservé dans `audit/integration-locale-r03-evidence.json`, indépendamment des contrôles précédents.

Le plan de concurrence Sites reste une proposition locale distincte. Les validations de formulaires, portails et opérations non exécutées ne sont pas déclarées acquises.

### Résultat de la porte intégrée R03

La porte du 7 septembre, exécutée de 14:00 à 14:18 UTC sur les sources du commit `5d0d29f9`, est terminée : **2 938/2 938 tests dans 366 fichiers**, code processus 0, fin Vitest `passed`, aucune erreur non gérée. Les empreintes des sources/tests/configuration sont identiques avant et après. Les sept commandes retournent 0 : tests, couverture des types de base, TypeScript, ESLint global, contrôle du français, contrôle de provenance et build.

La candidate compilée est `local-mtrbrhf4`, dossier `node_modules/.cache/reprise-integree-r03`, installée sur **http://127.0.0.1:5192/**. Le serveur stable 5180 est préservé. Ce succès technique n'attribue pas de validation réelle aux formulaires ou portails non exécutés. Le nettoyage des seules données R02 et sa preuve restent décrits dans leur manifeste séparé.

### Audit final et conservation des preuves

L'auditeur a recalculé les 2 938 résultats individuels, les 14 empreintes des journaux et les 1 628 empreintes sources/tests/configuration. Il confirme également le nettoyage exact du site R02 et de ses deux responsables, sans modification des données hors manifeste dans les tables contrôlées. Voir `audit/REVUE_FINALE_PREUVES_R03_R02.md` pour le périmètre et les limites de cette revue.

Le login du build intégré est vérifié dans le navigateur à 1280 × 720 et 390 × 844, y compris avec les erreurs locales de saisie, sans scroll de page. Les captures et mesures sont dans `preuves/integration-r03/`. Les parcours métier suivants attendent la reconnexion ; aucune certification globale de la plateforme n'est prononcée.

Les journaux bruts sont conservés sans nettoyage de leurs espaces ni de leurs fins de ligne. Certains signalements `git diff --check` concernent ces sorties capturées, pas le code applicatif. Les règles ciblées de `docs/.gitattributes` empêchent la conversion automatique des fins de ligne des preuves ; elles préservent les octets nécessaires aux manifestes SHA-256. Les artefacts historiques rejetés ou limités restent identifiés comme tels.
