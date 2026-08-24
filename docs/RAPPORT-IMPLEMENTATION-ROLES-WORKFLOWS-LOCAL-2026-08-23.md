# Rapport de finalisation locale — rôles, workflows et périmètres

**Date de consolidation :** 24 août 2026
**Branche :** `SONASP_2026`
**Commit local précédent :** `c859019`
**État de livraison :** consolidation vérifiée et intégrée au commit local final, non poussée et non déployée

## 1. Périmètre effectivement implémenté

### Autorité d'accès et comptes

- catalogue serveur de capacités additives, capacités par rôle et exceptions par compte ;
- résolution autoritative des capacités par RPC, avec AAL2 obligatoire pour les capacités sensibles ;
- rôle **Manager** rendu strictement en lecture seule, y compris face à une exception positive ;
- rôle **Administrateur** limité à l'administration des comptes et référentiels, sans pouvoir métier implicite ;
- rôle **Propriétaire** retiré de l'attribution interactive et conservé comme compte exceptionnel hors interface ;
- interdiction de gérer son propre compte et audit de chaque attribution/retrait de capacité ;
- formulaire utilisateur complété par des cartes de responsabilités métier, sans supprimer les rôles historiques des autres portails.

### Séparation des fonctions SONASP

- chaîne règlement : préparation, approbation, exécution avec preuve, rapprochement par un autre acteur ;
- interdiction d'auto-approuver, d'exécuter sa propre approbation et de rapprocher sa propre exécution ;
- transitions serveur, journal append-only et outbox idempotente ;
- suppression du pouvoir métier général de l'Administrateur.

### Comptoir, paiements, DGI et stock artisanal

- organisations et rattachements historisés pour les comptoirs ;
- périmètre injecté par le serveur : un identifiant de comptoir falsifié dans le navigateur est ignoré ou rejeté ;
- paiement rattaché à la vente et à la facture du même périmètre ;
- verrou transactionnel empêchant deux paiements actifs concurrents pour une facture ;
- validation par un second opérateur, preuve bancaire obligatoire et certification DGI préalable à la clôture ;
- certification DGI par RPC dédiée, avec référence et justificatif obligatoires puis facture immuable ;
- ledger de stock append-only, clés d'idempotence, solde non négatif et correction par écriture compensatoire exacte ;
- actions frontend de prise en charge, validation et clôture ; affichage et enregistrement contrôlé de la preuve DGI.

La plateforme ne prétend pas produire elle-même un QR fiscal officiel : elle enregistre une certification obtenue auprès du dispositif fiscal. Le document affiché reste explicitement un spécimen tant qu'une intégration MCF/SECeF officielle n'est pas disponible.

### Collecteurs et isolation des données

- liaison compte ↔ collecteur ↔ comptoir ;
- rattachement historisé des orpailleurs à un collecteur ;
- réaffectation auditée avec révocation immédiate de l'ancien périmètre ;
- RLS restrictive sur artisans, enfants métier, ventes, factures, paiements et taxes ;
- responsabilité `collector.operate` distincte du rôle Manager, qui reste strictement en lecture seule.

## 2. Principales protections vérifiées

- élévation verticale : Owner non attribuable par l'interface, Admin non acteur métier ;
- élévation horizontale / IDOR : impossibilité de substituer un artisan, une facture, une vente ou un comptoir étranger ;
- séparation des tâches : acteurs distincts aux étapes incompatibles ;
- rejeu et concurrence : outbox et stock idempotents, verrou par facture contre le double paiement ;
- intégrité : transitions et relations métier immuables ou contrôlées par RPC/trigger ;
- révocation : fonctions de périmètre volatiles fondées sur l'heure réelle, sans cache transactionnel d'une ancienne affectation.

## 3. Validation exécutée

| Contrôle | Résultat |
|---|---:|
| Tests frontend/services complets | **997 / 997** |
| Fichiers de tests Vitest | **131 / 131** |
| Suites pgTAP capacités, règlements, périmètres, Owner, paiements et DGI | **présentes et auditées statiquement ; non rejouées pendant la consolidation faute de CLI locale** |
| ESLint des fichiers TypeScript modifiés | **60 fichiers, 0 erreur** |
| Build Vite de production | **réussi, 3 357 modules** |
| `git diff --check` | **réussi** |

Le typecheck global `tsc --noEmit` termine mais remonte une dette historique étendue : vues et tables Supabase absentes des types générés, composants anciens et paramètres inutilisés hors du lot consolidé. Le build réel, le lint ciblé et les tests Vitest sont verts ; cette dette de typage globale doit être traitée séparément, idéalement après régénération des types de la base.

## 4. Limites volontaires de cette livraison locale

- aucune migration n'a été appliquée à une base Supabase persistante ;
- aucune fonction Edge n'a été déployée ;
- aucun push ni déploiement Vercel n'a été réalisé ;
- les travaux Business Intelligence, Mine, stocks, licences, vitrine et comptes de l'autre session ont été audités puis intégrés au lot local final ;
- un test E2E navigateur connecté à la base migrée reste nécessaire avant mise en production ;
- la réconciliation de l'historique des migrations Supabase distante, déjà signalée par l'audit, reste un préalable au déploiement.

## 5. Déploiement et retour arrière recommandés

1. créer une sauvegarde chiffrée et restaurable de la base cible ;
2. appliquer les migrations additives sur une copie de recette ayant le baseline complet ;
3. rejouer les six suites pgTAP et la suite Vitest complète ;
4. tester deux comptes distincts par séparation de tâche, deux comptoirs et deux collecteurs ;
5. tester les autres portails historiques ;
6. déployer les fonctions Edge puis le frontend seulement après validation métier ;
7. en cas de retrait, désactiver les nouvelles capacités et revenir à l'application précédente sans supprimer les tables d'audit, d'historique ou de ledger.

Les migrations sont additives : elles préservent les rôles, comptes, identifiants, transactions et portails existants. Aucune suppression destructive de table, colonne ou rôle n'est incluse.
