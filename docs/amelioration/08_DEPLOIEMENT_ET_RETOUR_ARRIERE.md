# Déploiement et retour arrière — amélioration intégrale

Date : 7 septembre 2026. Baseline applicative : `83f8c74ea83c81a2734ef9e086c2edd211573ebe`. Branche de travail : `codex/amelioration-integrale`.

**Décision actuelle : promotion BLOQUÉE.** La demande autorise le déploiement seulement après la recette intégrale 100/100 et l'absence de critère éliminatoire. Aucun déploiement de ce nouveau périmètre n'est exécuté. Les réussites du lot multiportail précédent ne remplacent pas la recette exigée ici.

## Environnements identifiés

| Cible | Usage autorisé actuel | État vérifié |
|---|---|---|
| `https://sonasp.data-univers.com` | Production ; lectures de contrôle après promotion | Cible existante. Aucune nouvelle promotion dans ce lot. |
| Projet Supabase lié au dépôt | Production ; aucune écriture de recette | `supabase/config.toml` et `.env` visent cette production. |
| `http://127.0.0.1:5180` | Frontend local stable existant | L'origine locale n'isole pas la base ; configuration backend de production. |
| `http://127.0.0.1:5186` | Banc visuel du précédent lot | Fixtures et transport simulé ; ne valide pas la persistance complète. |
| Préproduction Supabase | Recette réelle attendue | Aucun environnement utilisable, compte MFA ou accès de lecture isolé attesté. |

Le diagnostic et les prérequis sont détaillés dans [environnement/README.md](environnement/README.md). Le service PostgreSQL seul et PGlite ne remplacent pas la pile Auth/PostgREST/Storage/Edge exigée.

## Version candidate et portes de promotion

Le commit candidat n'est pas encore fixé. Il sera nommé après intégration de tous les lots. Chaque preuve doit référencer ce commit et les migrations/fonctions qu'il utilise. Une correction après audit invalide les preuves affectées.

Avant la promotion :

1. Vérifier le périmètre versionné, les scénarios de tous les portails et les décisions indépendantes ; aucun scénario obligatoire bloqué ou non exécuté.
2. Rejouer les tests proportionnés puis `npm run lint`, `npm run typecheck`, la suite Vitest et `npm run build`. Exécuter les contrats SQL réellement concernés dans la pile isolée.
3. Vérifier `git diff --check`, l'intégrité du catalogue et la revue des migrations additives. Le contrôle strict historique reste distinct du catalogue et son état ne doit pas être caché.
4. Valider dans l'interface les connexions/MFA, la saisie, l'enregistrement, la relecture DB, le détail, la modification, les documents et les frontières entre deux organisations. Auditer les mêmes enregistrements et la même version.
5. Attester une sauvegarde adaptée et une restauration réussie en environnement isolé. Une taille non nulle ou un ancien dump n'est pas une preuve de restaurabilité.
6. Enregistrer la décision 100/100 et le résultat des critères éliminatoires dans `07_AUDIT_QUALITE.md` avant tout push sur la branche de production.

## Procédure de publication prévue

La cible autorisée existante est l'intégration Git/Vercel de `SONASP_2026`, projet `business-tech-services/sonasp`. La production exige un commit GitHub identifié ; `npm run build:release` refuse les entrées applicatives non committées. Ne pas contourner ce garde-fou avec une copie locale téléversée.

Après la recette et uniquement alors : comparer la branche distante, intégrer le commit audité sans écraser les modifications concurrentes, exécuter `npm run build:release`, appliquer dans l'ordre relu les éventuelles migrations compatibles et déployer séparément les fonctions Edge nécessaires, puis promouvoir le commit via le mécanisme Git existant. Tout blocage de l'historique distant est traité explicitement : aucun `migration repair` ou reset improvisé.

Après déploiement : vérifier Vercel Ready, alias attendu, `build-version.json` correspondant au commit, assets, pages publiques, connexion/MFA, identité et navigation des portails concernés, lectures et documents. Aucun faux achat, vente, paiement ni courriel externe en production. La PWA conserve sa mise à jour explicite.

## Retour arrière préparé

| Nature du changement | Stratégie attendue | Preuve actuelle |
|---|---|---|
| Applicatif seul | Revenir par le mécanisme Git/Vercel au dernier commit compatible connu, vérifier le build effectivement servi et les parcours critiques | Baseline identifiée ; exercice de retour arrière de ce lot **NON EXÉCUTÉ**. |
| Migration additive compatible | Maintenir le schéma compatible avec l'ancienne application ; désactiver la promotion et examiner une migration compensatoire relue si nécessaire | À établir pour chaque migration du lot ; aucune migration appliquée par cet agent. |
| Données ou schéma incompatible | Restauration vers une cible contrôlée à partir d'une sauvegarde testée, rapprochement des écritures intervenues, plan métier validé | **BLOQUÉ** tant que sauvegarde et restauration représentatives ne sont pas attestées. |
| Fonction Edge | Revenir à la version source compatible avec le schéma, redéployer puis confirmer version ACTIVE et contrôles négatifs | À établir selon les fonctions effectivement modifiées. |

Annuler le frontend ne restaure pas automatiquement une base. Aucune suppression ni purge de données réelles n'est une procédure de retour arrière.

## État de livraison

- Prêt à déployer : **NON**.
- Déployé en préproduction pour ce périmètre : **NON**.
- Déployé sur la cible autorisée pour ce périmètre : **NON**.
- Vérifié après déploiement de ce périmètre : **NON**.
- Conditions manquantes : environnement réel isolé, preuves de recette intégrale, audit indépendant 100/100, sauvegarde/restauration testée et identification du commit final.

## Banc de présentation ajouté pendant le lot

Le port local 5187 charge les composants Clients avec un bandeau de données fictives et refuse tout enregistrement. Il est isolé de la configuration Supabase de production. Ce banc sert à inspecter la présentation ; il ne possède pas de backend de recette Auth/MFA/API/base et ne peut pas servir de preuve de préproduction. Voir preview-clients/ et preuves/presentation-clients/. Le port 5180 et son dossier dist restent inchangés.
