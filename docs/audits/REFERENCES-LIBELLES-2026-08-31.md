# Références et libellés métier — 31 août 2026

## Résultat appliqué

La base de développement connectée `yyverzuhkdonjjuficor` a été corrigée : **83 champs** sur 11 tables.

| Ancienne référence de vente | Référence enregistrée |
|---|---|
| PORTAIL-TEST-SL-ESK | SL-2026-000013 |
| PORTAIL-TEST-SL-SOPAMIB | SL-2026-000014 |

Le serveur numérote les ventes avec six chiffres. Cette règle, son verrou annuel et tous les générateurs existants sont conservés. Achats, expéditions, factures et règlements reprennent leurs formats respectifs, sans unifier abusivement toutes les références sous `SL`.

Les marqueurs des anciens jeux ont été retirés des champs métier repérés. Les informations utiles « source à vérifier », « sans valeur juridique » et « non certifié » sont conservées. Les historiques d'audit ne sont ni effacés ni réécrits ; ils peuvent donc conserver les anciennes valeurs, comme attendu pour la traçabilité.

## Cause

Une ancienne migration de données avait inséré directement des références `PORTAIL-TEST-*`. Un autre jeu utilisait `ACH-DEMO-*`, `FA-DEMO-*` et `REG-DEMO-*`. Le tableau de bord lisait fidèlement ces valeurs en base. Il n'y avait pas à modifier son affichage ni le générateur de numéros.

## Vérifications effectuées

- Répétition sur une copie locale dédiée : 83 champs corrigés.
- Empreintes avant/après identiques sur **52 tables** pour les données métier et leurs dépendances, hors seules colonnes explicitement renommées et dates techniques de modification.
- Fonctions, générateurs, triggers, politiques RLS : empreinte identique avant/après.
- Idempotence locale : seconde exécution, **0 changement**.
- Retour arrière local testé, puis correction rejouée avec succès. Les compteurs ne sont pas décrémentés.
- Répétition sur la base connectée avec `ROLLBACK` : 83 champs, contrôles réussis.
- Application connectée avec `COMMIT` : 83 champs, contrôles réussis.
- Audit après application : **0 occurrence** dans les colonnes métier inspectées. Les journaux, identités Auth, champs bancaires sensibles et métadonnées techniques sont exclus de ce balayage.
- Tests ciblés : **73 tests / 6 fichiers réussis**.
- ESLint ciblé réussi ; build Vite réussi (3 220 modules).
- Intégrité des 224 fichiers du catalogue de migrations : aucune modification ; dette historique inchangée.

## Interface et limites

Trois textes ont été reformulés : aide, état vide des analyses, pied de facture artisanale. Aucun calcul ni workflow n'est modifié. La facture reste clairement non certifiée. Un test de non-régression protège ces libellés.

La correction de données est appliquée sur la base connectée. Les textes sont intégrés au build local ; aucun déploiement Vercel et aucun commit/push ne sont effectués dans ce lot. Pas de validation visuelle d'une session authentifiée : les références sont vérifiées directement en base et leur lecture est inchangée dans le tableau de bord.

Les modifications préexistantes des portails et de la vitrine ont été conservées. L'import historique `scripts/development-data/run.mjs` reste bloqué à la publication ; aucun nouveau jeu n'a été chargé.

## Preuves et retour arrière

Les correspondances avant/après, reçu d'application, audit final et SQL de retour arrière sont conservés dans :

`output/data-labels/2026-08-31-CEiPF7/`

Le SQL de retour arrière doit être relu avant usage ; il s'arrête si un champ a été modifié depuis. Les scripts reproductibles sont documentés dans `scripts/data-labels/README.md`.
