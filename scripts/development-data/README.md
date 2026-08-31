# Peuplement historique de développement — TEST3Y-20260830

## État au 30 août 2026

**Préparation en cours, aucun peuplement distant effectué.** Le propriétaire a
confirmé que toutes les données actuelles sont des données de développement.
Cette confirmation autorise le peuplement, mais les déploiements des correctifs
serveur ci-dessous restent en attente d'autorisation. `run.mjs` refuse actuellement
tout `--commit`, même avec une confirmation de développement.

## Scénarios préparés

Période métier : septembre 2023 à août 2026, 36 mois. Les dates d'import et d'audit
restent les dates véritables d'exécution, sans falsification des journaux.

- Trois mines / sites, 108 productions, 108 achats liés à leur production,
  36 plans, 108 demandes et factures d'achat brouillon, 36 règlements brouillon.
- 72 expéditions, analyses initiales et certificats de raffinerie rattachés.
- 36 ventes export / conciliations : attente, analyse reçue, validation distincte.
- 36 lots raffinés, 34 affectations dont 27 actives et 7 en étapes intermédiaires.
  Les lots vendus et ceux affectés en réserve viennent de productions distinctes.
- 24 artisans, trois sites, 216 ventes nationales et 180 factures non certifiées
  DGI, 12 réquisitions et 12 contrats brouillon.
- Cours et changes synthétiques ajoutés uniquement aux dates absentes.
- Références `TEST3Y-*`, UUID déterministes `d8302026-*`, adresses `example.invalid`.
  Sept acteurs historiques nouveaux sans mot de passe, sans invitation et bannis
  dans Auth ; leurs profils doivent être désactivés à la fin de l'import.

Les achats de Comptoir ne sont pas inclus dans ce premier lot : la contrainte de
rôle publiée ne permet pas encore de créer cet acteur. Aucun droit existant n'est
modifié pour contourner cette incompatibilité. Aucun paiement exécuté, certification
DGI officielle ou communication externe n'est fabriqué.

## Blocages constatés sur le schéma publié

1. Absence de `snp_conciliation_impacts_fiscaux(...)` : correction locale
   `20260830120000_fiabiliser_conciliation_expeditions_et_impacts.sql` non publiée.
2. Deux triggers d'entrée sur `gold_inventory`, avec écritures en double : correction
   locale `20260829204000_durcir_grand_livre_stock_reserve.sql` non publiée.
   Cette migration consolide des écritures techniques existantes : elle exige
   sauvegarde ciblée et examen des lignes concernées avant déploiement.
3. `log_account_status_change()` référence `audit_trail.user_id`, colonne absente.
   Le défaut bloque la désactivation finale des profils synthétiques ; la correction
   existe dans le lot IAM local `20260830103000_securiser_administration_owner_et_profils.sql`.
   Ne pas déployer tout le lot IAM sans examiner et autoriser son périmètre.

## Vérifications réellement exécutées

- Export en lecture seule du schéma lié et des capacités nécessaires ; aucun secret
  SMTP, jeton utilisateur ou clé privée exporté par ces scripts.
- Copie dédiée `sonasp_seed_validation_live_20260830` dans
  `supabase_db_SONASP-local-mirror`, sans modification de la base métier du miroir.
- Les deux correctifs Stock/Conciliation ont été appliqués **uniquement à cette copie**.
- Le dernier essai a exécuté les trois chapitres de données avec succès, puis échoué
  dans le trigger d'audit lors de la désactivation des profils. La fermeture de la
  connexion a annulé l'intégralité de la transaction. Aucun jeu n'a été conservé.
- Les assertions de `postflight.sql` sont préparées mais **pas encore validées** :
  l'erreur d'audit survient avant leur exécution.
- Aucun test complet des portails ou des droits navigateur n'est revendiqué.

## Avant tout peuplement définitif

1. Obtenir l'autorisation de déploiement ciblé ; sauvegarder et comparer le schéma
   réellement publié, puis traiter les trois prérequis sans `db reset`, `db push`
   aveugle ni réparation de l'historique des migrations.
2. Rejouer sur un miroir représentatif, passer les assertions de quantité, devise,
   relations, séparation des acteurs et préservation des profils/droits existants.
3. Générer, inspecter et charger les 106 PDF TEST : 72 analyses et 34 décisions.
   Le manifeste est prévu ; les fichiers ne sont **pas encore créés**. Remplacer
   les tailles provisoires des pièces par les tailles réelles avant publication.
4. Vérifier l'annulation des courriels/SMS et de toutes les notifications externes
   du lot, sans toucher aux notifications des données préexistantes.
5. Exécuter une répétition distante annulée, puis seulement lever le verrou COMMIT
   et importer en transaction. Contrôler le rejeu sans doublons et les données
   réellement affichées. Conserver le reçu et les contrôles après import.

## Commandes de diagnostic / validation locale

```powershell
node scripts/development-data/read-references.mjs
node scripts/development-data/run.mjs
```

La première commande lit les référentiels distants ; la seconde utilise la copie
locale et annule la transaction par défaut. `--foundation-only` limite les chapitres,
mais n'est pas un mode de publication partielle.

`prepare-local.mjs <schema-public-observe.sql>` crée un miroir dédié sans écraser
une base existante. Les options de reprise concernent exclusivement cette base
de validation. Les fichiers sous `output/development-data` sont des sorties de
diagnostic, pas une preuve d'import réussi.
