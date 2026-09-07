# Reprise locale — audit des deux échecs de la suite globale

7 septembre 2026. Audit indépendant en lecture du code et exécution locale ciblée. Aucun navigateur, Supabase, commit ou déploiement par l'auditeur.

## Suite conservée en échec

Le reçu `reprise-locale-suite.json` annonce **2 836 succès sur 2 838 tests, deux échecs**. Son début horodaté est `2026-09-07T11:32:57.588Z`. Il n'est ni remplacé ni réécrit par les reprises ciblées.

| Fichier | Exécution globale | Défaut observé |
|---|---|---|
| `src/services/sensitiveUploadInventory.test.ts` | 11:42:36.799–817Z ; 14 succès, 1 échec | Le scan trouve deux surfaces de suppression directe Storage, mais l'inventaire n'en déclare qu'une. |
| `docs/amelioration/audit/site-photos-reprise-independent.test.tsx` | 11:33:05.674–11:33:06.681Z ; un seul cas, en échec | Après changement d'organisation/rôle sans navigation, le titre SITE CONFIDENTIEL A reste affiché. |

### Inventaire Storage

Le delta fonctionnel `removeUnattachedSitePhoto()` dans `sitePhotoService.ts` utilise directement `supabase.storage.from(BUCKET).remove([reference])`. L'entrée historique du service dans `docs/audits/sensitive-upload-surfaces-2i.json` indique encore `directClientDelete=false` ; le test détecte correctement cette incohérence. Le bucket est privé, mais cet accès reste une suppression directe : privé ne signifie pas passage par la passerelle de fichiers sensibles.

Correction recevable : déclarer cette surface résiduelle, son appelant Formulaire Site et sa limitation à la compensation des nouveaux objets. Ne pas exclure le service du scan, changer l'expression régulière pour l'ignorer ou classer cette voie comme remédiée. Ce contrôle recense le code ; il n'établit pas, à lui seul, les permissions effectives de suppression Storage.

### Portée du détail Site

L'échec correspond exactement à SITE-SCOPE-010 reproduit indépendamment avant le correctif. Le reçu global a exécuté l'ancienne version à un cas. Le correctif place la fiche complète, y compris le vrai hook, sous une frontière React indexée par le contexte. Le test final contient deux cas : masque immédiat de l'ancien dossier et rejet d'une réponse tardive de l'ancien périmètre.

Un premier contrôle indépendant après correction existe déjà : `photos-local-20260907.evidence.json`, **46/46 dans cinq fichiers**, 11:38:04.539–11:38:41.205Z, empreintes avant/après identiques. Le nouveau contrôle des deux fichiers est néanmoins attendu après gel de l'inventaire. La présence d'un résultat global antérieur rouge n'est pas masquée par un succès plus récent.

## Reprise ciblée

Runner : `run-global-failures-recheck.mjs`. Il exécute uniquement les deux fichiers signalés, conserve un rapport JSON et un journal séparés, hache avant/après les sources parcourues par l'inventaire ainsi que les entrées ciblées. Il ne transforme pas le global initial en global vert et n'exclut aucun de ses cas.

**Rejeu effectué après gel : 17/17, exit0, 12:20:13.357–12:20:24.207Z.** Les 15 cas de l'inventaire et les deux cas indépendants de portée passent. Empreintes avant/après stables, y compris agrégat des sources parcourues par le scan. Commit observé au début/à la fin : `8016b69863f85b701eb30b0ef13647a169b6d74f`. Preuves : `global-failures-recheck-20260907.json`, `.txt`, `.evidence.json`.

L'inventaire déclare désormais `directClientDelete=true` pour le service photos, ses appelants Formulaire/Preview et la compensation limitée aux nouvelles références jamais soumises à sauvegarde. Il demeure dans les surfaces résiduelles, sans modifier le test de scan. Le Preview est un appelant de lecture ; il n'exécute pas lui-même la suppression.

## Conversion locale du JPEG et CSP

Le dernier delta de `uploadSitePhoto` remplace `fetch(dataUrl).blob()` par validation du préfixe JPEG base64, décodage `atob`, transfert des octets dans un `Uint8Array` et création d'un `Blob` de type `image/jpeg`. La fonction dépose le contenu compressé du canvas, pas le fichier original. Aucun assouplissement de `connect-src`, aucune nouvelle URL publique ni modification de RLS n'est ajouté. Une conversion invalide lève une erreur avant dépôt.

Le contrôle du service a été rejoué séparément : **18/18, exit0, empreintes avant/après stables**, preuves `photo-conversion-csp-independent-20260907.json`, `.txt`, `.evidence.json`. Le cas nouveau rend `fetch` indisponible, vérifie son absence d'appel et relit le contenu du Blob envoyé au double Storage. Le cas de base64 invalide confirme l'absence d'upload ; les scénarios d'échec Storage et de conservation des historiques restent présents.

Ces tests utilisent jsdom, un canvas/Image simulé et un double Storage. Ils démontrent le comportement du service dans ce banc, pas l'application d'une CSP navigateur réelle ni un dépôt distant. Le retour réseau réel et le rendu du fichier sont à vérifier dans leur parcours distinct. **Ces 18 cas recouvrent le lot photos ; ne pas additionner les résultats ciblés pour fabriquer une couverture globale.**

Avis technique : les deux échecs signalés sont levés sur les entrées ciblées figées. Le résultat global historique reste rouge et aucun succès global, UI/DB ou déploiement n'est déduit de ce rejeu.

## Rectification documentaire des captures

Les deux anciennes captures ont été relues visuellement. Le README identité et le README typographie retirent la portée de validation DGMG. Dans `header-identity-qa/verification-interface.json`, leurs anciennes mesures sont conservées dans `rejectedChecks` avec les raisons, et les observations réellement visibles sont séparées dans `captureAudit`. Elles ne font plus partie des onze autres enregistrements DOM historiques ; ces onze autres enregistrements ne sont pas pour autant tous déclarés validés par cette rectification.

- `05-finances-dgi.png` : header DGI ; placeholder « Navigation de vérification », texte `/collecte/ventes`, aucun lien surligné. Header uniquement, pas de preuve de la route `/portail-dgi` déclarée.
- `06-dgmg.png` : header DGI ; « Collecte des taxes et impôts », Tableau de bord surligné. **Non recevable pour DGMG.**

Images inchangées, SHA256 avant/après :

| Image | SHA256 |
|---|---|
| 05-finances-dgi.png | `df1a1ed48c1b1c761a22a082b89d41f85b0f2eee5b8fcb403b31f17584c49b21` |
| 06-dgmg.png | `cef9020cbae53e53f363306641e2d7983422380e726e83916d3ba67ee2acd932` |

Aucune nouvelle capture DGMG ni mesure navigateur n'a été produite par cet audit documentaire.
