# État d'exécution de la mission

Ce fichier permet de reprendre la mission à l'endroit exact où elle se trouve,
même après interruption. Il est tenu à jour à chaque incrément validé.

**Dernière mise à jour** : 25 août 2026, après validation de l'incrément 2.

---

## Objectif global

Doter la plateforme SONASP d'une conciliation financière et fiscale réellement
opérationnelle, reliant ce qui a été déclaré à l'expédition à ce qui est reconnu,
facturé, payé et fiscalisé après analyse de l'acheteur — sans régression sur
l'existant.

---

## Environnement

| Élément | Valeur |
|---|---|
| Dépôt | `F:\Development\SONASP`, branche `SONASP_2026` |
| Projet Supabase | `yyverzuhkdonjjuficor` (SONASP_OPS) |
| Miroir de test | stack Docker `SONASP-local-mirror`, Kong sur 56421 |
| Serveur local | `http://127.0.0.1:5180` |

Le miroir sert à éprouver chaque migration avant production : il porte le schéma
réel et une partie des données. Toute migration y est appliquée, testée dans les
deux sens et rejouée avant d'atteindre la production.

---

## Corrections préalables — terminées

| Sujet | Preuve | État |
|---|---|---|
| Crash du tableau de production sur champ nul | 13 accès non protégés révélés par le compilateur, 3 tests de non-régression | commité |
| Erreur de rendu présentée comme panne réseau | test hors ligne + erreur de rendu ajouté | commité |
| SSRF non authentifiée via `http` | attaque passant de `HTTP 500` exécuté à `404` | **appliquée en production** |
| Élévation de privilège et franchissement de tenant | `admin → management` réussi avant, refusé après | **appliquée en production** |
| Chaîne de vente export inopérante | 4 RPC restaurées, colonnes et déclencheur en place | **appliquée en production** |
| Double réclamation fiscale | 16 573 105,49 FCFA sortis du « à reverser » | **appliquée en production** |
| Privilèges hors RLS | TRUNCATE, REFERENCES, TRIGGER retirés | **appliquée en production** |

---

## Phase 0 — Audit · terminée

`docs/audit/EXISTING_PLATFORM_AUDIT.md`, 566 lignes, huit experts en parallèle.

## Phase 1 — Modèle cible · terminée

`docs/conciliation/` : `DOMAIN_MODEL.md`, `WORKFLOWS.md`, `STATE_MACHINES.md`,
`TAX_ENGINE.md`, `ACCOUNTING_LEDGER.md`, `RBAC.md`, `IMPLEMENTATION_PLAN.md`.

---

## Phase 2 — Incréments

### Incrément 1 — Référentiel fiscal versionné · **TERMINÉ**

Objets : `snp_regles_fiscales`, `snp_calculs_fiscaux`,
`snp_resoudre_regle_fiscale()`, capacités `tax.rules.read` et `tax.rules.manage`,
extension `btree_gist` dans `extensions`.

Éprouvé : trois tranches contiguës acceptées ; tranche chevauchante, seconde TVA
sur période recouvrante, taux ≥ 1 et auto-approbation refusés. Résolution 800 →
3 %, 1100 → 4 %, 2000 → 5 %. Un barème 2027 à 7 % ne modifie pas un calcul de
2026, qui reste à 4 %.

En production : table **vide**, aucun taux livré. Politique artisanale intacte.

### Incrément 2 — Grands livres · **TERMINÉ**

Objets : `snp_grand_livre_commercial`, `snp_grand_livre_fiscal`,
`snp_solde_commercial()`, `snp_solde_fiscal()`,
`snp_refuser_alteration_ecriture()`, 11 capacités `reconciliation.*`.

Éprouvé : solde reconstruit à 100 000 après facture 1 000 000 et paiement
900 000 ; clé d'idempotence rejouée refusée ; modification et suppression d'une
écriture refusées ; contrepassation sans motif refusée ; contrepassation avec
motif ramenant le solde à −900 000 ; devise étrangère sans taux refusée.

En production : tables vides, 2 déclencheurs d'immuabilité, aucun droit
d'écriture depuis l'API.

### Incrément 3 — Assay exposé · **DÉBLOQUÉ, en cours**

Exposer `snp_analyses_teneur`, qui existe et n'a jamais servi.

**Dépendance levée** : `sensitive-upload` est déployée et vérifiée (403 sans
habilitation). `revoke-user-sessions`, également appelée par le code et absente,
a été déployée dans le même mouvement — la révocation de session était inopérante.

Restent non déployées faute de secrets : `fetch-daily-lbma-prices`,
`activate-account`, `public-assistance`, `scheduled-tasks`. Détail en R-11.

### Incrément 4 — Moteur de conciliation · **structure TERMINÉE**

Objets : `snp_conciliations`, `snp_conciliations_versions`,
`snp_conciliations_ecarts`, `snp_numeroter_conciliation()`.

Éprouvé : référence `REC-2026-0001` attribuée automatiquement sous verrou
consultatif ; deuxième dossier vivant sur la même vente refusé ; source d'analyse
incohérente refusée ; sortie de l'attente d'analyse sans source refusée ;
auto-validation refusée par la contrainte de séparation, validation par acteurs
distincts acceptée ; écart au-delà du seuil sans justification refusé ; ligne de
taxe sans code refusée ; version au motif trop court refusée.

En production : tables vides, unicité par vente garantie en base, 3 déclencheurs,
aucun droit d'écriture depuis l'API.

**Reste à faire** : la RPC transactionnelle de validation, qui produira en une
fois l'instantané, l'écriture commerciale, les écritures fiscales, la facture
définitive et l'audit.

### Incrément 6 — Avoirs et imputations · **TERMINÉ**

Objets : `snp_avoirs_client`, `snp_avoirs_imputations`, `snp_avoir_imputer()`,
`snp_avoir_solde()`, `snp_avoirs_verifier_cumul()`.

**Ordre inversé avec l'incrément 5** : la facture définitive dépend de la
convention d'assiette, point métier non tranché, tandis que les avoirs
complètent directement le trop-perçu que la conciliation matérialise.

`snp_avoirs_achat` n'a pas été étendue : elle se rattache aux factures d'achat,
ignore la contrepartie client et ne connaît que deux états. Ce sont deux flux
distincts, non un doublon.

Éprouvé : `AVO-2026-0001` créé, imputation partielle laissant 13 999,87,
dépassement refusé, solde exact accepté ramenant à 0, imputation sur avoir
épuisé refusée, modification d'imputation refusée.

Concurrence : le déclencheur de cumul ne suffit pas seul, deux transactions
liraient le même cumul. C'est le verrou `FOR UPDATE` de la procédure qui
sérialise, l'écriture directe étant par ailleurs impossible — vérifié, les
tables n'accordent que `SELECT`.

### Incrément 5 — Facturation définitive · à faire

**Bloqué par un point métier** : l'audit relève un net serveur divergeant du net
imprimé. La convention d'assiette doit être tranchée avant d'imprimer une
facture définitive.

### Incréments 7 à 9

Cloisonnement multi-tenant, cockpit et rapports, dette technique. Détail dans
`docs/conciliation/IMPLEMENTATION_PLAN.md`.

---

## Migrations appliquées en production ce jour

`retirer_extension_http_de_l_api`, `verrouiller_role_et_tenant_du_profil`,
`restreindre_emission_notifications`, `decisions_ventes_atomiques_structures`,
`rpc_snp_decider_approbation`, `rpc_vente_client_decision`,
`creer_ventes_export_atomiquement`,
`corriger_doublon_taxe_developpement_communal`, `retirer_privileges_hors_rls`,
`referentiel_fiscal_versionne`, `grands_livres_commercial_et_fiscal`.

**Dérive connue** : l'outil d'administration horodate à l'application, si bien que
la version enregistrée diffère du préfixe du fichier. Les noms concordent.

## Migrations du dépôt délibérément non appliquées

`20260822164500` (écraserait 10 fonctions), `20260822170000` (prédicat obsolète,
priverait cinq rôles d'accès), `20260822174500` (différée, à tester),
`20260823220000` (déjà déployée en substance), `20260822180000` (35 opérations
destructives, décision métier), `20251226120554` (obsolète, politiques
permissives). Motifs détaillés en D-004 et D-005.

---

## Tests

`vitest` : 208 fichiers, 1573 tests, verts après chaque incrément.
`migration-integrity` : 10/10, catalogue vérifié sans dérive structurelle.

**Zone nue** : aucun test automatisé ne couvre encore les invariants des grands
livres ni la résolution fiscale. Ils sont aujourd'hui éprouvés par script sur le
miroir ; leur reprise en tests SQL versionnés est à faire.

---

## Points métier ouverts

1. Taux, assiettes et affectataires opposables pour TVA, royalties et FNDL.
2. Définition du FNDL, absent du code comme du schéma.
3. Convention d'assiette de la retenue et des taxes.
4. Ancrage contractuel des ventes aval : `snp_contrats` ou `customer_contracts`.
5. **Aucun compte `management` n'existe en production.** Les capacités
   `reconciliation.approve` et `sonasp.*` lui étant réservées, aucune conciliation
   ne pourra être validée tant qu'un titulaire ne sera pas habilité.

Aucun de ces points n'empêche de construire : le moteur est paramétrable et
aucun taux n'est figé dans le code.

---

## Prochain travail exécutable

Incrément 3, sous réserve du déploiement de `sensitive-upload`. À défaut,
l'incrément 4 peut démarrer sur la structure de conciliation, la pièce
justificative étant raccordée ensuite.
