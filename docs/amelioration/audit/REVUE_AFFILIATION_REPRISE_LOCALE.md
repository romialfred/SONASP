# Affiliations — revue indépendante locale

7 septembre 2026, HEAD observé `04b1826c0cca77e0e221730fd00609979e5724ce`, sources de travail en attente de commit. Périmètre : `AffiliationDossier.tsx`, son test et interactions avec `AffiliationPaymentPanel`. Aucun changement applicatif effectué par l'auditeur, aucun navigateur ou accès distant.

## Contrat vérifié

Une relecture de cartes, droits ou historique échouée ne doit pas produire « Statut actualisé ». Une mutation ayant retourné un succès ne doit pas être répétée parce que sa relecture échoue. Les générations/activations restent bloquées tant que les droits ne sont pas vérifiés ; les données de l'ancienne émission ou de l'ancien contexte ne doivent pas persister dans la nouvelle fiche.

Le candidat relu distingue l'action et sa relecture dans `run`, retourne un succès de mutation permettant la fermeture du formulaire paiement même si la relecture échoue, et affiche dans ce cas une consigne d'actualisation. La relecture sélectionne la carte fraîche renvoyée par le service pour retrouver ses droits liés. Les erreurs d'historique ne sont plus remplacées par une liste vide présentée comme vérifiée.

## Régression reproduite puis corrigée

Le premier candidat, composant SHA256 `7538f5f0d59c01e2706e441fbf8234f9cb1b06a43fa946a5112fd9bfbb52b31e`, a échoué sur deux des trois cas indépendants :

- `AFF-SCOPE-007` : utilisateur/organisme changés, artisan conservé ; l'ancien dossier et ses finances restaient affichés sans nouvelle lecture.
- `AFF-RACE-008` : émission changée pendant une relecture de droits lente ; la nouvelle émission restait sans droits et avec chargement permanent.
- `AFF-REL-009` : relation `dues_card_id` changée et réponse lente ; ce cas passait déjà.

Le [journal rouge](affiliation-reprise-independent-before.txt) conserve **2 échecs / 1 réussite**. Aucun de ces échecs n'est un résultat SQL ni une preuve d'accès à des données d'une autre organisation sur le serveur ; ce sont des constats de state/DOM local avec doubles.

Le coordinateur a ajouté une frontière de composant comprenant artisan, émission et contexte complet : id utilisateur, organisme, mine, rôle d'accès, rôle, type de compte éventuel, type d'organisme, activité, capacités, modules, sites, responsabilités, domaines, portail et catégorie d'acteur. Son changement démonte les lectures antérieures et remet le dossier en chargement. La simple couleur du portail ne devient pas une autorisation.

## Rejeu indépendant final

[Preuve](affiliation-local-20260907.evidence.json), [journal](affiliation-local-20260907.txt), [trois cas indépendants](affiliation-reprise-independent.test.tsx).

**33/33 tests dans trois fichiers, sortie 0, entre 11:36:46 et 11:37:17 UTC ; douze entrées empreintées stables.** Cela comprend 30 tests de l'implémenteur/panneau paiement et trois cas indépendants. Les anciennes données sont masquées, la sélection de nouvelle émission reprend correctement ses droits et le cas de relation lente reste réussi.

Les champs supplémentaires de la clé ont été relus dans le source ; les trois cas indépendants ne sont pas une combinatoire exhaustive de tous les profils et de toutes les dimensions de contexte. L'existence de cette clé ne prouve pas les contrôles serveur.

## Avis et limites

AFF-ACK-005, AFF-SCOPE-007 et AFF-RACE-008 sont corrigés dans le candidat et vérifiés au niveau technique décrit. Les tests indépendants sont figés ; aucun défaut supplémentaire n'a été confirmé dans les cas exécutés.

**Non vérifiés ici :** UI réelle, paiement/justificatif/base, activation manuelle effective, rendu PDF/PNG, expiration, RLS inter-organismes et MFA. La recette doit encore enregistrer un paiement identifiable par l'interface, contrôler la persistance et les états sur le compte habilité, puis nettoyer seulement ses données de test conformément au prochain Go. Aucun total d'adhésions, succès métier réel ou déploiement ne découle du run local.
