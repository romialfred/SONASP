# Correction locale des lectures Collecteurs / Comptoirs

La suite de l’audit a été explicitement autorisée pour les deux P1 Collecteurs et le P2 des compteurs Comptoirs. Seuls les deux pages de registre, le service de lecture Collecteurs et leurs tests ont changé. Les formulaires de création/modification, les contrats RPC, les permissions et les migrations restent inchangés.

## Comportement obtenu localement

- Collecteurs distingue l’erreur de lecture de l’absence vérifiée d’un dossier. Une erreur retire les compteurs, la liste et la fiche non confirmés ; le bouton « Réessayer » relance le chargement. Les erreurs d’action sont conservées séparément.
- Comptoirs n’affiche ses compteurs qu’après une lecture réussie. Après une erreur d’actualisation, les anciennes lignes sont retirées et le tableau signale son indisponibilité.
- Les réponses d’un ancien chargement ne peuvent plus remplacer un résultat plus récent après navigation. Les deux pages ignorent aussi les réponses reçues après leur démontage.
- La liste Collecteurs réutilise `readAllPages` sur le même RPC de visibilité. Elle exige le compte exact de chaque page et refuse toute réponse tronquée ou incohérente détectée. Les homonymes sont départagés par UUID via le chemin de la valeur scalaire JSON ; voir `pagination-compatibilite.md` pour la preuve technique et ses limites.
- Le message d’erreur RPC de lecture est traduit par le mécanisme existant de l’application au lieu d’exposer directement le message technique brut.

## Tests et preuves

`avant-reproduction.json` rejoue les sources pré-correction archivées en texte avec la configuration locale `before.vitest.config.mts`, sans remplacer les fichiers applicatifs : **23 échecs et 1 succès sur 24 cas**. Ce nombre comprend des assertions de nouveau contrat et ne représente pas 23 anomalies distinctes. Les cas 1 001 / 1 500 dossiers montrent explicitement une réponse limitée à 1 000, le plafond simulé de 73 tronque la liste à 73, et les listes présentent les faux états vides/zéro. `avant-pages.json` et `avant-service.json` conservent les premières exécutions intermédiaires.

Le rejeu après correction `apres-final.json` obtient **73/73 tests réussis sur 8 fichiers** : 11 scénarios des deux pages, 15 de lecture avec le véritable SDK Supabase et son transport simulé, le contrat RPC existant, le helper de pagination et les tests de formulaires/détails existants. Les deux tests de réponses tardives sont postérieurs au premier rejeu négatif et disposent d’un rejeu pré-correction séparé.

La simulation de transport impose l’URL fictive `collector-fixture.invalid`, le nom exact du RPC, le corps vide, les paramètres de pagination et le tri ; elle ne contacte pas Supabase. Les refus des pages intermédiaires, des totaux absents ou modifiés, des doublons et des pages vides prématurées sont testés. Le double HTTP partagé `rpcClientBinding.test.ts` fournit désormais le vrai contrat d’en-tête `Content-Range` lorsqu’un compte exact est demandé ; ses autres services ne sont pas retirés du périmètre.

Le lint des sept fichiers concernés est réussi. Le typecheck et le manifeste final sont consignés dans `correction-evidence.json` une fois terminés. Aucun test global complet n’a été relancé par cet agent pour ce lot.

## Limites de validation

La recette de la liste Collecteurs sur l’API réelle est coordonnée par root. Tant que sa preuve n’est pas reçue, la validation du tri scalaire demeure locale. Aucune création, modification ou suppression distante n’a été faite pour ces corrections, aucun commit, push ou déploiement par cet agent. L’audit indépendant et la validation interface doivent être rattachés séparément au résultat final.

Le P2 de défense de contrat `COLL-CONTRACT-001` n’est pas entièrement traité ici : la pagination refuse un tableau nul et les ID invalides/doublonnés, mais n’effectue pas une validation exhaustive de tous les champs métier d’un dossier JSON. Ce lot ne prétend pas solder l’ensemble des améliorations possibles du module.
