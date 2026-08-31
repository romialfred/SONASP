# Conciliation : expéditions, preuves et régularisations

Audit et corrections du 30 août 2026. État : implémentation locale ; migration non déployée sur la base connectée. Aucun dossier réel, paiement, stock ou déclaration fiscale n’a été modifié.

## Constats vérifiés

1. Le chargement des origines demandait une colonne et une relation `comptoir_cession_id` absentes du schéma connecté de `snp_ventes_lots`. L’échec secondaire faisait perdre les autres informations du contexte, puis était présenté à tort comme une insuffisance de droits.
2. Pour la vente **SL-2026-012**, l’inspection en lecture seule constate : `shipping_preparation_id` nul, aucun certificat ou analyse rattaché au dossier et aucune allocation active dans `snp_ventes_lots`. L’absence de preuve ne peut pas être réparée en accordant davantage de droits. Il faut rattacher l’expédition réelle, sans déduire son identité du numéro de vente.
3. Une quantité d’or fin pouvait servir de poids total avant application de la pureté : risque de double minoration. Le poids de l’échantillon ne constitue pas davantage une mesure du lot.
4. Le formulaire et le serveur n’utilisaient pas le même fixing. L’ancien validateur reconstruisait la taxe initiale au taux final et omettait certaines devises et contrevaleurs dans les écritures.

## Corrections

- Lecture indépendante des sections : une erreur d’origine ne masque plus un certificat accessible. Les incidents techniques sont distingués des refus d’accès, avec possibilité de réessayer.
- Traçabilité explicite **origine Mine → lot expédié → raffinerie**. Recherche des rapports Mine par expédition et achats sources réellement affectés à la vente.
- Sélection des certificats de la même expédition ; pas de sélection arbitraire entre plusieurs preuves approuvées. Le fichier sélectionné s’ouvre via le service d’URL privée existant. Les preuves non approuvées restent consultables sans pouvoir arrêter les mesures.
- Masse totale vérifiée, teneur, or fin, prix contractuel et valeur commerciale comparés séparément. Les données absentes restent absentes ; les devises incompatibles ne sont pas soustraites.
- Onglets distingués du bandeau récapitulatif : barre de navigation dédiée, état actif contrasté et titre/description propre à chaque section. L’onglet raffinage sépare preuves, mesures, comparaison commerciale et fiscalité.
- Simulation fiscale en lecture seule sur le serveur, également utilisée par la validation : historique initial conservé, assiette et règle datée, montant final, ajustement et versements consignés. Une dette/créance n’est pas présentée comme un paiement/remboursement exécuté.
- Validation atomique : si une base fiscale nécessaire ou un taux de change daté manque, l’ensemble des écritures est annulé. La contrevaleur XOF utilise le référentiel au fixing, jamais un taux fabriqué.
- Déploiement partiel sécurisé : l’interface vérifie la disponibilité du nouveau moteur fiscal avant toute validation. Sans la migration, elle suspend cette action au lieu d’appeler silencieusement l’ancien moteur.
- Accès national du Owner actif, cloisonnement des mines conservé, session et MFA respectées. La séparation préparateur/validateur reste obligatoire, y compris pour Owner. Une clé idempotente est liée à l’acteur, l’opération et l’agrégat.

## Vérifications réalisées

Base SQL : `sonasp_iam_audit_20260830`, dans le conteneur local, sur copie isolée du schéma et données synthétiques transactionnelles annulées en fin de test. Pas de test d’écriture sur les données réelles.

| Vérification | Résultat |
| --- | --- |
| Suite générale Vitest (237 fichiers, interface et fonctions serveur) | 1 803 tests réussis |
| Dernier passage ciblé après les protections de déploiement et la sélection de preuve (7 fichiers) | 64 tests réussis |
| Preuves, mesures, devises, fiscalité et validation (pgTAP) | 33 contrôles réussis |
| Flux Mine / SONASP / Comptoir et isolation (pgTAP) | 24 contrôles réussis |
| Continuité des droits et modules Owner (pgTAP) | 26 contrôles réussis |
| ESLint des fichiers TypeScript concernés | Réussi |
| TypeScript (`tsc --noEmit`) et couverture des types Supabase | Réussis |
| Compilation de production Vite | Réussie, 3 207 modules |
| Migration, retour arrière et réapplication sur base isolée | Réussis |
| Intégrité du catalogue de migrations | Conforme ; dette historique inchangée |

La suite générale s’est terminée sans échec ; les derniers ajustements de l’interface ont ensuite été couverts par le passage ciblé de 64 tests. La recette visuelle authentifiée Owner n’a pas été exécutée : les navigateurs disponibles affichent la connexion ; une connexion utilisateur a été demandée. Les tests de composants ne remplacent pas cette recette.

## Livraison et limites

Migration : `20260830120000_fiabiliser_conciliation_expeditions_et_impacts.sql`.

SHA-256 normalisé : `c65b28e4293bdd525ef39e91e10c63e09c7c92422ba60873629538e410246f83`.

Catalogue : `e4ccb7518925f8dc453708ba17163de9525387b2b9dabb7bb3736165cd79ca07`.

Le script de retour applicatif correspondant est dans `supabase/rollback/`. Il restaure les fonctions remplacées sans supprimer de données et conserve volontairement le cloisonnement de lecture introduit par la correction.

Le déploiement nécessite une revue puis une autorisation explicite. Ne pas lancer un `db push` global : le dépôt comporte des migrations historiques non canoniques et d’autres travaux non publiés. Le test local utilise également les migrations IAM précédemment préparées ; vérifier ces prérequis sur la cible avant tout déploiement.

Sans cette migration, l’interface locale peut présenter la comparaison et les preuves existantes, mais le nouveau service de simulation fiscale n’est pas disponible sur la base connectée. Les dossiers historiques incomplets, dont SL-2026-012, restent à compléter par leurs pièces et rattachements réels. Aucun rapprochement automatique, réécriture d’anciens paiements ou mouvement de stock n’a été ajouté.

## Recette authentifiée à terminer avant clôture

1. Owner : ouvrir SL-2026-012 et constater l’expédition non rattachée, sans avertissement générique attribuant une erreur de schéma aux permissions. Les sections accessibles doivent rester chargées.
2. Sur un dossier de recette avec expédition réelle, sélectionner le résultat de sa raffinerie, ouvrir son PDF, contrôler poids total/pureté/or fin et fixing. Un certificat d’une autre expédition ne doit jamais être proposé.
3. Vérifier séparément un rapport non approuvé et plusieurs rapports approuvés : consultation possible, enregistrement interdit dans le premier cas et choix explicite requis dans le second.
4. Comparer la simulation aux calculs initiaux enregistrés et aux versements ; en l’absence de base historique ou de change daté, vérifier le blocage explicite. Ne pas utiliser un dossier financier réel pour un simple test d’écriture.
5. Avec deux acteurs habilités sur un dossier de recette, préparer puis valider. Réessayer la même opération sans double écriture. Vérifier que les stocks et paiements antérieurs restent inchangés et que les ajustements sont traçables.
6. Tester en Mine A/Mine B : chaque mine ne voit que son périmètre autorisé ; Owner conserve la vision nationale. Contrôler aussi l’affichage étroit et la navigation clavier des sept onglets.
