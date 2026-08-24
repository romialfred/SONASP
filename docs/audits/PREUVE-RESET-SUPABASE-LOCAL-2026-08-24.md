# Lot 4E — Preuve de reconstruction Supabase locale

- Date : 24 août 2026
- Commit testé : `bc3dcdd72cd68df058d34fb7c87fbc2d0ce8aab5`
- Docker : client et serveur `29.6.2`
- Supabase CLI : `2.115.0`
- Base distante : aucune connexion, requête, application ou réparation
- Workspace source : aucune migration ni configuration modifiée pour l'essai

## Verdict

`supabase db reset --local --no-seed` échoue de façon déterministe sur la première migration reconnue. L'environnement Docker/Supabase est fonctionnel ; le blocage est une baseline SQL manquante, pas une indisponibilité de l'outillage.

Première erreur exacte :

```text
Applying migration 20251112_012_migrate_assay_certificates_to_shipping.sql...
ERROR: relation "assay_certificates" does not exist (SQLSTATE 42P01)
At statement: 0
ALTER TABLE assay_certificates
ADD COLUMN IF NOT EXISTS shipping_preparation_id UUID
```

Avant cette erreur, la CLI ignore explicitement onze fichiers :

```text
Skipping migration add_export_licenses_system.sql... (file name must match pattern "<timestamp>_name.sql")
Skipping migration add_license_quota_functions.sql... (file name must match pattern "<timestamp>_name.sql")
Skipping migration add_mining_company_to_shipping.sql... (file name must match pattern "<timestamp>_name.sql")
Skipping migration add_production_documents.sql... (file name must match pattern "<timestamp>_name.sql")
Skipping migration add_production_status_tracking.sql... (file name must match pattern "<timestamp>_name.sql")
Skipping migration add_shipping_system.sql... (file name must match pattern "<timestamp>_name.sql")
Skipping migration add_total_weight_oz_to_shipping.sql... (file name must match pattern "<timestamp>_name.sql")
Skipping migration fix_daily_production_rls_and_permissions.sql... (file name must match pattern "<timestamp>_name.sql")
Skipping migration fix_shipping_preparations_columns.sql... (file name must match pattern "<timestamp>_name.sql")
Skipping migration fix_shipping_rls_only.sql... (file name must match pattern "<timestamp>_name.sql")
Skipping migration unified_status_system_fixed.sql... (file name must match pattern "<timestamp>_name.sql")
```

## Protocole isolé exécuté

1. Clone Git local avec `--no-hardlinks` dans `%TEMP%`, au commit exact ci-dessus.
2. Vérification de l'absence de `supabase/.temp/project-ref`.
3. Remplacement du `project_id` dans le clone uniquement.
4. Ports PostgreSQL isolés : `56520` pour shadow, `56522` pour la base.
5. Démarrage du seul conteneur PostgreSQL avec les migrations temporairement désactivées.
6. Réactivation des migrations dans le clone.
7. Exécution de `supabase db reset --local --no-seed`.
8. Arrêt du projet temporaire avec `--project-id` explicite et `--no-backup`.
9. Suppression limitée au clone `%TEMP%\sonasp-reset-*` après validation du chemin.

Le premier `supabase start` avec migrations actives a produit la même erreur. Le second démarrage, migrations désactivées, a réussi et a exposé `postgresql://postgres:postgres@127.0.0.1:56522/postgres`. Le reset qui a suivi reproduit `42P01`, ce qui sépare nettement le diagnostic d'environnement du défaut d'historique.

Le runner a ensuite été exécuté une seconde fois avec `-PortBase 57520 -KeepClone`. Il a reproduit l'erreur, arrêté uniquement `sonasp_reset_bc3dcdd_42d495b6` et retourné le code 1 attendu. Après vérification de l'absence de conteneur portant cet identifiant, les deux clones de test exacts ont été envoyés dans la Corbeille Windows ; ils ne subsistent plus dans `%TEMP%` et restent récupérables tant que la Corbeille n'est pas vidée.

## Analyse de la cause

La migration `20251112_012_migrate_assay_certificates_to_shipping.sql` commence par modifier `assay_certificates`, puis dépend aussi de `assay_certificate_data` et `shipping_preparations`. Aucun fichier SQL du dépôt ne contient de `CREATE TABLE assay_certificates` ou de `CREATE TABLE assay_certificate_data`.

Le fichier non versionné `add_shipping_system.sql`, ignoré par la CLI, crée `shipping_preparations`, mais pas les deux tables assay. Lui attribuer arbitrairement un timestamp ne suffirait donc pas et pourrait contredire l'historique réellement appliqué.

La correction sûre n'est ni `ALTER TABLE IF EXISTS`, ni un renommage en masse : ces options feraient passer artificiellement le statement 0 tout en produisant un schéma incomplet.

## Runner reproductible

Le script dédié ne contient aucune commande `--linked`, `link`, `push`, `deploy` ou accès distant :

```powershell
pwsh -File scripts/test-supabase-reset-isolated.ps1 `
  -SupabaseCli "C:\chemin\vers\supabase.exe"
```

Options :

- `-PortBase 57520` choisit une autre plage locale ;
- `-KeepClone` conserve le clone après arrêt des conteneurs pour inspection ;
- `-RepositoryRoot` permet de tester un autre clone Git local.

Le script clone uniquement `HEAD`. Les fichiers sales ou non suivis du workspace source ne sont ni copiés ni modifiés.

## Correction requise avant un reset vert

1. Obtenir une preuve autoritative et approuvée du schéma initial ayant créé `assay_certificates`, `assay_certificate_data` et leurs dépendances.
2. Produire une baseline canonique antérieure à `20251112_012`, revue à quatre yeux et restaurée dans un clone jetable.
3. Établir la matrice entre les onze scripts ignorés, les versions distantes et leurs checksums ; ne renommer aucun fichier avant cette matrice.
4. Rejouer le runner jusqu'à la prochaine erreur, corriger uniquement les défauts démontrés par migrations compensatoires ou baseline approuvée.
5. Lorsque tout l'historique passe, ajouter au gate CI un vrai `supabase db reset`, `db lint` et les contrats pgTAP.

## Risques résiduels

- La première erreur masque nécessairement les erreurs ultérieures.
- Le schéma live n'a pas été consulté ; aucune hypothèse sur son contenu n'est certifiée.
- Une baseline inventée à partir du seul frontend risquerait de perdre contraintes, grants, RLS, triggers et données de référence.
- Les doublons et préfixes non canoniques déjà recensés par le Lot 4D restent des bloqueurs après résolution de la table absente.
