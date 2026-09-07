# Recette réelle R04 : préparation séparée

Le 7 septembre 2026, le principal a confirmé la reconnexion et demandé un nouveau RUN **QA20260907-R04** sur le build intégré local `127.0.0.1:5192`, relié à la base de test existante SONASP_OPS. Les artefacts R02 audités restent intacts. Aucune migration, DDL, modification de droits ou écriture SQL/API n’est autorisée à cet agent sans instruction distincte du principal.

## État initial observé

`baseline-before.json`, transaction READ ONLY du **16:21:34 UTC**, code 0 : 9 sites, 18 responsables, 65 artisans, 26 cartes, 31 moyens de paiement, autres tables de dossier vides, 3 objets Storage historiques. Chaque ligne possède son UUID et une empreinte ; les trois objets antérieurs sont enregistrés avec une empreinte de métadonnées. `preflight.json` est une seconde lecture READ ONLY des contrats de tables, colonnes, FK, triggers, fonctions, politiques ciblées et buckets.

Ces lectures privilégées ne prouvent ni l’Auth/MFA du navigateur, ni l’accès effectif du compte UI. La sélection de politiques Storage du préflight est filtrée par les buckets artisanaux : elle documente les règles spécifiques, mais ne remplace pas la vérification du résultat API avec l’ensemble des politiques applicables.

Le principal a ensuite signalé un refus de contrôle de l’extension navigateur (« Debugger unattached »). **Aucune autre commande distante après le préflight** tant que la reprise UI n’est pas confirmée. Aucun dossier ni upload R04 n’a été déclaré soumis à la préparation de cette note.

## Saisie et preuves attendues

1. **Création UI** du site `QA20260907-R04-SITE`, non formalisé, sans pièce. Nom, région/province/localité, superficie positive, coordonnées dans les bornes du Burkina (latitude 9–16, longitude −6 à 3), capacité positive ou nulle, effectif actif inférieur ou égal à la capacité. Deux responsables distincts par rôle, nom et téléphone requis. Le principal conserve les valeurs effectivement saisies, le code et l’UUID retournés, les captures de succès et de la liste sans rechargement.
2. **Relecture SQL exacte** uniquement après réception de l’UUID UI et du JSON attendu. Comparer toutes les valeurs demandées et les deux responsables ; conserver leurs IDs/created_at. Une réussite de lecture vide ne vaut pas une création vérifiée.
3. **Modification du même site UI**, par exemple changement de superficie/effectif/observations et des coordonnées d’un responsable, puis catégorie **Site formalisé**. AEA : numéro, date d’émission réelle de la pièce QA, durée entière 1–1200 mois, justificatif PDF/JPEG/PNG de **10 MiB maximum**. La date d’expiration est calculée par mois calendaires. Ajouter une ou deux photos JPEG/PNG lisibles (trois au maximum), attendre chaque aperçu et seulement ensuite enregistrer. Préférer des pièces clairement marquées QA ; aucun document réel d’une autre personne.
4. **Détails et réouverture UI** : données modifiées, document AEA consultable, photos visibles, reprise des champs après réouverture, onglets disponibles. Conserver captures et résultats observés. En cas d’erreur, ne pas resoumettre une création aveuglément : garder les références et relire le même UUID.
5. **Deuxième relecture SQL**, puis contrôle des uploads : parent stable, code/created_at préservés, updated_at avancé, valeurs saisies retrouvées, deux responsables conservés par rôle avec leurs IDs, photos et AEA associés à de vrais objets Storage nouveaux. Comparaison de baseline pour distinguer les ajouts QA des éventuels changements tiers.

Le service de sauvegarde actuel utilise le RPC `snp_save_artisanal_site`; les responsables sont mis à jour sur le couple `(site_id, role)` et ne sont pas supprimés/recréés. La concurrence générale d’écriture SITE-CONC-004 reste hors recette et hors autorisation de migration.

## Contrats de fichiers et limites

- **Photos :** le dépôt s’effectue dès la sélection. Compression locale JPEG, côté le plus long ≤1280 pixels, qualité 0,72. Bucket privé `artisanal-sites`, chemin `sites/<UUID>.jpg`, upsert désactivé. Maximum trois références par site. Le bucket live n’impose pas de taille/MIME dans sa configuration ; la recette vérifie le vrai JPEG produit par le navigateur. Aucun succès Storage ne doit être remplacé par une data URL.
- **AEA :** dépôt à la sauvegarde, bucket privé `artisanal-site-aea`, chemin `<UUIDduSite>/<UUIDduFichier>.(pdf|jpg|jpeg|png)`. Bucket live limité à 10 MiB et PDF/JPEG/PNG. Le trigger exige un objet existant appartenant au chemin du site. Le remplacement utilise un nouveau chemin, jamais un écrasement.
- Les liens d’aperçu sont signés pour une heure ; **ne pas enregistrer les URLs signées ou les tokens** dans les preuves. Les références de bucket/objet ne sont pas des liens signés.
- La lecture SQL valide les références, l’existence, l’UUID, la taille, le MIME et les métadonnées. Elle **ne valide pas les octets** des documents. Une preuve binaire exige un téléchargement via l’interface autorisée et une empreinte du fichier reçu ; une photo compressée ne peut pas être comparée octet pour octet à son original.
- La suppression d’une photo historique dans le formulaire retire la référence du dossier ; elle ne garantit pas la destruction physique du fichier. Un upload échoué peut aussi laisser un objet non lié si la compensation échoue. Un simple delta de bucket n’autorise pas à attribuer ces objets à R04 : exigez une référence observée dans le parcours ou le dossier exact.

## Outils préparés, aucune mutation

Les scripts R04 sont des copies indépendantes des mécanismes R02, avec dossier et préfixe remplacés. Les hashes Storage sont explicitement nommés `metadata_md5`. Les scripts refusent l’écrasement des preuves et les requêtes SQL distantes restent strictement séquentielles.

```powershell
node docs/amelioration/environnement/reprise-r04/prepare-dossier-read.mjs site <UUID-UI-exact> creation
# Puis run-readonly sur le fichier affiché et compare-dossier avec l’attendu du principal.
node docs/amelioration/environnement/reprise-r04/prepare-dossier-read.mjs site <UUID-UI-exact> modification
node docs/amelioration/environnement/reprise-r04/prepare-uploads-read.mjs <UUID-UI-exact> modification
```

`compare-dossier.mjs` exige `expected.kind`, `expected.id` et un parent attendu non vide ; il compare exactement les tableaux demandés. `prepare-uploads-read.mjs` prépare seulement une lecture du site au préfixe exact, de ses chemins canoniques et du nombre de sites partageant chaque objet. Une photo/AEA référencée par un autre site n’entre pas dans un nettoyage automatique.

## Futur nettoyage, à préparer après les UUID et objets réellement observés

1. Constituer un manifeste final : un UUID de site, les deux UUID de responsables, chaque objet **identifié dans ce RUN** avec bucket, chemin, UUID Storage, date de création et empreinte de métadonnées. Comparer aux objets historiques du baseline et refuser tout objet préexistant. Conserver aussi les anciens chemins QA remplacés au cours du parcours, sans les confondre avec les fichiers historiques.
2. Relire les lignes/FK/triggers et les usages de chaque fichier. Refuser toute divergence ou dépendance externe. Reprendre l’ordre déterministe des agrégats par contenu JSON avec collation `C`, testé lors du nettoyage R02, sans supposer que toutes les tables ont une clé `id`.
3. Après instruction distincte et revue du SQL concret, supprimer les deux responsables et le site exacts dans une transaction gardée ; aucune cascade vers un tiers, aucune opération Auth ou DDL. Avec des pièces, les hashes doivent être ceux de la fiche finale, pas ceux de la création. Vérifier l’absence et la préservation des autres lignes.
4. **Ensuite seulement**, supprimer les seuls objets QA par la **Storage API**, sous les droits existants et une instruction du principal. L’AEA est protégée contre suppression tant qu’un site la référence. La [documentation officielle impose la Storage API pour supprimer les fichiers](https://supabase.com/docs/guides/storage/management/delete-objects) : un `DELETE storage.objects` laisserait les octets orphelins. Ne jamais vider le bucket, supprimer par préfixe global `sites/`, ni utiliser de mutation de schéma pour contourner un refus.
5. Relecture finale : objets QA absents, objets historiques et métadonnées préservés, trois lignes QA absentes. La transaction SQL et la suppression Storage ne sont pas atomiques ensemble : si l’étape API est refusée ou ambiguë, conserver le manifeste des objets restants et relire avant toute reprise.

Aucun SQL de suppression n’est encore généré, car aucun UUID ou chemin R04 issu d’une saisie réelle n’a été fourni. Aucun résultat non exécuté n’est déclaré validé.
