# Cartographie bornée des quatre formulaires

`MAPPING_CHAMPS.csv` contient **177 lignes documentaires à contrôler** : 150 contrôles logiques de saisie, de fichiers ou de revue, un pays de comptoir imposé, et 26 lignes de métadonnées/dérivés. Ces lignes ne représentent ni 177 champs simultanément visibles ni un inventaire exhaustif de toute la plateforme. Toutes portent `A_CONTROLER — correspondance statique relue ; UI_API_BASE_NON_EXECUTE` et référencent la candidate locale `07ffc71a` ; aucune n'est déclarée validée.

| Formulaire | Contrôles saisis/fichiers/actions de revue | Valeurs imposées | Métadonnées/dérivés | Couverture inspectée |
|---|---:|---:|---:|---|
| Site | 25 | — | 7 | Identification, formalisation/AEA, localisation/GPS, exploitation, deux responsables, photos, observations |
| Artisan | 62 | — | 8 | Branches physique/morale, responsable, rattachement exploitant/site, documents par propriétaire, photo physique, moyens de paiement et motif de revue |
| Collecteur | 24 | — | 6 | Identité physique, coordonnées, sites multiples, organisme unique, pièces/photo, observations |
| Comptoir | 39 | 1 | 5 | 32 valeurs saisissables, sept types de documents ; pays BF fixé |

Chaque ligne donne le champ, la branche, le contrôle existant quand identifiable, la condition de saisie, le payload, le service/RPC, la table/colonne ou clé JSON, la restitution et ses sources. Les identifiants DOM absents ne sont pas inventés : la matrice distingue les labels englobants et les ComboBox à identifiants générés. Les relations et transformations sont explicites, notamment responsable de société, site hérité de l'exploitant, rattachements collecteur historisés, fichiers privés et JSON du comptoir.

Les métadonnées sont séparées par `nature=METADONNEE_OU_DERIVE`. Certaines lignes de métadonnées regroupent les attributs techniques d'un fichier ; elles ne prétendent pas compter chaque colonne du schéma. Les quatre fichiers d'entrée et leurs sous-composants ont été lus ; les contrôles générés dans des boucles sont comptés une fois par champ logique/variante, pas une fois par donnée existante.

## Contrôles de couverture effectués

- Les 34 clés déclarées dans `EMPTY_ARTISAN_FORM` sont rapprochées : 31 clés de saisie principale, deux URL techniques historiques et l'objet `responsable`. Ses 13 champs sont cartographiés séparément.
- Les 33 clés du comptoir sont rapprochées : 32 saisissables et `country=BF` imposé. Les champs nécessaires à la **complétude** ne sont pas présentés comme tous bloquants pour l'enregistrement : le code permet un dossier incomplet, avec nom/type/ville requis et contrôle des valeurs présentes.
- Les 25 contrôles du site et 24 du collecteur sont issus de la lecture des sections réellement rendues. Aucun dénominateur global des contrôles de tous les portails n'est déduit de ces nombres.
- Le générateur échoue si une ancre de source manque, si une clé déclarée Artisan/responsable/Comptoir n'est pas rapprochée ou si un identifiant de ligne est dupliqué. Les 177 lignes passent ces contrôles.
- `MAPPING_CHAMPS.manifest.json` conserve les empreintes SHA256 des sources candidates, leurs blobs Git à la baseline `83f8c74e` et la comparaison textuelle ignorant uniquement les fins de ligne. Une référence baseline précise n'est affirmée identique que lorsque cette comparaison réussit.

## Omissions de restitution confirmées

**Collecteur — 12 lignes de saisie sans restitution dans le détail principal.** Le formulaire transmet la date et le lieu de naissance, le sexe, la nationalité, le type/numéro de pièce, ses dates de délivrance/expiration et son lieu de délivrance, ainsi que les observations. `CollectorDetails` présente l'identité résumée et les coordonnées/rattachements mais aucun de ces dix champs. Il ne charge pas non plus les justificatifs ou la photo réelle déposés dans le formulaire ; les deux contrôles de fichiers constituent les deux autres lignes. Les pièces restent consultables depuis l'édition. Sources principales : `CollectorForm.tsx:385–692`, `collectorDossier.ts:87`, `CollectorDetails.tsx:356–509`.

**Artisan — bloc de moyens de paiement absent du détail principal.** Les sept coordonnées/options de moyen (type, titulaire, téléphone, banque, compte, SWIFT, principal) et le motif de revue sont gérés dans `ArtisanMinierForm`. Aucun bloc correspondant n'est rendu par `ArtisanDossierSummary` ou `ArtisanMinierDetails`. Il s'agit de huit lignes de correspondance, pas de huit anomalies métier indépendantes. Leur éventuelle restitution doit respecter l'habilitation et le masquage des coordonnées : la matrice ne propose aucune exposition nouvelle. Sources : `ArtisanMinierForm.tsx:643–888`, `artisanMoyenPaiementService.ts:65–95`, `:221–232`, `ArtisanDossierSummary.tsx:34–256`.

La nationalité de l'Artisan est bien affichée dans `ArtisanDossierSummary.tsx:126`. Un signal intermédiaire l'avait mentionnée à tort ; il a été retiré après relecture complète et n'apparaît pas parmi les omissions. Les booléens « WhatsApp identique » restituent un numéro dérivé ; leur absence en tant que case dans la lecture n'est pas un défaut ajouté.

Pour Site et Comptoir, aucun autre champ de saisie principal non restitué n'a été confirmé dans ce périmètre. Cette observation n'atteste ni les erreurs de chargement, ni les permissions effectives, ni la fidélité visuelle. Le risque documentaire du site signalé précédemment dans `SITE-DOC-007` reste ouvert.

## Ce qui n'est pas validé

Aucun code, test, schéma ou matrice générale n'a été modifié pour produire cette cartographie. Aucun formulaire n'a été exécuté dans un navigateur ni enregistré/relu/supprimé en base pendant ce sous-lot. Les migrations citées sont celles du dépôt ; leur application et leur comportement Auth/RLS en préproduction ne sont pas attestés ici. Les parcours Affiliations, ventes, règlements, infractions et portails secondaires restent dans l'inventaire général mais ne sont pas intégralement cartographiés champ par champ dans ce fichier.

Le défaut ART-LECT-001 possède un audit de composant distinct : `docs/amelioration/audit/REVUE_ARTISAN_DETAILS.md` et ses preuves. Ce résultat ne transforme aucune ligne de ce mapping en validation navigateur/base.
