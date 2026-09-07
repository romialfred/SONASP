# Recette Affiliations & Cartes — 7 septembre 2026

## Périmètre

Refonte du registre et du dossier selon les deux maquettes fournies. Paiement annuel avec date, lieu et preuve privée ; génération après règlement intégral confirmé ; contrôle documentaire indépendant et activation manuelle. Les formulaires de création des artisans et des sites ne sont pas modifiés.

## Parcours exécuté dans le navigateur

Les composants et services de production ont été utilisés avec les migrations PostgreSQL dans une base PGlite locale jetable. L’authentification et le stockage sont des adaptateurs de recette ; le handler de contrôle du justificatif et le moteur de génération PNG/PDF sont réels.

1. Ouverture du registre, recherche sans résultat, réinitialisation et consultation du titulaire.
2. Configuration annuelle du barème fictif de recette : 10 000 FCFA, du 1er janvier au 31 décembre 2026. Aucun tarif réel n’a été créé.
3. Saisie dans le formulaire : année 2026, date du 7 septembre, lieu « Caisse de recette — Ouagadougou », référence de recette, fichier PDF sélectionné dans le sélecteur natif du navigateur intégré.
4. Relecture SQL : reçu en attente, date, année, lieu, chemin privé et empreinte SHA-256 conservés. Aucun fichier de carte généré. L’auteur du paiement ne peut pas le confirmer.
5. Confirmation avec un second agent : rendu réel du recto, du verso et du PDF. Aucune activation automatique.
6. Vérification des trois contrôles documentaires, validation puis confirmation explicite de l’activation. Relecture SQL : carte active, dates exactes, rendu disponible ; affichage de 115 jours restants et compteur du registre à 1 carte active.
7. Basculement recto/verso dans l’interface. PDF téléchargé depuis le bouton, relu : deux pages de 242,646 × 153,014 points, soit le format ID-1. PNG verso téléchargé et relu : 1011 × 638 pixels, 435 790 octets. Les événements de téléchargement de l’outil navigateur ont expiré malgré les fichiers réellement enregistrés : PDF dans Téléchargements, PNG dans le dossier `amelioration labs`. Des copies de preuve sont conservées avec ce rapport.
8. Remboursement fictif depuis l’interface : reçu « rembourse », statut effectif « a_reexaminer », carte sans statut actif et fichiers masqués. Profil hors périmètre : aucun dossier accessible.
9. Nettoyage ciblé exécuté : zéro carte, droit, reçu, preuve, objet de stockage et événement de recette, confirmé par relecture SQL.

Un arrêt du premier processus de recette a nécessité de rejouer le parcours complet dans un second processus. Les fichiers `workflow-payment-pending.json` et `workflow-active.json` documentent le premier passage ; `workflow-refunded.json` et `workflow-cleanup.json` documentent le second. Aucune opération de recette n’a été envoyée à une base distante.

## Contrôle visuel

Captures conservées pour le registre à 1440, 768 et 360 pixels et le détail à 1920, 1440, 768 et 360 pixels. Aucun débordement horizontal de la page observé ; le tableau possède son propre défilement aux petites largeurs. Actions accessibles à 1440 pixels, composition empilée sur mobile. Trois contrôles déjà validés restent cochés après rechargement.

Les captures représentent exclusivement des données fictives. L’absence de portrait réel est volontaire. Le journal du navigateur intégré ne contient aucune erreur de console lors de la fin de recette.

## Contrôles automatisés et base hébergée

- 92 contrats SQL réussis : preuve requise, périmètres, dates, paiements partiels, idempotence, indépendance des agents, accès financier, remboursement pendant le rendu, expiration et conservation de l’historique.
- Suite `test:affiliations` : 64 tests réussis, dont registre, paiement, dossier, carte numérique, vérification publique et rendu.
- Contrôles ciblés du service et du dépôt Edge réalisés ; contrôle de typage et lint globaux réussis.
- Migration `20260906235254` répétée avec rollback vérifié, puis appliquée. Empreintes des huit tables métier inchangées ; les 15 contrôles de déploiement sont positifs. Aucun historique, paiement ni dossier métier n’a été réécrit.
- Fonction `affiliation-payment-proof-upload` déployée sur le projet lié.

## Limites à conserver dans la livraison

Cette recette ne vaut pas un parcours authentifié dans Supabase hébergé : JWT/AAL2 réels, dépôt distant, liens signés distants et concurrence entre plusieurs connexions PostgreSQL restent distincts. La session de production accessible est déconnectée. Les règles et fonctions déployées sont vérifiées, mais aucun paiement réel ou artificiel n’a été créé en production.

La base hébergée ne contient pas encore de barème d’adhésion : un responsable habilité doit configurer le montant et la durée réels. La confirmation du paiement lance le rendu si l’agent possède aussi l’habilitation de gestion/activation des cartes ; sinon, le gestionnaire génère les deux faces depuis le dossier déjà payé. L’activation reste manuelle.
