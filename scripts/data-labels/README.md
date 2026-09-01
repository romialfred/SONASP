# Correction des références et libellés de développement

Demande du 31 août 2026 : conserver les générateurs existants et retirer les marqueurs de jeux de données des références et textes visibles.

## Périmètre

- Ventes : `SL-YYYY-NNNNNN`, compteur et verrou annuels identiques à `snp_creer_vente_export`.
- Achats : `AC-MI-YYYY-NNNNN`, format existant.
- Expéditions : `HUM-ABREVIATION-NNNN/YYYY`, réservation dans le compteur existant.
- Factures et règlements : appel du générateur existant `snp_numero_suivant` (`FA` / `REG`).
- Libellés : correspondances exactes des anciens jeux, pas de remplacement global de mots.

Les UUID, liens, montants, quantités, statuts et preuves restent inchangés. Les avertissements « non certifié », « source à vérifier », « sans valeur juridique » sont conservés. Aucune modification de code de génération, de RLS, de trigger, d'historique d'audit ni d'ancienne migration. Les dates techniques de modification peuvent être mises à jour par les triggers existants. Les nouveaux événements d'audit conservent l'ancienne et la nouvelle valeur.

## Exécution

1. `inspect.sql`, `inspect-operations.sql`, `audit-labels.sql` : inspection, sans mutation persistante.
2. Copier la base de validation dans `sonasp_label_validation_20260831`. `prepare-local.sql` complète uniquement les identifiants Auth inertes nécessaires aux clés étrangères de cette copie. Ne jamais l'exécuter ailleurs.
3. `node scripts/data-labels/run.mjs local sonasp_label_validation_20260831` : vérifier la correction sur cette copie ; relancer et vérifier zéro changement.
4. `node scripts/data-labels/run.mjs rehearse CHEMIN_CLI_SUPABASE` : répétition distante avec `ROLLBACK`.
5. Après vérification et autorisation : `node scripts/data-labels/run.mjs apply CHEMIN_CLI_SUPABASE NORMALIZE-DEVELOPMENT-LABELS`.
6. Rejouer l'audit de libellés et contrôler les références retournées.

Le script d'application conserve les correspondances et un `restore.sql` dans un répertoire temporaire explicitement affiché. Le retour arrière est à relire ; il refuse toute cellule modifiée depuis l'intervention. Les compteurs ne sont jamais décrémentés, car des numéros peuvent avoir été consommés. En cas d'erreur réseau après application, inspecter l'état avant toute nouvelle tentative.

## Non-régression et pérennité

La transaction verrouille les tables ciblées et compare les empreintes de leurs données métier et tables dépendantes avant/après. Elle vérifie aussi que les fonctions, triggers et politiques de sécurité restent identiques. Les mises à jour ne ciblent que les colonnes autorisées.

Les migrations historiques déjà appliquées sont immuables et ne doivent pas être rejouées pour recharger un jeu de données. Le nouvel import historique de `scripts/development-data/run.mjs` reste bloqué à la publication : cette intervention ne le débloque pas. Tout futur jeu doit utiliser les générateurs métier ; sa provenance doit rester dans ses métadonnées techniques, pas dans les références ou libellés affichés.
