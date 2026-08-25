# Registre des risques

Sévérité = impact × probabilité. Un risque n'est clos que lorsqu'une vérification
l'atteste. Les faits cités ont été observés sur le projet hébergé
`yyverzuhkdonjjuficor` ou sur le miroir local.

| ID | Risque | Impact | Probabilité | Sévérité | Statut |
|---|---|---|---|---|---|
| R-01 | SSRF non authentifiée via l'extension `http` | critique | avérée | **critique** | **fermé** |
| R-02 | Élévation de privilège par modification de son propre profil | critique | avérée | **critique** | **fermé** |
| R-03 | Double réclamation de la taxe de développement communal | élevé | avérée | **élevé** | corrigé, non appliqué |
| R-04 | Chaîne de vente export inopérante | élevé | avérée | **élevé** | **fermé** |
| R-05 | Privilèges hors RLS accordés aux rôles de l'API | moyen | possible | moyen | corrigé, non appliqué |
| R-06 | Cloisonnement multi-tenant incomplet | élevé | avérée | **élevé** | ouvert |
| R-07 | Interfaces locales divergeant des types générés | moyen | avérée | moyen | ouvert |
| R-08 | Dérive entre migrations du dépôt et production | moyen | avérée | moyen | ouvert |
| R-09 | Barème fiscal sans validation juridique | élevé | avérée | **élevé** | ouvert |
| R-10 | Montants financiers non arrondis en XOF | moyen | avérée | moyen | ouvert |
| R-11 | Fonctions Edge non déployées | moyen | avérée | moyen | ouvert |
| R-12 | Objets appelés par le code et absents du schéma | moyen | avérée | moyen | ouvert |

---

## R-01 — SSRF non authentifiée · FERMÉ

**Description.** L'extension `http` était installée dans `public`, exposée par
PostgREST, exécutable par `anon`. La clé anon étant publique par construction, tout
appelant pouvait faire émettre une requête HTTP arbitraire par la base.

**Preuve.** `POST /rest/v1/rpc/http_get` avec `{"uri":"http://127.0.0.1:1/"}`
répondait `HTTP 500 — Failed to connect to 127.0.0.1 port 1`.

**Mitigation.** Extension recréée dans `extensions`, non exposé par PostgREST.

**Vérification.** La même attaque répond `404 PGRST202`. Voir D-001.

**Résiduel.** Droits d'exécution toujours accordés ; défense en profondeur
incomplète. Demande une intervention sous `supabase_admin`.

---

## R-02 — Élévation de privilège · FERMÉ

**Description.** Le `WITH CHECK` de `users_update_own_profile` ne figeait que
`is_active`, et le déclencheur de versionnement ne levait d'exception que pour ce
champ. Un compte pouvait modifier son `role` et son `mining_company_id`.

**Preuve.** Sur le miroir, un compte `admin` s'est élevé à `management`.

**Mitigation.** Garde sur `current_user` dans le déclencheur. Voir D-002.

**Vérification.** Attaque refusée, administration légitime préservée.

---

## R-03 — Double réclamation fiscale · corrigé, non appliqué

**Description.** 16 573 105,49 FCFA réclamés une seconde fois sur une taxe déjà
soldée, sur 24 paiements.

**Mitigation.** Migration `20260825160000` : déclencheur détaché, doublons annulés
sans suppression. Éprouvée sur le miroir, rejouable.

**Statut.** En attente d'application en production.

---

## R-04 — Chaîne de vente export inopérante · FERMÉ

**Description.** Quatre RPC appelées par le code étaient absentes de la production,
ainsi que `snp_ventes_lots.released_at`. Création de vente et chaîne d'approbation
ne fonctionnaient pas.

**Mitigation.** Migrations `20260822171500` et `20260822173000` appliquées après
analyse d'ensemble. Impact données nul : aucune vente à réaligner, règle de
redevance déjà présente.

**Vérification.** Les quatre RPC répondent ; `sales`, `daily_production` et
`gold_prices_daily` répondent 200.

---

## R-05 — Privilèges hors RLS · corrigé, non appliqué

**Description.** `anon` et `authenticated` détiennent TRUNCATE, REFERENCES et
TRIGGER sur la quasi-totalité des tables. Ces privilèges échappent aux politiques.

**Nuance.** Non atteignables via PostgREST : pas de faille directe, mais la défense
en profondeur est annulée.

**Mitigation.** Migration `20260825170200`, éprouvée et rejouable. Non appliquée.

---

## R-06 — Cloisonnement multi-tenant incomplet · OUVERT

**Description.** Le cloisonnement par périmètre minier n'est pas posé. La migration
prévue est inapplicable en l'état : elle repose sur `snp_est_agent_sonasp()`, dont la
définition a changé et ne reconnaît plus que le rôle `management`, avec MFA.

**Conséquence si appliquée telle quelle.** Les rôles `admin`, `manager`, `factory`,
`airport` et `refinery` perdraient tout accès aux tables à `mining_company_id`.

**Mitigation à construire.** Poser le cloisonnement avec un prédicat aligné sur
l'état actuel des capabilities. Voir D-005.

---

## R-07 — Interfaces divergeant des types générés · OUVERT

**Description.** Des interfaces écrites à la main contredisent le schéma réel. Cas
avéré : `DailyProduction` déclarait deux colonnes nullables comme non nullables,
rendant le compilateur aveugle à treize accès fautifs et faisant tomber un écran en
présentation.

**Mitigation partielle.** Interface corrigée, treize accès protégés, trois tests de
non-régression.

**Résiduel.** Le motif subsiste ailleurs : quatre incompatibilités d'affectation dans
`ShippingPreparationNew`, et `typecheck:database` échoue sur 20 relations absentes de
`src/types/database.ts`.

---

## R-08 — Dérive migrations dépôt / production · OUVERT

**Description.** Neuf migrations du dépôt n'ont jamais été appliquées ; certaines
sont désormais inapplicables telles quelles. Par ailleurs les migrations appliquées
par l'outil d'administration reçoivent un horodatage distinct du préfixe de fichier.

**Mitigation.** Analyse et arbitrage consignés en D-004. Le catalogue reste vérifié
sans dérive structurelle.

---

## R-09 — Barème fiscal sans validation juridique · OUVERT

**Description.** Trois jeux de taux contradictoires coexistent dans le dépôt, sans
validation tracée. Le FNDL n'a aucune définition, ni dans le code ni dans le schéma.

**Position retenue.** Ne rien inventer. Construire le moteur fiscal versionné et
paramétrable, charger les règles existantes, marquer celles qui demandent
confirmation. Ne jamais figer un taux dans le code.

**Point métier à confirmer.** Taux, assiettes et affectataires opposables pour TVA,
royalties et FNDL.

---

## R-10 — Montants non arrondis en XOF · OUVERT

**Description.** 36 ventes sur 39 portent des montants jusqu'à 42 décimales, dans une
devise sans subdivision. Le déclencheur historique en était une source ; sa
suppression traite le flux futur, pas l'historique.

---

## R-11 — Fonctions Edge non déployées · OUVERT

**Description.** 7 fonctions ACTIVE sur 14 codées. `sensitive-upload` n'est pas
déployée, alors que c'est la voie prévue pour le rapport de laboratoire acheteur —
pièce maîtresse du module de conciliation.

---

## R-12 — Objets appelés par le code et absents du schéma · OUVERT

**Description.** La vitrine publique interroge la table `publications`, qui n'existe
pas en base : l'endpoint répond 404. Même famille que les RPC absentes traitées en
R-04.
