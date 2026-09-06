# Publication des sites et artisans — 6 septembre 2026

## Incident confirmé

Les publications locales des sites de 10 h 29 et 10 h 40 comprenaient des modifications non committées. Le déploiement Git `b6fde9832be3-mtppw2jh` les a remplacées par le contenu ancien du dépôt. Le commit concerné modifiait seulement la documentation du nettoyage et son script ; il ne supprimait pas les composants. L'écart provenait de la source de publication.

Les sauvegardes et le dossier de travail contiennent les améliorations intégrales. Le formulaire de site, ses styles, ses détails, son tableau de bord, son service et son contrat de formalisation ont été comparés à la publication de 10 h 40 : fichiers identiques.

## Périmètre de restauration

Sites : type artisanal unique, catégories et AEA, création et modification, documents privés, détails et calcul de conformité, droits DGMG/administrateur, actualisation, nom du site, actions alignées et onglets de catégorie. Artisans : publication du formulaire déjà amélioré, sans refonte supplémentaire, avec les services transactionnels, responsable de société, aides exploitants et documents privés associés.

## Règles de publication

1. Examiner les changements partagés et enregistrer explicitement tous les fichiers du lot dans Git. Les documents locaux étrangers au code restent hors du commit.
2. Valider la migration isolée, ses checksums et une répétition annulée sur le schéma distant. Appliquer uniquement la migration attendue avec son entrée d'historique dans la même transaction. Ne jamais réparer ou rejouer globalement l'historique divergent.
3. Installer les dépendances serveur avant de pousser le frontend qui les utilise. Sauvegarder et vérifier séparément le gateway `sensitive-upload`.
4. Publier par le push du commit sur `SONASP_2026`. Vercel exécute `npm ci --no-audit`, puis `npm run build:release` : provenance Git, contrôles des formulaires, catalogue, typage et compilation. Une erreur arrête la nouvelle publication.
5. Vérifier le déploiement Ready, le domaine de production et la concordance du préfixe de `build-version.json` avec le commit distant. Examiner les fichiers effectivement servis et les parcours navigateur. La PWA continue à proposer sa mise à jour explicitement afin de préserver les saisies en cours.

`scripts/release/verify-build-source.mjs` refuse une publication Vercel sans métadonnées de l'intégration GitHub, une autre branche de production, un commit annoncé différent du dépôt et, lorsqu'un dépôt est présent, des fichiers applicatifs modifiés ou non suivis. `npm run build` conserve cette vérification sur Vercel ; `npm run build:release` impose aussi un dépôt propre pour une préparation locale. Les six tests du contrôle reproduisent notamment le cas de fichiers non committés.

Ces protections préviennent la cause de cet incident dans le circuit normal. Elles ne remplacent pas la revue métier et n'empêchent pas un administrateur de modifier la configuration ou de restaurer manuellement un ancien déploiement. Ne pas republier une ancienne sauvegarde locale.

## Preuves

Les reçus historiques restent inchangés. Le reçu de cette livraison consigne le commit final, les contrôles, la migration et les versions publiées. Les instantanés du schéma et du gateway restent hors du dépôt dans le dossier privé de sauvegarde ; aucun dossier métier n'est exporté dans les reçus Git.
