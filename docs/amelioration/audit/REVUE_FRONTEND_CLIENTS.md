# Revue indépendante du frontend Clients

Date : 7 septembre 2026. Auditeur : `audit_independant`. Branche partagée : `codex/amelioration-integrale`, baseline `83f8c74ea83c81a2734ef9e086c2edd211573ebe`.

**Revue du lot corrigé et tests indépendants effectués ; recette réelle non prononcée.** Cette note conserve les défauts transmis pendant l’itération et la portée des contrôles complémentaires. Les sources de l’exécution ciblée sont identifiées par empreintes, mais ne constituent pas encore une candidate de livraison. Aucun parcours navigateur avec Auth/API réels et persistance n’a été exécuté par cet auditeur à cette étape.

## Périmètre inspecté

- `CustomerForm.tsx` : création, édition, validation, annulation, chargement et sauvegarde.
- `CustomerProfile.tsx` : détail, banques, ventes et liens d’action.
- `CustomerListing.tsx` : répertoire, filtres, onglets, compteurs et pagination.
- `BankAccountForm.tsx` : sous-collection, banque libre, compte principal et erreurs.
- `customerDossierService.ts`, déclaration RPC dans `database.ts` et `customers.css`.
- Tests de composants et service écrits par l’implémenteur, relus comme contrats simulés, sans les assimiler à une recette de persistance.

## Constats transmis et suivi de l’itération

« Correction observée » signifie que le défaut statique a reçu un changement cohérent. Ce statut ne signifie pas TESTÉ, AUDITÉ ou VALIDÉ dans la matrice de recette. Une assertion indépendante, puis les preuves UI/persistance applicables, restent nécessaires.

| ID | Défaut et contrôle demandé | État à cette revue intermédiaire |
|---|---|---|
| FE-CLI-01 | Crédit zéro remplacé par 500 000 lors de l’édition | Correction observée : valeur nullish, zéro conservé ; scénario composant présent |
| FE-CLI-02 | Erreur de lecture bancaire ignorée, édition aveugle possible | Correction observée : service rejette, formulaire bloqué avec reprise ; scénario composant présent |
| FE-CLI-03 | Sauvegarde parent/enfants non atomique et IDs bancaires remplacés | Frontend raccordé au RPC atomique ; preuve SQL distincte dans la revue backend ; persistance UI manquante |
| FE-CLI-04 | Banque « Autre » disparaît au premier caractère ; changement principal/suppression mutent les props | Correction observée : mode libre et objets copiés ; tests de saisie/principal présents ; suppression à tester |
| FE-CLI-05 | Pas d’erreur visible du pays requis | Correction observée : erreur locale, liaison au champ et focus ; scénario composant présent |
| FE-CLI-06 | Ventes et historique fictifs, liens d’exemple | Correction observée : données du service et IDs réels ; tests avec doubles présents ; aucune donnée réelle vérifiée |
| FE-CLI-07 | Statistiques confondant absence, erreur et données incomplètes | Total/moyenne n’additionnent pas les devises différentes, erreurs propagées ; hint du KPI détail confond encore échec et zéro lors du signalement |
| FE-CLI-08 | Action de courriel inerte ; consultation des paiements vers création | Correction observée : `mailto:` vers adresse enregistrée et registre réel ; aucun courriel envoyé par la recette |
| FE-CLI-09 | Champs et banques omis du détail | Correction observée : identité, fiscalité, paiement, crédit et banques exposés ; comparaison exhaustive avec persistance encore requise |
| FE-CLI-10 | Statut `pending` présenté comme obligation malgré sélection et stockage nullable | Correction observée : défaut de création seulement, NULL historique préservé ; aucune règle métier supplémentaire créée |
| FE-CLI-11 | Passage édition → création conserve dossier précédent ; réponse tardive peut remplacer le contexte | Correction observée : clé de contexte, réinitialisation, garde de génération ; tests de transition et sortie présents |
| FE-CLI-12 | Scope liste/détail incomplet lors du changement de mine ou rôle d’accès | Correction observée : `mining_company_id` et `access_role_id` inclus ; tests mine présents ; réponse différée et rôle encore à couvrir |
| FE-CLI-13 | Double soumission avant commit React | Correction observée : verrou immédiat par ref ; test de promesse différée présent ; réponse perdue/reprise réelle non testée |
| FE-CLI-14 | Fallbacks de valeurs texte historiques absents des listes | Correction observée pour pays, conditions de paiement, devise ; test édition → payload inchangé demandé |
| FE-CLI-15 | Arrondi visuel des montants décimaux | Crédit corrigé ; montants des ventes utilisent encore le helper à zéro décimale lors du signalement ; correction locale demandée sans inventer de règle métier d’arrondi |
| FE-CLI-16 | Compteurs en badges détachés, montants non alignés à droite, volet formulaire dès 1024 px | Correction observée dans liste/colonnes et seuil formulaire 1200 px ; inspection desktop/mobile/zoom nécessaire |
| FE-CLI-17 | Filtre statut inconnu actif sans onglet visible après un filtre transversal | Correction observée : onglet conservé si sélectionné ou présent au répertoire ; scénario combinaison demandé |
| FE-CLI-18 | Retour du détail perd recherche, pays, statut, page et taille de page | Signalé au titre du prompt maître §12 ; correction/conservation utile du contexte à contrôler |
| FE-CLI-19 | Erreurs bancaires uniquement globales ; compte invalide fermé et champs libres non marqués | Erreurs locales et ouverture automatique ajoutées ; `aria-invalid` des champs libres et réouverture à la seconde soumission signalés |

## Trous concrets des tests au moment de leur relecture

1. Le test initial intitulé « pays et banque incomplète » n’ajoutait aucune banque : seule l’erreur de pays était réellement couverte. Demande : parent valide, compte incomplet fermé, soumission refusée, message local, ouverture, correction, puis appel conservant les banques.
2. Les sélecteurs doivent afficher et préserver des valeurs historiques hors catalogue, notamment `payment_terms = À réception` et devise bancaire `AED`. La souplesse des colonnes texte est confirmée par le responsable backend ; un catalogue UI n’autorise pas à modifier silencieusement le stockage.
3. Pour les états asynchrones : réponse A tardive après navigation vers B ; sauvegarde répondant après changement de contexte ; changement d’`access_role_id` seul ; rechargement avec erreur. Une simple vérification du nombre d’appels ne démontre pas à elle seule l’absence d’affichage de données tardives.
4. Pour les montants : zéro, décimales, absence, devise inconnue ou différente, erreur de ventes, et jeu réussi sans vente. Aucun total de devises mixtes ni faux « aucune vente » lors d’un échec.
5. Pour le retour de navigation : liste filtrée et paginée → détail → retour avec contexte utile conservé. Les compteurs doivent rester calculés avant pagination sur les filtres transverses.
6. Les tests de liens vérifient leurs destinations ; ils ne démontrent pas les permissions serveur ou l’ouverture du client mail. Les routes aval, refus d’accès réels, comptes bancaires désactivés et historiques de paiements restent à rejouer dans l’environnement isolé.

## Recevabilité des prochaines preuves

La relecture et les tests Vitest avec doubles ne valident ni la charte effectivement rendue, ni les pièces/formulaires d’autres modules, ni Auth/MFA, ni l’API réelle. Après stabilisation, relever les empreintes des sources et tests avant/après l’exécution indépendante, conserver les commandes et sorties, puis rattacher les preuves au catalogue de critères. Les captures d’un aperçu isolé peuvent couvrir l’inspection du rendu à la résolution indiquée ; elles ne peuvent pas démontrer une écriture en base réelle.

La chaîne UI → API → base → détail → rechargement → liste → édition → nettoyage précis reste obligatoire et non exécutée. Les critères concernés demeurent dans le dénominateur. La revue ne donne aucune note globale ni autorisation de déploiement.

## Exécution indépendante après corrections

Le lot a été déclaré stable par l’implémenteur, puis relu et réexécuté par l’auditeur. Le runner [run-frontend-audit.mjs](run-frontend-audit.mjs) conserve les empreintes avant/après de 22 fichiers de source, tests, configuration et dépendances, dont `customerCountryLabels.ts`, son test et le catalogue `COUNTRIES`. [La preuve horodatée](frontend-independent.evidence.json) confirme leur stabilité pendant l’exécution. [Le rapport détaillé](frontend-independent.txt) conserve les assertions nommées et la commande.

**46 tests réussis, 0 échec dans 6 fichiers : 32 tests de l’implémenteur et 14 contrôles complémentaires de l’auditeur.** Ce résultat remplace les 45 tests précédents après le dernier correctif de traduction du détail. Les précédentes itérations avaient également réexécuté les contrôles après les changements de style, de libellés des pays et de sélection des catalogues bancaires. La nouvelle version n’a pas hérité automatiquement de l’ancienne preuve. Le second groupe est dans [customer-frontend-independent.test.tsx](customer-frontend-independent.test.tsx). Il vérifie :

1. Le chargement du formulaire A ne remplace pas B s’il répond plus tard.
2. Une erreur de sauvegarde de l’ancien rôle d’accès n’altère pas le nouveau contexte.
3. Le dossier et les ventes tardives de A ne remplacent pas le détail B.
4. Le changement d’`access_role_id` seul masque immédiatement puis recharge le détail.
5. Le répertoire et les ventes du contexte de mine précédent sont ignorés.
6. Un onglet de statut inconnu reste sélectionné et visible lorsque la recherche ramène son total à zéro.
7. Une erreur de lecture des ventes ne devient pas un message « aucune vente ».
8. Les centimes d’une vente restent visibles dans les montants du détail.
9. Un chemin externe fourni comme retour est remplacé par le répertoire local.
10. Le retrait de la banque principale conserve les identifiants sans muter les objets reçus.
11. Les montants non finis ou la devise absente empêchent un faux total ; zéro reste zéro.
12. Les huit graphies historiques signalées pendant l’audit sont traduites : Antigua and Barbuda, Bosnia and Herzegovina, Czech Republic, Saint Kitts and Nevis, Saint Lucia, Saint Vincent and the Grenadines, Sao Tome and Principe, Trinidad and Tobago. Toutes les valeurs API du catalogue restent identiques, sans perte ni doublon.
13. La Guinée-Bissau et la Guinée équatoriale n’utilisent pas le catalogue bancaire de Guinée par correspondance partielle du nom.
14. Une raison sociale « Guinea » reste inchangée, un pays enregistré « Guinea » s’affiche « Guinée », et une fiscalité NULL s’affiche « Non renseigné ». Seule la valeur du champ pays est traduite.

Les tests de l’implémenteur complétés pendant l’itération couvrent notamment la banque incomplète réellement ajoutée et refermée, sa réouverture/focus lors d’une nouvelle soumission, les valeurs historiques hors catalogue jusqu’au payload, les filtres dans l’URL et le lien de retour. Les contrôles supplémentaires couvrent le catalogue d’Ivory Coast et l’absence de catalogue guinéen pour Papua New Guinea. Les défauts signalés sur ces points ont reçu un correctif relu. Aucun défaut supplémentaire n’a été confirmé dans les 46 scénarios exécutés.

Le contrôle final a été exécuté de **06:26:50 à 06:28:02 UTC**. Son delta applicatif est limité à une ligne de `CustomerProfile.tsx` : la boucle des valeurs du dossier utilise désormais `value || 'Non renseigné'`, le pays étant déjà traduit à la construction des champs. L’appel précédent à `customerCountryLabel(value)` pour tous les champs pouvait transformer une raison sociale homonyme d’un pays et recevait aussi des valeurs NULL. Le test indépendant n°14 couvre cette régression. L’empreinte finale de ce composant est `baddbfc3e887bb8f081612d31279658397640bffc38e0eb9ca89b708cfffa089`. Cette exécution ciblée ne remplace pas le résultat distinct de la suite globale en cours.

Cette conclusion reste limitée aux composants en jsdom et au service avec doubles. Le shell est simulé, les lectures et sauvegardes renvoient des réponses contrôlées. Elle ne démontre ni l’exactitude du design sur écran, ni les données persistées, ni l’accès réel aux portails. Les vérifications manquantes listées plus haut ne sont ni validées ni retirées du catalogue.
