# Audit qualité indépendant — amélioration intégrale FASO SANAMA

## Décision initiale du 7 septembre 2026

**Recette globale : NON PRONONCÉE. Déploiement de cette mission : NON ADMISSIBLE à ce stade.** L’inventaire exhaustif et son dénominateur ne sont pas encore figés. Aucune note globale, aucun pourcentage de couverture fonctionnelle et aucun formulaire VALIDÉ ne sont attribués par cet audit initial.

Version de départ examinée : `83f8c74e` ; branche de travail partagée : `codex/amelioration-integrale`. Le commit applicatif antérieur est `8e801ed0` ; les preuves de la précédente mission concernent essentiellement le shell et les tableaux de bord dans un banc à transports simulés. Elles ne valent pas recette intégrale de la version candidate.

Responsable indépendant : agent `audit_independant`. L’agent ne modifie ni l’implémentation, ni la base, ni les permissions ; il n’effectue ni commit, ni push, ni déploiement. Les tests navigateur et relectures de persistance sont à coordonner avec l’orchestrateur pour éviter toute collision de sessions. Le protocole n’autorise aucune écriture en production.

Sources : [prompt maître](../../amelioration%20labs/Prompt_Maitre_Codex_Amelioration_Integrale_FASO_SANAMA.md), sections 2–21 et annexe A ; [CLAUDE.md](../../CLAUDE.md). La compétence `senior-qa` sert à organiser les cas et preuves ; elle ne remplace pas le barème demandé par le commanditaire.

## Barème et méthode de calcul

| Domaine | Poids | Identifiant |
|---|---:|---|
| Fonctionnement réel | 30 | FONC |
| Données et persistance | 20 | DATA |
| Design et ergonomie | 20 | UX |
| Portails et accès fonctionnels | 15 | ACCES |
| Régression et qualité technique | 10 | TECH |
| Préparation à l’exploitation | 5 | OPS |

Pour un périmètre **figé et versionné**, le résultat d’un domaine est `poids × critères RÉUSSIS et acceptés par l’audit / critères applicables`. Un critère ÉCHOUÉ, BLOQUÉ ou NON EXÉCUTÉ reste au dénominateur et apporte zéro réussite. Une exclusion NON APPLICABLE JUSTIFIÉ exige la preuve de l’absence réelle de la fonction, une décision datée de l’auditeur et une trace de changement de périmètre. L’absence d’environnement, de compte ou de preuve n’est jamais une exclusion.

Le calcul utilise les fractions exactes ; aucune approximation favorable n’est autorisée. La clôture exige que le nombre de critères réussis égale le nombre applicable **dans chaque domaine**, chaque lot, chaque portail et les parcours transverses. Une moyenne entre portails ou des milliers de tests unitaires ne compensent pas un formulaire non exécuté. Si un domaine d’un lot n’a réellement aucun critère, sa gestion doit être arrêtée avant recette ; aucun point ne lui est attribué automatiquement.

Les critères [du pilote](audit/CRITERES_PILOTE_CLIENTS.csv) sont un catalogue initial de 94 lignes à instancier par contexte autorisé, écran, dimension et variante de formulaire après la cartographie. Ils ne constituent pas encore le dénominateur global ni le dénominateur figé du pilote. Une ligne qui énumère des dimensions ou les écrans ALL doit produire des instances distinctes pour chaque dimension/écran applicable avant le gel. Chaque champ de la matrice 03 doit posséder son assertion individuelle ; aucun critère « tous les champs semblent bons » ne remplace cette traçabilité.

Le taux de couverture fonctionnelle sera calculé **séparément** : entités de l’inventaire validées / total des entités applicables, ventilé par portails, modules, écrans, formulaires et actions. Il reste non calculé tant que cette base n’est pas figée. La recette 100/100 n’est ni une certification de sécurité ni une homologation gouvernementale.

## Critères éliminatoires exacts du prompt, section 17

Les libellés ci-dessous sont reproduits pour éviter toute atténuation ultérieure :

| ID | Critère éliminatoire | État initial |
|---|---|---|
| E01 | Un formulaire applicable n’a pas été réellement exécuté dans l’interface avec contrôle de persistance et du détail. | Non satisfait : preuves de la nouvelle mission non constituées |
| E02 | Un champ requis, une relation ou une transition attendue perd, altère ou attribue mal les données. | Risques statiques identifiés dans le pilote ; reproduction requise |
| E03 | Un portail, module, écran ou parcours requis demeure non testé ou inaccessible sans résolution. | Non satisfait : inventaire et exécution globale à effectuer |
| E04 | Un défaut de droits ou de cloisonnement expose des données ou autorise une action indue. | Non exécuté : contrôles serveur et deux organisations requis selon applicabilité |
| E05 | Un ajout métier non justifié, un bouton requis inerte ou une suppression de fonction masque une lacune. | Anomalies statiques identifiées : courriel inerte et transactions fictives du pilote |
| E06 | Un critère graphique obligatoire reste non conforme, ou le design n’a pas été inspecté sur les écrans exécutés. | Non satisfait : pages métier exécutées à inspecter |
| E07 | Une anomalie ouverte du périmètre reste sans correction et retest ; une réserve ne vaut pas réussite. | Non satisfait : anomalies initiales ouvertes |
| E08 | La version à livrer diffère de la version intégrée auditée, ou ses preuves sont devenues obsolètes. | À vérifier sur la candidate intégrée ; aucune promotion autorisée par cet audit |
| E09 | Un test ou un rapport est déclaré réussi sans preuve vérifiable. | Contrôle permanent ; aucune reprise automatique d’une réussite historique |

La décision de déploiement exige les neuf critères satisfaits, 100/100 sur la base figée et les préconditions d’exploitation. La vérification après publication est une étape ultérieure : elle n’est pas exigée circulairement pour autoriser la publication.

## Examen des preuves de la précédente refonte

| Élément examiné | Apport recevable | Limite pour la nouvelle mission |
|---|---|---|
| `docs/multiportail-qa/RAPPORT.md` | Décrit honnêtement 12 portails visuels, 15 contextes, les limites et la publication précédente | Le périmètre livré est le shell / dashboards ; il ne couvre pas tous les modules ni formulaires |
| `docs/multiportail-qa/auth.ts` | Test des consommateurs de contexte et de la résolution graphique | Auth remplacée par fixture ; aucune connexion/MFA/session serveur réelle par portail |
| `docs/multiportail-qa/supabase.ts` | Banc isolé sans mutation de production | `insert`, `update`, `delete`, `upsert` explicitement interdits : aucune preuve possible d’enregistrement ni persistance |
| `captures/*.png`, `responsive.json` | Baseline de composition, largeur de document et présence des logos | Pas de chaîne saisie → écriture → même identifiant → détail → reload → modification ; pas de validation RLS |
| `portal-checks-final.json` | Mesures de 14 profils à 1536 × 1024 ; images non cassées | Pas de scénario stable, timestamp individuel, commit, organisation ni assertion métier par entrée ; ne pas confondre les 14 mesures avec la galerie de 15 contextes |
| `tests-summary.json` | Résumé historique : 2 562 tests, 348 fichiers ; ciblés 20 tests | Pas de commande horodatée, commit ni empreinte du rapport brut dans ce JSON ; liens CI / rapports originaux à conserver pour la nouvelle candidate |
| Lien CI du rapport précédent | Peut établir les portes techniques du commit applicatif précédent après lecture du résultat original | Ne valide ni cette nouvelle candidate ni la recette fonctionnelle du nouveau périmètre |
| Export / détail d’opération / 200 % / connexions réelles | Le rapport indique explicitement ces limites | Téléchargement navigateur non confirmé, détail fixture, zoom natif non confirmé, contrôles authentifiés après publication non terminés |

Ces constats sont des **écarts de couverture par rapport au nouveau mandat**, pas une accusation de résultats inventés dans le rapport précédent, qui expose ses réserves. Aucun point de recette métier n’est transféré depuis ces captures. Une preuve de socle techniquement inchangée ne pourra être réutilisée qu’après vérification de sa version, de sa portée et de son admissibilité, puis retest des consommateurs affectés.

## Pilote Clients — périmètre réel et observations initiales

Le détail réel est `src/pages/customers/CustomerProfile.tsx`, pas `CustomerDetails.tsx`. Le parcours s’appuie sur :

| Écran | Route | Fichier / contrat |
|---|---|---|
| Liste | `/customers` | `CustomerListing.tsx`, `CUSTOMERS_VIEW` |
| Création | `/customers/new` | `CustomerForm.tsx`, `CUSTOMERS_CREATE` |
| Modification | `/customers/:id/edit` | `CustomerForm.tsx`, `CUSTOMERS_EDIT` |
| Détail | `/customers/:id` | `CustomerProfile.tsx`, `CUSTOMERS_VIEW` |
| Comptes bancaires | Sous-formulaire des deux formulaires | `BankAccountForm.tsx`, `customer_banks.customer_id` |
| Ventes liées | Détail → `/sales/:id` | Vraie référence `sales.id` à conserver |
| Paiements | `/customers/:id/payments` | Redirection actuelle vers `/payments/create`, à confronter au libellé « Consulter les paiements » |

Les routes de création/modification sont réservées par `routeAccessRegistry.ts` au compte SONASP / rôle management avec capability SONASP_PREPARE. Les lectures ont leurs règles distinctes. Ne pas déduire des droits de création du seul titre Administrateur ou du fait qu’un bouton existe. Les profils effectifs et surcharges autorisées sont à confirmer dans la matrice 04 et par le serveur.

| ID | Constat statique à la baseline | Risque / contrôle demandé | Statut |
|---|---|---|---|
| AUD-CLI-01 | `String(data.credit_limit || 500000)` dans le chargement de modification | Une valeur zéro peut devenir 500 000 et être réenregistrée à tort ; tester zéro → édition → sauvegarde → relecture | À CORRIGER / reproduction UI requise |
| AUD-CLI-02 | Réponse `error` de `customer_banks` ignorée au chargement | Une erreur de lecture est présentée comme absence de banques ; ne pas autoriser un écrasement aveugle | À CORRIGER / reproduction UI requise |
| AUD-CLI-03 | Écriture parent puis suppression de toutes les banques puis insertion séparée | Échec partiel, perte des identifiants/références bancaires ; tester refus, rollback et banques déjà référencées | À CORRIGER / reproduction isolée requise |
| AUD-CLI-04 | Banque `__other__` filtrée lors de la sauvegarde ; entrée libre conditionnée par la valeur sentinel | Une banque non renseignée peut disparaître silencieusement ; vérifier saisie complète d’un nom hors référentiel | À CORRIGER / test UI requis |
| AUD-CLI-05 | Erreur `country` calculée mais non passée au `FormField` | Rejet sans message local explicite sur le pays | À CORRIGER / test UI requis |
| AUD-CLI-06 | `transactions` et `performanceData` codés en dur dans le détail | Fausses ventes et liens `/sales/1`, `/sales/2`, `/sales/3` pour chaque client | À CORRIGER / test UI puis persistance requise |
| AUD-CLI-07 | `paymentRate = 0` ; erreurs de ventes transformées en collections vides | Faux zéro de paiements et faux vide en cas d’erreur ; calcul métier existant à retrouver | À CORRIGER / test réseau et données requis |
| AUD-CLI-08 | « Envoyer un courriel » appelle seulement `console.log` | Action visible inerte ; retrouver l’exigence, rendre l’action réelle sans expédier de message de recette | À CORRIGER / test sans envoi externe requis |
| AUD-CLI-09 | « Consulter les paiements » aboutit à une création non contextualisée | Mauvaise destination/action ; confirmer le parcours existant et préserver l’identifiant client | À CORRIGER / test UI requis |
| AUD-CLI-10 | Tous les champs saisis et les banques ne figurent pas dans le détail | La chaîne champ → détail ne peut pas être entièrement contrôlée | À CORRIGER / comparaison champ par champ requise |
| AUD-CLI-11 | Conseils « nouveau client = en attente » malgré statut sélectionnable ; documents « requis » sans contrôle visible | Promesses/obligations non démontrées ; vérifier sources avant retirer ou ajouter une fonction | À ARBITRER SI CONTRADICTION CONFIRMÉE |
| AUD-CLI-12 | Formulaire, liste et détail utilisent `MainLayout` et de nombreuses cartes colorées | Compatibilité visuelle du socle partagé à examiner dans les écrans exécutés ; aucun diagnostic pixel par seul code | À TESTER |
| AUD-CLI-13 | Boutons créer/modifier exposés sans filtrage apparent local des permissions | Le guard peut bloquer la route ; vérifier cohérence actions/droits sans conclure que le serveur autorise | À TESTER |
| AUD-CLI-14 | La migration `20260905000000` conserve une lecture globale authentifiée de customers et customer_banks | Confirmer règle de partage du référentiel et confidentialité bancaire ; pas de nouveau tenant inventé ni resserrement arbitraire | À ANALYSER, comportement live non vérifié |
| AUD-CLI-15 | Pas de garde de réponse tardive dans le chargement du formulaire/détail | Un dossier A peut remplacer B après un changement de route si A répond plus tard | À CORRIGER / test temporel et UI requis |
| AUD-CLI-16 | Désactivation par state uniquement et absence de garde immédiate dans la soumission | Double invocation avant commit React ou durant une reprise à vérifier ; ne pas supposer l’idempotence | À TESTER |
| AUD-CLI-17 | Changement du compte principal et suppression modifient des objets issus des props de BankAccountForm | L’état antérieur est muté indirectement ; vérifier immutabilité et conservation de la banque courante | À CORRIGER / test ciblé puis UI requis |

Les références aux lignes restent celles de la baseline ; les fichiers évoluant pendant l’implémentation, l’audit final relèvera le nouveau diff. Ces constats ne sont pas des tests UI réalisés et ne sont pas marqués RÉUSSIS.

Deux clarifications documentaires ont été transmises à l’orchestrateur :

- **Statut initial.** La migration `20260826191258_domaines_artisan_et_client_opposables.sql` autorise `pending`, `active`, `inactive` et NULL ; le formulaire conserve explicitement le statut choisi. Aucune obligation de créer uniquement en attente n’a été trouvée dans les sources parcourues. Le défaut `pending` est démontré, pas la phrase absolue de l’ancien conseil. Le schéma de l’environnement de recette reste à confirmer.
- **Courriel.** `notificationsService` et `envoyer-courriel` traitent bienvenue, réinitialisation, test de configuration et file de notifications ; ils ne fournissent pas un service de correspondance libre vers un client. `DepositorsPage.tsx` utilise déjà un lien `mailto:` vers l’adresse enregistrée. Cette approche permet de rendre l’action de contact opérationnelle sans inventer un workflow ni détourner l’envoi de message d’essai. Le test vérifie l’adresse et l’ouverture prévue, sans expédier de message externe. L’audit n’affirmera pas qu’un courriel a été envoyé.

## Checklist avant implémentation / recette du pilote

1. Figer la fiche du lot : écrans ci-dessus, variantes création/modification, champs parent, sous-collection bancaire, actions de détail et acteurs réellement autorisés. Inclure les liens aval sans imposer un CRUD inexistant.
2. Retrouver le schéma, les contraintes, les règles de paiement, le statut et les politiques réellement appliqués ; distinguer problème fonctionnel et éventuelle contradiction métier. La lecture globale du référentiel ne permet pas de supposer que toutes les données associées sont publiques.
3. Identifier un environnement isolé représentatif, son commit/build et ses migrations. Prouver qu’aucune requête mutante ne cible `sonasp.data-univers.com` ou le projet Supabase de production. La simple substitution de réponses dans un banc n’est pas une base de recette réelle.
4. Préparer des comptes de test avec MFA et capabilities existantes : acteur SONASP autorisé, lecture seule et acteur sans droit ; deux contextes d’organisation là où applicable. Aucun compte ni secret dans les preuves publiées.
5. Réserver un préfixe d’essai `QA-CLI-<lot>-<horodatage>` et une adresse sous `example.invalid`. Références de vente/paiement uniquement en test isolé autorisé ; aucune émission de courriel/SMS réel.
6. Conserver la reproduction avant correction, puis implémenter et intégrer. Identifier version de code + migrations + empreinte de l’artefact testé ; invalider les preuves de code touché.
7. Exécuter la chaîne complète de la section 8 avec **tous les champs**, deux comptes bancaires représentatifs, puis zéro/valeurs facultatives, banque libre, erreur de lecture, erreur d’écriture partielle, double soumission, annulation et accès refusé.
8. Relire en base les identifiants client/banques et leurs liens, recharger le détail, retrouver la liste, modifier un champ et vérifier les autres invariants. Conserver les preuves avant nettoyage précis des seuls enregistrements d’essai autorisés.
9. Examiner le design des écrans exécutés : desktop, mobile, clavier, 200 % natif, erreur, chargement, focus et actions. Volet contextuel utile seulement ; pas de cartes décoratives ni de tailles masquant des champs.
10. Faire rejouer les chemins critiques par l’auditeur dans sa session distincte et relire les preuves de données. Exécuter les portes techniques du lot et sa régression. Les résultats produits seulement par l’agent d’implémentation ne suffisent pas à clore le lot.

## Modèle obligatoire d’une preuve

Utiliser [MODELE_PREUVE.json](audit/MODELE_PREUVE.json). Il sépare : version de l’application, environnement, acteur, objet, étapes, assertions, artefacts, mutations et avis indépendant. Le modèle est volontairement NON EXÉCUTÉ et ne peut être copié en réussite sans exécution.

Exigences de recevabilité :

- ID de scénario et de critère stables, reliés aux matrices 02, 03, 04 et 05 ; date UTC et version exacte intégrée.
- Origine et identifiant non secret de l’environnement de test ; preuve de son isolation. Code, schéma et build réellement servis identifiés.
- Portail, profil/capabilities pertinentes et organisation de test explicites ; pas de mot de passe, jeton, cookie, document personnel ni URL signée persistante.
- Point d’entrée réel, route et étapes ordonnées ; valeurs d’essai, attendu, observé et résultat pour chaque assertion.
- Même identifiant parent/enfants dans la saisie, relecture persistée, détail, liste, rechargement et modification. Les captures ne remplacent pas la lecture persistée.
- Artefacts locaux ou CI consultables : chemin, type, SHA-256, date, dimensions pour une capture, commande/exit code pour un test. Tout artifact manquant maintient le critère NON EXÉCUTÉ ou BLOQUÉ.
- Nature de la preuve déclarée : statique, unitaire avec doublures, UI fixture, UI sur backend réel isolé, contrôle de persistance ou contrôle réel après déploiement. Ne jamais remonter une preuve fixture au niveau UI réel.
- Résultat de test distinct du statut de travail ; identité/date de l’exécutant et de l’auditeur ; contrôles critiques rejoués, avis motivé et portée de réutilisation.
- Nettoyage distinct, ciblé sur les identifiants d’essai après conservation des preuves. Un nettoyage réussi n’implique pas que la création ait réussi.

## Décisions et étapes d’audit suivantes

| Révision | Version | Décision | Travail restant |
|---|---|---|---|
| Initiale — 2026-09-07 | Baseline `83f8c74e` | Audit documentaire/statique effectué ; recette non prononcée | Inventaire figé, environnement/backend isolé, corrections et exécution UI du pilote |
| Backend pilote — 2026-09-07 | Fichiers de travail identifiés par SHA-256, migration `0b87f4df…` | [Revue SQL indépendante](audit/REVUE_BACKEND_CLIENTS.md) : 32 tests Node réussis dans PGlite après compatibilité NULL ; aucun défaut transactionnel confirmé dans les scénarios testés | Auth/API réels isolés, persistance UI, concurrence/reprise et contrôles aval restent à effectuer |
| Frontend pilote — 2026-09-07 | 22 empreintes stables, composant détail `baddbfc3…` | [Revue frontend indépendante](audit/REVUE_FRONTEND_CLIENTS.md) : 46 tests réussis, dont 14 indépendants, après contrôle final de la traduction limitée au pays ; 19 constats initiaux suivis | Contexte réel, persistance et revue de la candidate nécessaires ; cette exécution ciblée ne remplace pas la suite globale ni la recette |
| Présentation Clients — 2026-09-07 | 15 JPEG du manifeste complémentaire | [Avis visuel indépendant](audit/REVUE_VISUELLE_CLIENTS.md) : formats, dimensions et hashes concordants ; KPI tronqués et badge corrigés puis revus | Viewports avec fixtures seulement ; zoom natif, parcours complet, Auth/API et persistance réelle non validés |
| Lectures du détail Artisan — 2026-09-07 | Empreintes du lot de travail | [Revue indépendante du détail Artisan](audit/REVUE_ARTISAN_DETAILS.md) : 38 tests composants réussis, dont 6 cas indépendants ; changement de contexte corrigé | Aucun formulaire, workflow carte/vente/infraction ni contrôle UI/base réel validé par cette preuve |
| Recevabilité du suivi 00–08 — 2026-09-07 | Documents de travail avant gel | [Revue documentaire indépendante](audit/REVUE_RECEVABILITE_DOCUMENTS.md) : statuts sans réussite UI abusive, détections conservées ; IDs/scénarios Clients harmonisés avec table historique, unités de comptage clarifiées | Anomalies d'annexe à conserver ; pilote intégré non recetté sans cible Auth/MFA/API/base isolée ; Storage applicable et dénominateur par contexte/champ à qualifier ; aucune note globale |

Après intégration du pilote, l’audit vérifiera le diff, relancera des tests ciblés indépendants, contrôlera la correspondance des champs et rejouera les actions critiques selon les accès réellement disponibles. Il indiquera explicitement BLOQUÉ si le backend isolé ou les sessions nécessaires manquent. Les autres lots resteront visibles dans l’inventaire et ne seront pas exclus pour obtenir une note.
