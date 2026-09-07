# SITE-DOC-007 — Photos des sites artisanaux

Lot local préparé depuis `04b1826c`, le 7 septembre 2026. Les changements concernent le service photo, son aperçu partagé, le formulaire de site et sa fiche détaillée. Aucun formulaire Artisan, service de sauvegarde du site, barème, permission, migration ou donnée distante n'a été modifié dans ce lot.

## Défauts reproduits et correction

| Défaut observé dans les sources initiales | Correction candidate | Preuve locale |
| --- | --- | --- |
| `uploadSitePhoto` retourne une data URL après un refus ou une exception Storage, comme si le dépôt privé avait abouti. | Le dépôt rejette avec un message français ; le fichier reste en attente dans le formulaire. Aucune nouvelle référence encodée n'est présentée comme déposée. | Service : refus retourné et exception ; formulaire : échec conservé, reprise ou retrait explicite avant sauvegarde. |
| `resolvePhotoUrl` retourne une chaîne vide en cas d'erreur. Le formulaire/les détails masquent les photos si une lecture échoue. | Chaque référence possède son propre chargement, aperçu, erreur et bouton de reprise. Une erreur ne masque ni la galerie ni les autres références. | Service : refus, réponse vide, exception ; aperçu : reprise et erreur de chargement de l'image ; intégration fiche : deux photos, une indisponible. |
| Le `Promise.all` d'un ajout multiple abandonne les réussites si une compression échoue. | Résultats individuels avec `Promise.allSettled`, succès ajoutés au brouillon, fichiers échoués conservés et seuls ceux-ci repris. Les emplacements occupés/en attente respectent la limite existante de trois. | Formulaire : succès + échec, reprise d'un seul fichier, transmission des deux références au service de sauvegarde ; lot excessif refusé explicitement. |
| Une exception de dessin/encodage dans le callback de compression pouvait laisser la promesse sans résolution. | L'exception du callback rejette la compression avec un message exploitable. | Service : `toDataURL` en erreur et contexte canvas indisponible. |
| Un dépôt déjà réussi pouvait rester sans rattachement après retrait/annulation du brouillon. | Suivi des seuls dépôts nouveaux ; suppression compensatoire avant retrait/navigation. Échec de suppression visible et reprise ciblée. Les anciennes références ne sont jamais supprimées du Storage. | Retrait, refus puis reprise, annulation partiellement réussie, conservation des références historiques et réponse tardive après changement de site/droits. |

La fiche détail rend désormais la galerie depuis `site.photos` et non depuis les seules lectures réussies (`ArtisanalSiteDetails.tsx:83`). Le traitement de dépôt et de compensation se trouve dans `ArtisanalSiteForm.tsx:329`, `:367` et `:383`. La sauvegarde reste effectuée via le même `artisanalSiteService.saveSite(form, aeaFile)` ; les références réussies sont transmises dans `photos`, sans modification du contrat AEA.

## Intégrité et limites de compensation

- Les anciens formats `data:` et URL HTTP restent lisibles. Ils ne sont ni convertis ni effacés. Les nouveaux dépôts renvoient uniquement le chemin privé `sites/<identifiant>.jpg`.
- Une référence nouvelle n'est compensée que si elle n'a **jamais été soumise** à une sauvegarde. Après un résultat réseau incertain, une suppression pourrait casser une fiche effectivement enregistrée : ces références restent protégées. La réconciliation d'un tel cas nécessite une lecture persistée ; elle n'est pas inventée ici.
- L'annulation pilotée attend la compensation ; si un retrait échoue, le formulaire reste ouvert avec les photos restantes et un message explicite. Les suppressions réussies ne sont pas répétées à la reprise.
- À la fermeture forcée, au démontage ou au changement de contexte, le nettoyage reste une tentative côté client. Une interruption réseau/fermeture du navigateur peut empêcher sa confirmation. Aucun mécanisme transactionnel ou garantie d'absence absolue d'orphelin n'est déclaré.
- Aucun nettoyage en masse, aucune suppression historique et aucune suppression de documents AEA n'ont été introduits. Le contrôle SQL existant demeure applicable à toute suppression Storage.
- Les réponses de lecture périmées sont ignorées et l'ancienne URL d'aperçu disparaît lorsque sa référence ou son contexte change. Une réponse de dépôt tardive n'est pas ajoutée au nouveau dossier. Une sauvegarde tardive n'effectue plus de navigation après démontage du formulaire.

## Vérifications disponibles

La preuve rouge `service-red.log` contient **7 échecs / 11 tests**, avant la correction du service. La suite candidate initiale comporte 44 tests locaux. Après le contrôle de conversion CSP décrit ci-dessous, elle comporte **45 tests locaux** : 18 service, 6 aperçu, 16 formulaire, 5 détail. Les assertions portent sur les interactions DOM des composants React et les appels de services simulés ; elles ne prouvent pas un enregistrement réel.

Le passage du 7 septembre à 11:26 UTC réussit **44/44**, avec **ESLint code 0**. Après la correction complémentaire de contexte, la relance à 11:36 UTC réussit également **44/44**, avec **ESLint code 0** et huit empreintes avant/après identiques. Les codes de sortie et SHA-256 courants sont dans `preuves-locales.json`, généré par `verifier-local.ps1`. Le détail des assertions est conservé dans `targeted-tests.log`, ESLint dans `lint.log`. Le compilateur TypeScript lancé avant ce complément retourne **code 0** (`npm run typecheck:compiler`, sortie `typecheck.log`, session 28824) ; cette commande ne remplace pas le contrôle de couverture des types de base ni le build final de la candidate intégrée par le pilote.

L'audit indépendant a confirmé un défaut de contexte supplémentaire avec le véritable `useArtisanalSiteData` : la fiche pouvait conserver le dossier précédent après un changement d'organisme sans navigation. Une frontière de composant indexée par le contexte complet englobe maintenant le hook et les URLs AEA/photos ; aucune modification du hook partagé. La preuve indépendante rouge est `docs/amelioration/audit/site-photos-reprise-independent-before.txt`. La revue après correction annonce **46/46**, dont deux cas indépendants avec réponses tardives, sources stables de 11:38:04 à 11:38:41 ; voir `docs/amelioration/audit/photos-local-20260907.evidence.json`. Ces essais restent locaux.

Le parcours navigateur du banc a ensuite montré l'échec des deux fichiers, y compris la fixture valide, avant appel au transport Storage. `uploadSitePhoto` utilisait `fetch(dataURL)`, soumis à `connect-src`, alors que la CSP active de `vercel.json:51` comme celle du banc n'autorise pas `data:` pour les connexions. Le test `conversion-csp-red.log` reproduit ce refus de fetch : **2 échecs / 18 cas** avant correction (conversion invalide et conversion interdite par CSP). Le service convertit désormais localement la base64 JPEG en octets puis `Blob`, sans fetch et sans assouplissement de CSP. La relance du 7 septembre à 12:09 UTC passe **45/45**, avec **ESLint code 0** et empreintes stables. Le test vérifie aussi que les octets transmis correspondent au JPEG compressé, pas au fichier original. Le succès de dépôt dans le navigateur après cette correction reste à observer.

Le dernier `npm run typecheck:compiler` après correction CSP est également terminé **code 0** (session 97406, `typecheck-final.log`).

L'inventaire machine `docs/audits/sensitive-upload-surfaces-2i.json` est complété avec `directClientDelete: true`, les appelants formulaire/aperçu et la description du retrait compensatoire résiduel de `sitePhotoService`. Le scan `src/services/sensitiveUploadInventory.test.ts` est conservé sans modification et passe **15/15** (`inventory-tests.log`). Cette déclaration ne qualifie pas la surface comme remédiée ou passée par une passerelle : dépôt et suppression demeurent des accès directs régis par les politiques existantes.

Contrôles préservés dans cette suite : catégorie formalisée/non formalisée, saisie des références et de la pièce AEA, exclusion Semi-mécanisée/Mixte, refus de sauvegarde après échec de chargement en édition, navigation par nom du site, calcul et onglets de conformité, restriction de modification pour le profil de consultation. Les tests ajoutés ne remplacent pas la recette complète du module.

**Complément d'interface après correction CSP :** le pilote a ensuite exécuté le sélecteur natif (fichier valide + fichier illisible), le blocage de sauvegarde, un refus de dépôt simulé suivi de sa reprise ciblée, une sauvegarde mémoire avec trois photos, les vues mobile à 390 px et la lecture partielle suivie d'une reprise. Voir `preview/recette-interface-apres-csp.md` et les captures distinctes de viewport. La note initiale `preview/etat-verification-interface.md` reste une preuve historique des refus avant correction. **NON EXÉCUTÉ dans ce lot :** connexion Auth, dépôt/lecture/suppression dans un vrai Storage, vérification distante de `artisanal_sites.photos`, RLS avec comptes distincts, rechargement réel et captures de page entière. La recette simulée ne valide aucun de ces points.

## Contrats et sources consultés

- `supabase/migrations/20260817_003_add_artisanal_site_photos.sql:5` : tableau de références et maximum trois ; commentaire historique autorisant des données encodées.
- `supabase/migrations/20260823130000_installer_sites_artisanaux.sql:216` : bucket privé et politiques SELECT/INSERT/UPDATE/DELETE contrôlées par `snp_peut_gerer_sites_artisanaux()`, sans changement dans ce lot.
- `src/types/artisanalSite.ts` et `src/services/artisanalSiteService.ts` : références `photos` existantes et contrat de sauvegarde, lecture seule par cet agent.
- Implémentation installée de `StorageFileApi.ts` du SDK Supabase : retour `{ data, error }` pour dépôt, lecture signée et retrait. Références officielles consultées : [upload](https://supabase.com/docs/reference/javascript/storage-from-upload), [createSignedUrl](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl), [changelog](https://supabase.com/changelog.md), [observabilité](https://supabase.com/docs/guides/monitoring-and-debugging). Aucun nouvel appel serveur ou paramètre permissif ajouté.

## Recette suivante à exécuter avec autorisation du pilote

1. Créer un dossier de test identifiable, renseigner les champs obligatoires, choisir la catégorie ; essayer une photo valide et une image volontairement illisible dans le même ajout. Vérifier succès partiel visible, reprise/retrait du seul échec et impossibilité de l'ignorer à la sauvegarde.
2. Enregistrer, lire la colonne `photos` du seul dossier créé, recharger la fiche détail, puis l'édition : les références privées et les images doivent correspondre.
3. Provoquer un refus de lecture signé et un échec de chargement d'image sur le compte de test ; vérifier le message, la reprise et le maintien des autres photos. Ne modifier aucune politique pour réussir ce test.
4. Déposer une autre photo puis la retirer/annuler avant sauvegarde ; vérifier explicitement le retrait du seul objet créé. Répéter avec un refus temporaire pour attester l'absence de navigation et la reprise.
5. Examiner desktop/mobile, noms de fichiers longs, erreurs, clavier et annonces de statut. Nettoyer uniquement les données et objets identifiés comme créés par cette recette, puis consigner les preuves.
