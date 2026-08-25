# Journal des décisions d'architecture

Chaque entrée consigne un arbitrage pris par l'équipe d'implémentation, ses raisons,
son retour arrière et les vérifications qui l'appuient. Les faits cités ont été
observés sur le projet hébergé `yyverzuhkdonjjuficor` ou sur le miroir local.

---

## D-001 — Faire échouer le déploiement plutôt qu'un `REVOKE` sans effet

**Contexte.** L'extension `http` était installée dans `public`, donc exposée par
PostgREST. Établi par appel réel : `POST /rest/v1/rpc/http_get` avec la seule clé
anon et `{"uri":"http://127.0.0.1:1/"}` répondait `HTTP 500 — Failed to connect to
127.0.0.1 port 1`. La requête sortante était émise par la base, pour tout appelant,
sans authentification.

**Problème.** La première migration révoquait les droits d'exécution. Elle n'a rien
fait : l'extension appartient à `supabase_admin`, les migrations s'exécutent sous
`postgres`, qui n'en est pas membre. Un `REVOKE` par un non-propriétaire est
silencieux.

**Options.** (a) `REVOKE` — rejetée, sans effet. (b) `ALTER EXTENSION SET SCHEMA` —
rejetée, refusée par pg_http. (c) Recréer l'extension dans `extensions`, schéma non
exposé par PostgREST — retenue.

**Décision.** Option (c), avec un postflight qui vérifie qu'aucune fonction `http`
ne subsiste dans `public`.

**Ce que cela a évité.** Le postflight de la version (a) a fait échouer la
transaction en constatant que les 38 droits subsistaient. Sans ce garde, une faille
ouverte aurait été annoncée comme fermée.

**Risque résiduel.** Les droits d'exécution restent accordés et la propriété revient
à `supabase_admin` : la défense en profondeur est incomplète, la surface joignable
depuis l'API est fermée. Les retirer demande une intervention sous `supabase_admin`.

**Retour arrière.** `DROP EXTENSION http; CREATE EXTENSION http SCHEMA public;` —
rouvre la faille, réservé au diagnostic.

**Vérification.** Après rechargement du cache PostgREST, la même attaque répond
`404 PGRST202`, pour `http_get` comme pour `http_post`.

---

## D-002 — Contrôler l'écriture par `current_user`, non par `auth.role()`

**Contexte.** Un compte authentifié pouvait modifier son propre `role` et son
`mining_company_id` par un `PATCH` sur sa ligne de `user_profiles`. Démontré sur le
miroir : un compte `admin` s'est élevé lui-même à `management`.

**Problème.** La première version du garde s'appuyait sur `auth.role()`, qui lit le
jeton et vaut `authenticated` y compris dans une fonction SECURITY DEFINER.
`snp_configurer_compte_portail`, qui modifie légitimement le rôle sans poser le
drapeau de statut, aurait été refusée : plus aucune administration de compte
possible.

**Décision.** Tester `current_user`, qui vaut le propriétaire dans un RPC de
confiance et `authenticated` sur une écriture directe. C'est le motif déjà retenu
par `snp_4i_require_trusted_mutation`.

**Vérification.** Sur le miroir, écriture directe refusée, administration légitime
aboutie. En production, les trois gardes sont posées ; un `PATCH` portant la clé
anon affecte zéro ligne, RLS filtrant une politique réservée aux authentifiés.

**Rapport avec l'existant.** `protect_user_profile_privileges`, écrite dans
`20260822164500` mais jamais déployée, couvre la même intention. Ce n'est pas un
doublon : les fonctions utilitaires de ce lot ont été réintroduites par les
migrations des 23 au 25 août, la protection ne l'a pas été. Voir D-004.

---

## D-003 — Annuler les doublons fiscaux sans rien supprimer

**Contexte.** La taxe de développement communal était enregistrée deux fois sur les
mêmes 24 paiements : le déclencheur historique `trigger_creer_taxes_retenues`
écrivait `autre` au taux zéro, la RPC `snp_artisan_transition_paiement` écrivait
`taxe_municipale`. Le garde `ON CONFLICT (paiement_id, type_taxe)` ne pouvait s'y
opposer, les deux codes différant. La ligne `taxe_municipale` était marquée reversée
tandis que le doublon restait à reverser : 16 573 105,49 FCFA réclamés en trop.

**Décision.** Détacher le déclencheur, la RPC inscrivant déjà les trois taxes avec
les bons codes. Marquer les doublons `annule` avec leur motif plutôt que les
supprimer, conformément au principe de journal immuable. Ciblage strict : une ligne
`autre` n'est annulée que s'il existe, pour le même paiement, une `taxe_municipale`
de même montant au centime près.

**État.** Migration `20260825160000` écrite et éprouvée sur le miroir
(`UPDATE 24`, puis rejouée à vide). **Non appliquée en production.**

---

## D-004 — Ne pas déployer en bloc les migrations restées à quai

**Contexte.** Neuf migrations du dépôt, présentes au catalogue, n'ont jamais été
appliquées en production.

**Analyse.** Onze des quatorze fonctions créées par `20260822164500` existent déjà en
production dans des versions postérieures. Appliquer ce lot tel quel les écraserait
par leurs définitions du 22 août.

**Décision par migration.**

| Migration | Décision | Raison |
|---|---|---|
| `20260822163500` notifications | **appliquée** | durcissement pur par REVOKE, sans dépendance |
| `20260822171500` décisions ventes | **appliquée** | 3 RPC absentes appelées par le code |
| `20260822173000` création vente export | **appliquée** | RPC et colonnes absentes ; impact données nul |
| `20260822164500` profils et MFA | **écartée** | écraserait 10 fonctions ; apport manquant couvert par D-002 |
| `20260822170000` cloisonnement mines | **écartée** | voir D-005 |
| `20260822174500` documents ventes | **différée** | dépend du prédicat d'agent SONASP, à tester séparément |
| `20260823220000` un compte par société | **écartée** | `snp_verrouiller_compte_societe_miniere` déjà en production |
| `20260822180000` retrait démonstration | **écartée** | 35 opérations destructives ; le retrait du jeu de présentation est une décision métier |
| `20251226120554` artisan minier | **écartée** | obsolète ; ses politiques « Authenticated » sont permissives, l'appliquer régresserait la sécurité |

**Vérification avant application.** Le code ne contient aucune écriture directe vers
`approval_requests` ni `snp_ventes_lots` : il appelle exclusivement les quatre RPC.
Le durcissement des politiques ne casse donc rien. Les politiques RESTRICTIVE de
lecture s'ajoutent en `AND` aux politiques existantes ; tous les comptes actifs (5)
ont un facteur MFA vérifié, donc `snp_mfa_satisfaite()` reste satisfaite.

---

## D-005 — Différer le cloisonnement par périmètre minier

**Contexte.** `20260822170000` pose un cloisonnement RLS sur toutes les tables
portant `mining_company_id`, à partir de `snp_est_agent_sonasp()`.

**Problème découvert au test.** Sur le miroir, un agent national voyait 0 production
sur 221 après application. La migration date du 22 août, quand
`snp_est_agent_sonasp()` testait le **rôle**. La fonction a depuis été refondue et
teste des **capabilities** — `sonasp.prepare`, `sonasp.approve`,
`sonasp.finance.execute`, `sonasp.finance.reconcile` — toutes sensibles et accordées
au seul rôle `management`.

**Conséquence.** Appliquer ce cloisonnement aujourd'hui priverait les rôles `admin`,
`manager`, `factory`, `airport` et `refinery` de tout accès aux tables concernées.
Aucun compte `management` n'existe en production.

**Décision.** Ne pas appliquer. Le cloisonnement multi-tenant reste un objectif ; il
devra être posé avec un prédicat aligné sur l'état actuel des capabilities.

**Preuve que le mécanisme fonctionne par ailleurs.** Sur le miroir, un compte minier
voyait exactement 12 productions sur 221, soit précisément celles de sa société.

---

## D-006 — Aligner un type sur le schéma plutôt que corriger l'appel fautif

**Contexte.** Le tableau de production tombait sur `Cannot read properties of null
(reading 'toLocaleString')` alors que la requête avait réussi.

**Décision.** Corriger l'interface `DailyProduction`, qui déclarait
`pure_gold_grams` et `estimated_oz` non nullables alors que la table les autorise
nuls, plutôt que garder l'accès fautif.

**Résultat.** Le compilateur a désigné treize accès non protégés, tous invisibles
jusque-là, dans cinq fichiers. La classe de pannes est supprimée, pas seulement son
occurrence.

---

## D-007 — Ne pas présenter une erreur de rendu comme une panne réseau

**Contexte.** L'écran d'erreur donnait la priorité à l'état du réseau sur la nature
de la panne. Toute erreur survenue hors ligne s'affichait « Connexion Internet
interrompue », bouton désactivé.

**Décision.** L'état réseau n'explique l'erreur que lorsqu'elle provient d'un
chargement de module. Une erreur de rendu reste annoncée comme telle et son action
reste offerte : rétablir la connexion ne corrigerait aucun champ nul.

---

## D-008 — Une convention de bornes plutôt qu'un paramètre d'inclusivité

**Contexte.** Le cahier des charges §17 demande que chaque règle fiscale porte
l'inclusivité de ses bornes de tranche.

**Problème.** Rendre l'inclusivité paramétrable oblige la contrainte de
non-chevauchement à construire dynamiquement le type d'intervalle. Elle cesse
d'être vérifiable en base et redevient un contrôle applicatif — précisément ce que
l'on cherche à éviter.

**Décision.** Adopter la convention unique `[seuil_min, seuil_max)` : borne
inférieure incluse, supérieure exclue, un seuil nul valant « pas de borne ». Deux
barèmes contigus s'écrivent 0–1000 puis 1000–1300, sans recouvrement ni trou. Les
colonnes d'inclusivité sont retirées : elles auraient été décoratives.

**Vérification.** Sur le miroir, trois tranches contiguës sont acceptées, une
tranche chevauchante refusée par la contrainte d'exclusion, une seconde TVA sur
une période recouvrante refusée, un taux supérieur à 1 refusé.

---

## D-009 — Généraliser le référentiel fiscal sans toucher au circuit artisanal

**Contexte.** `snp_artisan_tax_policies` versionne correctement par date d'effet
mais fige trois taux en colonnes, sans assiette ni tranche. Elle ne peut porter ni
le FNDL ni un barème progressif.

**Décision.** Créer le référentiel généralisé et **laisser la politique artisanale
en place**, inchangée. Elle sert aujourd'hui le seul circuit dont la fiscalité soit
automatisée ; le rompre avant d'avoir éprouvé la bascule serait une régression.

**Ce qui n'est pas livré.** Aucun taux. Les barèmes seront saisis par un acteur
habilité avec leur référence réglementaire, et une règle reste en `projet` tant
qu'un second acteur ne l'a pas approuvée. Le FNDL n'a aucune définition
disponible.

**Vérification de reproductibilité.** Sur le miroir, un barème créé avec effet en
2027 à 7 % ne modifie pas le calcul d'une opération de 2026, qui continue de
résoudre 4 %. C'est l'exigence §17.

---

## Dérive connue : horodatage des migrations appliquées

Les migrations appliquées par l'outil d'administration sont enregistrées avec
l'horodatage de leur application, non avec le préfixe du fichier du dépôt. Exemple :
`20260825170000_retirer_extension_http_de_l_api.sql` est enregistrée en production
sous la version `20260825172835`. Les noms concordent, les versions non. À prendre en
compte lors de tout rapprochement local/distant.
