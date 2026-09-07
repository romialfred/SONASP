# Recette du registre et du dossier d’affiliation

Ce banc de recette utilise les pages et services de production avec une base PostgreSQL PGlite isolée. Il ne se connecte à aucun environnement distant et ne contient aucun compte ou document réel. Les identités de recette sont distinctes pour la saisie, le contrôle et le test hors périmètre.

## Démarrage

```powershell
$env:QA_DENO_BIN = '<chemin du binaire deno>'
npm exec vite -- --config docs/affiliation-qa/workflow-vite.config.ts
```

Ouvrir `http://127.0.0.1:5185/artisan-minier/cartes/suivi`.

- Le registre et le détail sont les composants applicatifs réels.
- `affiliationService` et `carteProfessionnelleService` sont les services réels.
- Les RPC et les contraintes proviennent des deux migrations d’affiliation du 6 septembre 2026, exécutées dans PGlite.
- Le rendu des deux PNG et du PDF appelle réellement `generateAffiliationFiles`, avec les fontes et les visuels du moteur de production.
- Le transport Supabase, l’authentification de recette et le stockage local sont des adaptateurs de test. Ce banc ne valide donc pas le déploiement Supabase, ses JWT réels, les URL signées hébergées, ni la concurrence entre plusieurs connexions PostgreSQL.
- Un redémarrage crée une nouvelle base isolée vide de paiements. Les lignes restent dans la même base pendant toutes les interactions du navigateur et sont relues directement par l’endpoint de preuve.

## Scénario navigateur à exécuter

Le dossier initial est `QA-AFFILIATION-2026-0001`, titulaire `Affiliation RECETTE ISOLÉE`, site `Site de recette isolée`. Le seul barème local est explicitement nommé « Barème de recette isolée » : 10 000 XOF pour 365 jours.

1. Dans le registre, vérifier les indicateurs, la recherche, les états vides après filtrage, puis ouvrir le dossier. Conserver l’URL et vérifier qu’un rechargement affiche la même émission.
2. Vérifier l’absence de carte générée et l’impossibilité d’activer avant le paiement.
3. Sous « Agent de saisie », configurer la période annuelle et son barème depuis le formulaire. Vérifier le début et la fin inclusive.
4. Enregistrer un paiement depuis l’interface avec année, date, lieu, preuve, montant, mode et référence. Utiliser un document fictif explicite : `docs/affiliation-qa/pdf.pdf` ou `portrait.png`.
5. Relire `http://127.0.0.1:5185/__affiliation_qa/state` : droit, encaissement en attente, année, date, lieu, référence, métadonnées et empreinte de la preuve doivent correspondre à la saisie. La carte reste non validée et non générée.
6. Vérifier que le déclarant ne peut pas confirmer son paiement. Passer au profil « Agent de contrôle » et confirmer. Le règlement intégral permet le rendu réel de la carte ; une confirmation répétée ne doit pas créer un nouvel encaissement.
7. Vérifier recto, verso et téléchargement PDF, puis effectuer les trois contrôles documentaires et valider l’émission. La validation seule ne vaut pas activation.
8. Confirmer explicitement l’activation. Relire le statut SQL, les dates, la nouvelle révision et le statut effectif actif. Recharger le dossier puis le registre pour vérifier la persistance visuelle.
9. Vérifier le refus hors périmètre avec le troisième profil. Un encaissement remboursé doit faire perdre l’éligibilité à une carte précédemment active.
10. Capturer le registre et le détail aux largeurs 360, 768, 1366, 1440 et 1920 px selon les écrans concernés, avec états vide/erreur/traitement. Relever les erreurs du navigateur.
11. Sauvegarder la réponse de preuve SQL avant nettoyage. Supprimer les données de recette avec `POST /__affiliation_qa/cleanup`, puis vérifier une réponse sans carte, droit, encaissement, preuve, fichier ni événement de recette. L’opération ne peut viser que la base PGlite du processus local et les UUID explicitement fixés par le banc.

## Contrôles complémentaires requis

Les contrats SQL automatisés couvrent notamment : refus avant paiement confirmé intégral, paiement partiel, absence de preuve, année incompatible, date future, double contrôle, périmètre, remboursement pendant un rendu, idempotence, expiration et conservation de l’historique. Les tests de la fonction Edge couvrent les fichiers et requêtes invalides.

Une recette hébergée reste distincte : vérifier les versions réellement déployées, la connexion AAL2, l’envoi de preuve dans le bucket privé, les URL signées, les restrictions inter-organismes et la concurrence réelle. Ne pas assimiler un résultat du banc isolé à cette validation distante.

## Risques examinés

- Le cycle initial permettait un rendu sans paiement et exigeait un rendu avant validation. Le nouveau cycle conserve la préparation de l’identité avant le règlement, mais exige le paiement intégral confirmé aux deux étapes serveur du rendu.
- La révision d’un paiement pendant le rendu est réévaluée avant la publication des fichiers ; un règlement annulé ou insuffisant ne doit pas permettre de contourner le contrôle.
- Les reçus historiques sans nouveaux champs restent historiques ; aucune preuve ni date de paiement n’est inventée.
- Le paiement et le rendu sont deux opérations distinctes : une indisponibilité du moteur de rendu ne doit jamais entraîner un second encaissement.
- La génération ne dispense pas du contrôle documentaire ni de l’activation manuelle. La fin de validité est inclusive et calculée côté serveur.

Ce document décrit le protocole. Les captures, la relecture SQL et les résultats réellement exécutés doivent être ajoutés au rapport de livraison ; cette procédure seule ne constitue pas une preuve d’exécution.
