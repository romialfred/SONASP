# Reprise locale — audit indépendant du 7 septembre 2026

## Périmètre et décision

Audit demandé sur le header partagé (identité, navigation, typographie) et `ART-DASH-002/003`, puis contrôle indépendant des corrections Affiliation et lecture des listes. **Travail local seulement : aucun navigateur partagé, accès distant, migration, commit, push ou déploiement exécuté par cet audit.** Les validations réelles précédentes et le rétablissement SQL des Sites restent des événements historiques distincts ; ils ne valent pas autorisation de nouvelle mutation.

La reprise s'effectue sur `codex/amelioration-integrale`, HEAD observé `04b1826c0cca77e0e221730fd00609979e5724ce`. Le répertoire contient des modifications applicatives en attente, des preuves non suivies et des fichiers du commanditaire. Il ne constitue pas une version de livraison figée. La suppression préexistante de `Bonjour Monsieur SAKO,.txt` et les documents/images du commanditaire ne sont pas traités comme des modifications de ce lot.

**Avis initial : poursuite de l'intégration technique locale possible pour le header et le Dashboard ; recette graphique partielle et aucune recette DB nouvelle. Deux défauts Affiliation indépendants ont été reproduits et transmis pour correction. SITE-CONC-004 reste ouvert, contrat proposé ci-dessous. Aucun score global ni clôture de la mission.**

## Tests rejoués et version

Le runner [run-reprise-locale-20260907.mjs](run-reprise-locale-20260907.mjs) a exécuté **155/155 tests dans 10 fichiers** entre **11:13:53 et 11:16:44 UTC**, sortie 0. Les 28 fichiers d'entrée suivis par ce runner sont stables entre début et fin ; le manifeste [reprise-locale-20260907.evidence.json](reprise-locale-20260907.evidence.json) conserve la commande et les empreintes. Le [journal complet](reprise-locale-20260907-tests.txt) comporte les assertions nommées.

- Header, navigation, shell Mine et tableau de bord national : 100 tests existants rejoués dans sept fichiers.
- Tableau de bord Artisan et rattachement territorial : 55 tests dans trois fichiers, dont les 13 cas indépendants du précédent audit.

Cette addition est celle du run actuel, pas la somme des journaux historiques 85 + 34 + 55 qui se recouvrent. Des avertissements React `act(...)` existent dans les tests du shell Mine ; sortie 0 ne signifie pas journal silencieux. Les services/Auth, cartes et graphiques sont simulés en tout ou partie. Aucun de ces cas n'exécute un parcours navigateur ni une écriture.

Les quatre fichiers ART-DASH sont identiques aux empreintes de [REVUE_ARTISAN_DASHBOARD.md](REVUE_ARTISAN_DASHBOARD.md). Le nouveau run rééprouve les refus explicites de trois sources, absence de faux zéro, reprise, isolation des réponses tardives, filtre par identifiant de site et rattachement aide → exploitant. Les autres indicateurs historiques, l'expiration réelle des cartes et la complétude HTTP ne sont pas homologués par ces tests de composants. Le lot de pagination `LECT-VOL-006` reçoit une revue distincte : sa présence parmi les imports ne remplace pas ses contrôles propres.

## Identité et typographie du header

Diff relu : seuls les administrateurs représentent directement la plateforme ; un organisme autorisé sert l'identité des autres portails. Le logo privé du comptoir passe par le service existant, avec repli sur les armoiries si son chargement échoue. Aucun champ de logo Mine, droit, écriture ou endpoint nouveau n'est inventé dans ces changements. Le lien courant est marqué `aria-current="page"` ; le bouton ouvrant un groupe n'est plus présenté comme la page courante. Les liens d'accueil dupliqués et la recherche du chemin le plus spécifique sont couverts par les tests existants.

Les deux feuilles de style réduisent les titres, sous-titres et espacements, sans modifier les handlers des filtres. Les contrôles CSS seuls ne prouvent pas la fidélité à tous les portails, l'accessibilité complète ou le fonctionnement des dialogues au clavier.

Les README `docs/header-identity-qa` et `docs/header-typography-qa` signalent correctement leur banc Auth/données simulés. Les build IDs locaux historiques sont respectivement `local-mtr1gox3` et `local-mtr218tn`. Les mesures DOM sont utiles mais ne contiennent pas un manifeste liant chaque capture à une empreinte exacte de toutes les sources. Elles ne doivent pas être présentées comme issues du nouveau run 155/155.

### Relecture visuelle bornée

Captures effectivement inspectées : identité 01, 03, 04, 05, 06, 07, 08, 09, 12 ; typographie `apres-1440`, `apres-360`, `menus-mobile-360`, `dates-tablette`.

- Administrateur 1440 : deux logos et badge lisibles ; espacement du header réduit confirmé dans la capture typographie.
- Administrateur 1024 : badge et langue séparés. Mobile 360 : logos présents, texte et indicateurs lisibles ; menu et panneau de date tablette restent dans le viewport représenté.
- Collecteur SONASP 03/04 : logo et identité cohérents ; seul Registre des collectes actif dans 04. Le corps 04 est explicitement un placeholder du banc, pas un registre commercial validé.
- Comptoir 08 : logo de test Alpha présent ; 09 : repli armoiries présent. Dans 09, les indicateurs sont encore en chargement : seule la présentation du header est recevable.
- Mine 07 : identité et armoiries visibles ; corps vide et absence de lien actif ne permettent pas d'attester le tableau de bord Mine.

**HDR-PREUVE-001 — capture 06 non recevable pour DGMG.** `06-dgmg.png` affiche « Portail Finances · DGI » et « Collecte des taxes et impôts ». Le JSON lui attribue pourtant `/portail-dgmg`, « Mines · DGMG » et le lien « Vue d'ensemble ». Le nom de fichier et la mesure ne correspondent donc pas aux pixels. Il faut une nouvelle capture stabilisée, sans remplacer silencieusement l'historique. Aucun défaut applicatif DGMG n'est déduit de cette discordance.

**HDR-PREUVE-002 — capture 05 limitée à l'identité.** `05-finances-dgi.png` affiche l'identité DGI mais conserve le placeholder `/collecte/ventes`, sans lien courant ; le JSON indique `/portail-dgi` et Tableau de bord courant. Elle ne prouve pas cette navigation. Ces deux constats ont été transmis au coordinateur pour reprise des preuves au prochain contrôle intégré.

Les captures non inspectées, les autres portails, zoom 200 %, contraste calculé et navigation clavier complète restent non vérifiés. Aucun nouveau navigateur n'a été ouvert par l'auditeur.

## Affiliation : première reproduction indépendante

Le banc [affiliation-reprise-independent.test.tsx](affiliation-reprise-independent.test.tsx) a ajouté trois scénarios de réponses différées. Sur le premier candidat, le [journal rouge](affiliation-reprise-independent-before.txt) donne **2 échecs / 1 réussite** à 11:16:41 UTC :

| Identifiant | Constat reproductible | Effet |
|---|---|---|
| AFF-SCOPE-007 | Changement d'utilisateur et d'organisme conservant l'artisan et les capacités ; wrapper indexé seulement par artisan | Ancienne carte et anciennes finances conservées, sans nouvelle lecture |
| AFF-RACE-008 | Changement de `initialCardId` pendant une relecture des droits encore pendante | Ancien résultat invalidé mais droits de la nouvelle émission jamais chargés ; écran bloqué sur Chargement des droits |
| AFF-REL-009 | Nouveau `dues_card_id` après actualisation, réponse de droits retardée | Réussite sur ce cas précis : la nouvelle relation est finalement présentée |

Le composant rouge relu porte SHA256 `7538f5f0d59c01e2706e441fbf8234f9cb1b06a43fa946a5112fd9bfbb52b31e`. Ces empreintes ont été relevées après le run, pas par un manifeste avant/après ; le journal conserve les cas et traces. Le coordinateur a engagé leur correction. **Un succès annoncé ensuite par l'implémenteur ne sera pas hérité : relecture et nouveau run indépendant attendus.** Les doubles d'Auth/services/cartes/paiements ne valident aucun paiement, activation ou document réel.

## SITE-CONC-004 — contrat proposé, non implémenté

Constat statique confirmé dans `artisanalSiteService.saveSite`, `ArtisanalSiteForm` et la migration `20260906093115_sites_artisanaux_formalisation_aea.sql` : `snp_save_artisanal_site(p_site,p_assignments)` effectue un UPSERT complet du site et de ses deux responsables, sans version attendue. Le modèle expose déjà `updatedAt`, mais la sauvegarde ne le transmet pas. Deux ouvertures du même dossier peuvent écraser les changements de l'autre sans avertissement. L'atomicité parent/enfants actuelle ne prévient pas cette perte.

Contrat minimal à arrêter avant une future migration autorisée :

1. Distinguer création et modification. La modification exige une version serveur attendue issue de la dernière lecture ; ne pas fabriquer un timestamp côté navigateur ni convertir une valeur de précision SQL via `Date`. Une version entière de dossier est plus explicite si tous les chemins d'écriture peuvent être couverts.
2. Verrouiller le site puis comparer la version avant tout changement, y compris les affectations. Sur conflit, réponse typée et intelligible ; aucune ligne du dossier modifiée. Le formulaire conserve le brouillon et propose de recharger/comparer, sans réessayer automatiquement la mutation.
3. Couvrir les écritures des responsables et photos : les triggers observés horodatent chaque table séparément. Un contrôle sur le seul `artisanal_sites.updated_at` ne détecterait pas nécessairement une modification directe d'affectation. Inventorier tous les writers ; définir une version de dossier commune ou un contrat portant aussi les versions enfants, sans relâcher les RLS/grants existants.
4. Fermer le contournement par l'ancienne signature. Ajouter un RPC versionné tout en laissant l'ancien UPSERT accepter des éditions sans jeton ne suffit pas. La compatibilité des clients existants et le refus explicite des anciennes éditions doivent être prévus dans le plan de promotion, pas cachés derrière un défaut optionnel.
5. Préserver les IDs des responsables, les références externes et l'AEA historique. Sur conflit après upload, retirer seulement le fichier candidat non référencé ; conserver tout document rattaché si la réponse réseau est perdue. Prévoir un identifiant de création/réessai stable pour empêcher un doublon après réponse ambiguë.
6. Preuves attendues : deux lecteurs même version ; A sauve ; B refuse sans altérer A/site/responsables/photos ; rechargement de B puis sauvegarde possible ; conflit sur contact seul ; rollback complet si enfant invalide ; refus d'un autre périmètre/MFA absente selon les droits existants ; reprise réseau sans doublon. Ces tests peuvent d'abord être locaux ; aucune preuve d'exécution SQL distante n'est acquise ici.

Ce contrat est une proposition à l'implémenteur, pas une migration ni une annonce de correction.

## Résultat consolidé après corrections locales

Les runs ci-dessous sont réexécutés par l'auditeur avec empreintes avant/après stables. **Leurs nombres se recouvrent : ne pas les additionner pour annoncer un nombre de tests distincts ou une couverture globale.** Les sources et commandes sont consignées par [run-lots-locaux-20260907.mjs](run-lots-locaux-20260907.mjs).

| Lot | Résultat technique indépendant | Horaire UTC / preuve | Limite principale |
|---|---|---|---|
| Header et ART-DASH | 155/155, dix fichiers | 11:13:53–11:16:44 ; `reprise-locale-20260907.evidence.json` | Captures historiques distinctes, preuve DGMG rejetée |
| LECT-VOL-006 initial | 135/135, sept fichiers | `volume-local-20260907-initial.evidence.json` | Antérieur à l'extension Cartes ; conservé comme historique |
| LECT-VOL-006 final, Cartes incluses | 159/159, huit fichiers | 11:33:19–11:34:16 ; `volume-local-20260907.evidence.json` | Transport/Auth simulés, pas de snapshot entre requêtes HTTP |
| AFF-ACK-005 et portée | 33/33, trois fichiers dont trois cas indépendants | 11:36:46–11:37:17 ; `affiliation-local-20260907.evidence.json` | Aucun paiement ou activation réel |
| SITE-DOC-007 et portée du détail | 46/46, cinq fichiers dont deux cas indépendants | 11:38:04–11:38:41 ; `photos-local-20260907.evidence.json` | Aucun dépôt/lecture/suppression Storage réel |

### Lectures complètes

Relecture de `readAllPages`, des trois services initialement confiés et de `carteProfessionnelleService.getAllCartes`, extension ensuite autorisée par le coordinateur. Cette dernière source du Dashboard était restée sans pagination ; le constat a été remonté avant le gel, puis couvert par la correction et le run final. Les filtres statut serveur et type/mine historiques restent appliqués selon leur contrat antérieur. Le tri conserve la clé métier puis l'identifiant unique. Un plafond inférieur à la tranche demandée avance du nombre reçu, une erreur de page ne publie pas les premières pages comme résultat complet.

Les tests incluent les frontières 0/1/499/500/501/999/1000/1001/1500, plafonds réduits, erreur tardive, total absent/invalide/changeant, doublon, conservation des relations et des filtres. Le véritable client Supabase installé est utilisé dans un cas avec `fetch` entièrement remplacé et domaine `.invalid`. Aucun réseau réel n'est exercé. Pas de nouveau défaut confirmé dans les méthodes corrigées.

Le total exact recalculé par tranche et la conservation intégrale en mémoire nécessitent une mesure de charge réelle. Une suppression et une insertion compensées à total constant peuvent échapper à la détection : le helper ne prétend pas produire un snapshot transactionnel. Les autres méthodes, notamment statistiques et historiques des affiliations, restent à qualifier séparément. L'ancien banc `docs/affiliation-qa/workflow-supabase.ts` n'implémente pas le nouveau contrat `count/range` : son utilisation exige adaptation ou exclusion explicite, sans assouplir le service applicatif pour obtenir un succès fixture.

### Affiliations

`AFF-SCOPE-007` et `AFF-RACE-008` sont **corrigés et vérifiés techniquement** par le nouveau run. Le wrapper est désormais indexé par artisan, émission demandée et contexte utilisateur complet ; les anciennes lectures sont démontées. Les champs de contexte suivent le même principe que les fiches Artisan/Site. Une actualisation échouée n'annonce pas un succès ; après mutation confirmée et relecture échouée, le message invite à actualiser sans répéter l'opération. La saisie paiement peut se fermer après confirmation de la mutation même si la relecture a échoué. Les droits non vérifiés n'autorisent pas une génération/activation.

Le nouveau run couvre de nouveau une sélection d'émission pendant une relecture lente ainsi que le changement de `dues_card_id`. La [revue dédiée](REVUE_AFFILIATION_REPRISE_LOCALE.md) précise les versions et réserves. Ces états DOM ne démontrent pas une transaction réelle, le contrôle d'un justificatif, le processus MFA ou l'émission d'une vraie carte.

### Photos et détail du site

Le service refuse désormais un échec Storage au lieu de retourner une nouvelle data URL comme si le dépôt avait réussi. Les formats historiques restent lisibles. Les réussites partielles d'un lot sont conservées ; l'échec individuel doit être repris ou retiré avant sauvegarde. Une erreur de signature ou de chargement d'image reste visible dans sa propre vignette, avec reprise indépendante.

L'audit a reproduit **SITE-SCOPE-010** sur la source `ArtisanalSiteDetails.tsx` SHA256 `64960f353f9ec9e8deb3fc8c8389a691a32cd89b234c226cd42e41b24faeef07` : un changement d'organisme/rôle d'accès conservant la route laissait l'ancien titre/dossier en mémoire. Le changement de clé de la miniature ne réinitialisait pas le vrai hook. Journal rouge : `site-photos-reprise-independent-before.txt`, un cas en échec à 11:31:33 UTC.

Le composant Details a ensuite reçu une frontière de contexte complète englobant le hook, les onglets et les URL AEA/photos, sans modifier le hook partagé. Les deux cas indépendants du run 46/46 confirment le masque immédiat et l'ignorance d'une réponse tardive de l'ancien périmètre. SITE-SCOPE-010 est **corrigé et vérifié techniquement**.

La compensation ne vise que les dépôts nouveaux jamais soumis à `saveSite`. Après résultat réseau ambigu, une référence possiblement rattachée n'est pas supprimée. Au démontage/fermeture forcée, le nettoyage reste une tentative client : aucune garantie d'absence absolue d'orphelin n'est démontrée. Les deux responsables, la formalisation et les AEA restent dans les tests de zone, mais la sauvegarde réelle et le contrôle SQL de la colonne photos n'ont pas été exécutés dans cette reprise.

## Avis à la remise des preuves locales

Les tests indépendants ajoutés sont figés après les runs 33/33 et 46/46. Aucune modification de `src`, aucun accès DB/navigateur, commit, push ou déploiement n'a été effectué par l'auditeur. Pas de défaut supplémentaire confirmé dans les lots techniques corrigés et rejoués ci-dessus.

Restent ouverts : nouvelle capture DGMG et correspondance DGI navigation/pixels, contrôle visuel intégré des nouvelles affiliations/photos, vraie recette Auth/API/Storage/base, concurrence SITE-CONC-004, autres formulaires/portails et portes globales TypeScript/build/tests coordonnées séparément. **Avis favorable à la poursuite de l'intégration locale, pas à une clôture, homologation ou promotion distante.**
