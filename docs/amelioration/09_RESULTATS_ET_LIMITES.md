# État factuel de la mission — 7 septembre 2026

**Mission inachevée. Aucun formulaire VALIDÉ. Aucune promotion ni mise en production de ce lot.** Les résultats ci-dessous sont des preuves techniques locales ou de présentation, avec leurs limites. La condition de recette intégrée du prompt maître n’est pas satisfaite.

## Périmètre et couverture réelle

| Objet inventorié | Nombre observé | Recette réelle validée | État restant |
|---|---:|---:|---|
| Types de compte authentifiés | 13 | 0 | Non exécutée dans leurs sessions réelles |
| Identités graphiques | 12 | 0 | Présentation Clients inspectée en contexte SONASP fixture seulement |
| Identifiants de portail dans 01 | 14, dont POR-public technique | 0 | Ne pas compter le regroupement public comme un acteur institutionnel supplémentaire |
| Modules canoniques | 21 | 0 | 30 codes de regroupement dans l’inventaire, qualification à poursuivre |
| Couples portail/module candidats | 139 | 0 | Ni menus ni politiques frontend ne prouvent l’accès serveur |
| Détections écran/action de 02 | 2 146 | 0 | 2 146 scénarios génériques NON EXÉCUTÉS dans 05 |
| Scénarios détaillés du pilote Clients | 12 | 0 | BLOQUÉS par l’absence de backend isolé et comptes Auth/MFA |

Les détections comprennent 1 455 actions JSX, 148 tableaux, 44 routes de formulaire, 53 balises de formulaire, 23 composants de formulaire, 19 sous-formulaires de pièce jointe, 29 routes de détail, 18 composants de détail, 2 composants de liste, 77 occurrences de modales et 17 composants de modale. **Ces catégories se recouvrent.** Elles ne donnent pas un nombre de formulaires métier distincts, de champs ou de critères atomiques homologués. Le reste regroupe notamment pages à qualifier, dashboards/sections, menus, redirections et frontières de routage. Aucun dénominateur n’est réduit pour obtenir un taux favorable.

La matrice 03 couvre les 18 champs saisis du pilote et leurs variantes/relations/lectures, soit 50 lignes. La qualification Artisanat et sa cartographie complémentaire sont dans [le dossier du lot](lot-artisanat/README.md). Son mapping contient 177 lignes, dont 150 contrôles logiques saisis/fichiers/revue, 1 pays imposé et 26 métadonnées/dérivés. Ces unités ne sont pas des formulaires ni des critères de recette distincts. Les 20 omissions de restitution détectées restent des constats statiques, non des corrections. Le mapping exhaustif de tous les modules reste à terminer ; ces documents ne sont pas présentés comme une couverture intégrale.

## Corrections implémentées et parcours effectivement vérifiés

| Lot | Changement candidat | Exigence / preuve / limite |
|---|---|---|
| Clients — saisie et sauvegarde | Crédit zéro conservé ; banque libre utilisable ; objets bancaires non mutés ; erreurs de lecture bloquantes ; sauvegarde parent/banques atomique, IDs et références historiques conservés ; double clic et réponses obsolètes gardés | Prompt maître intégrité/persistance ; tests composants et SQL. Aucune écriture via UI vers une base réelle |
| Clients — liste/détail | Données et transactions fictives retirées ; agrégats tirés des ventes autorisées et de leur devise ; erreurs distinctes des zéros ; champs et banques lisibles ; liens opérationnels existants ; contexte de filtre au retour | Présentation via composants réels et fixtures signalées ; liens et services testés avec doubles |
| Clients — présentation | Compteurs entre parenthèses ; volets et actions responsive ; montants mobiles intégraux ; libellés des pays français sans modification des valeurs API | 15 captures finales auditées ; captures de viewport/sections, pas des pages entières ; zoom 200 % non exécuté |
| Artisan — détail seulement | Erreurs ventes/infractions distinctes, reprise indépendante ; identité consultable ; ancien contexte masqué et réponses tardives ignorées ; changement vers Collecteur sans panneau interdit/vide | 38 tests composants, dont 6 indépendants. Formulaire Artisan, écritures, workflows et permissions non modifiés |
| Infrastructure des tests | Archives `backups/**` exclues de la découverte après comparaison de leurs 31 copies avec les 31 sources canoniques identiques | Aucun test applicatif supprimé ; import cassé de l’archive documenté ; déduplication distincte du périmètre métier |

Les aller-retour de l’audit ont effectivement produit des corrections supplémentaires : compatibilité NULL du RPC, contextes asynchrones, précision des montants, erreurs bancaires locales, pays historiques, compteur d’onglet, troncature mobile et détail Artisan. Les versions et retests sont conservés dans les revues ; aucun de ces cycles ne vaut recette intégrée.

## Résultats des contrôles techniques

| Contrôle | Résultat observé | Preuve |
|---|---|---|
| Suite globale Vitest après déduplication | **2 634 tests, 354 fichiers, aucun échec**, code 0 | `audit/decouverte-tests-vitest.json` et `.log` ; comparaison des cas dans le rapport de découverte |
| Clients, dernier audit ciblé | **46/46**, dont 14 tests indépendants ; 22 empreintes stables | `audit/frontend-independent.evidence.json`, `audit/REVUE_FRONTEND_CLIENTS.md` |
| Détail Artisan, audit indépendant | **38/38**, dont 6 tests indépendants ; empreintes stables | `audit/REVUE_ARTISAN_DETAILS.md` et preuve associée |
| Backend Clients | **32 tests Node réussis** dans PGlite, comprenant tests de l’implémenteur et de l’auditeur | `audit/REVUE_BACKEND_CLIENTS.md` ; ce banc SQL ne constitue pas Supabase Auth/API/MFA réel |
| Registre métier existant | `npm run test:registry` passé sur l’itération précédente du lot, incluant ses scripts/migrations et 223 assertions Vitest | `audit/test-registry.txt` ; ne pas le confondre avec la suite globale finale |
| TypeScript et couverture des types DB | Réussis sur les dernières sources | `audit/typecheck-final.txt` |
| Lint ciblé et interface française | Réussis ; contrôle supplémentaire du dernier delta Client | `audit/lint-final.txt`, `audit/lint-profile-delta-final.evidence.json` (commande, date et code du lint silencieux) |
| Build | Réussi ; sortie séparée `node_modules/.cache/amelioration-build`, identifiant local `local-mtquz336` | `audit/build-final.txt` ; le dossier `dist` servi sur 5180 n’est pas remplacé |
| Audit de présentation | **15 JPEG** vérifiés, dimensions et empreintes concordantes | `audit/REVUE_VISUELLE_CLIENTS.md`, `preuves/presentation-clients/manifest-complement-iab.json` |

**Réserve de version de la suite globale :** une ligne de `CustomerProfile.tsx`, le test indépendant qui la couvre et son runner ont changé pendant cette exécution. Il serait incorrect d’annoncer une empreinte globale figée. La correction limite la traduction au champ Pays ; elle préserve les autres valeurs et NULL. La dernière version a ensuite reçu l’audit ciblé 46/46, le typecheck et le build. Le rapport de découverte identifie précisément le delta, les 1 485 fichiers comparés, les cas anciens conservés et le renommage du test qui attendait auparavant un faux zéro. Les anciens runs contenant une suite d’import en échec ou volontairement interrompus sont conservés comme tels.

## Preuves d’enregistrement et accès

**Aucun identifiant de dossier réellement créé pour cette recette.** Les identifiants `ca…` et références visibles sur les captures appartiennent au banc fixture ; ils ne sont pas des preuves d’enregistrement métier. Aucun nettoyage de données réelles n’a été exécuté. La chaîne UI → API réelle → base → détail → rechargement → liste → édition → nettoyage reste non exécutée.

La matrice 04 comprend 12 090 évaluations de fonctions de droits dans des contextes synthétiques ; elles ne prouvent ni RLS ni MFA ni confidentialité entre organisations réelles. Les portails et parcours transverses restent à tester avec leurs comptes dédiés. Aucune capture de présentation ne remplace ces accès.

## Blocages, anomalies ouvertes et déploiement

La configuration `.env` locale cible la production. L’API Docker locale n’a pas répondu et aucun ensemble isolé Auth/MFA/API/base/Storage n’est attesté. Les accès de préproduction et comptes par portail ont été demandés par le canal de clarification, sans réponse disponible à cette rédaction. Les identifiants secrets doivent être configurés dans l’environnement sécurisé, jamais copiés dans le rapport ou le chat.

Les anomalies restantes restent ouvertes dans 06 et [l’annexe Artisanat](lot-artisanat/README.md), notamment lecture des tableaux de bord, filtre localité, conflit d’édition site, confirmation/relecture affiliation, pagination de services et dépôt/lecture de photos. La cartographie révèle aussi des champs saisis absents de certains détails. Leur présence dans ce rapport ne constitue ni correction ni validation. Les autres modules restent à qualifier, corriger, exécuter et auditer.

**Aucune note 100/100, aucune homologation, aucun déploiement de ce lot.** Le pilote n’a pas rempli sa condition de sortie intégrée. La branche de travail locale est `codex/amelioration-integrale`, basée sur `83f8c74e`. La migration additive Clients n’a été appliquée à aucune base distante. Le plan de promotion/retour arrière est dans 08 ; ni restauration ni rollback réels ne sont déclarés testés.

La sécurité approfondie demeure un chantier séparé. Cela ne dispense pas de vérifier dès cette recette les protections existantes Auth/MFA, droits serveur, périmètres d’organisation et pièces privées. Aucun taux mathématique de sécurité n’est annoncé.

La prochaine condition concrète est de disposer d’un environnement isolé complet et de ses comptes de test, puis d’appliquer le protocole du pilote avant de dérouler l’ensemble des lots inventoriés. Il ne manque pas une nouvelle autorisation d’écrire : il manque la cible de recette et ses accès effectifs.

Commit applicatif local de cette itération : `07ffc71ab9e1320df845694736a3f5af88141431` sur `codex/amelioration-integrale`. Les documents et preuves sont versionnés séparément. Aucun push ni déploiement.
