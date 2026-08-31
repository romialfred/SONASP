# Formulaire de paiement international — 30 août 2026

## Livraison

Refonte de `/payments/create` selon la référence `codex-clipboard-8c1083a4-3e74-4352-95f4-29b1b031f525.png` : en-tête, sélection de vente, comptes bancaires à deux lignes, formulaire à gauche, résumé financier à droite, justificatif avec retrait et barre d’actions persistante. Le formulaire utilise l’habillage national existant, sans remplacer la navigation ni ses permissions par celles illustrées dans la maquette.

`InternationalPaymentFormView` porte la présentation ; `PaymentCreate` conserve l’autorité du workflow et les appels sécurisés. Les tokens SONASP, la typographie de l’habillage, les labels explicites, les états de focus et les contrôles tactiles sont conservés/adaptés. Aucun écran de démonstration n’est ajouté aux routes applicatives.

## Données et garde-fous

- Vente, client, comptes, coordonnées bancaires, date d’expédition et montants proviennent des lectures Supabase du compte connecté. Aucun montant de la maquette n’est fixé dans le formulaire.
- La date d’expédition est lue sur les expéditions liées aux ventes déjà autorisées, par lots d’identifiants. Elle n’est jamais remplacée par la date de vente. L’indisponibilité de ce contexte facultatif n’empêche pas un encaissement autrement autorisé.
- Le registre financier reste obligatoire et paginé. Une erreur de lecture ne produit pas un solde fictif.
- Le résumé distingue les paiements confirmés et les paiements en cours de contrôle. Il ne présente pas les seconds comme des avances commerciales. Le solde disponible les déduit tous deux.
- Le bandeau « Aucune vente en attente » n’apparaît qu’en état vide, contrairement à la référence illustrée où il coexiste avec une vente sélectionnée.
- Le choix de devise sélectionne un compte client actif correspondant. Un changement de devise efface le montant à ressaisir ; le taux et le montant de règlement restent contrôlés par le serveur.
- Justificatif PDF/JPG/PNG, maximum 10 Mio selon la politique existante ; sélection, retrait et nouvelle sélection du même fichier possibles. Dépôt par le gateway privé existant, jamais par une URL publique.
- Capacité financière explicite, session renforcée, version attendue, idempotence, limites de solde et rapprochement par un autre acteur inchangés. Le formulaire enregistre un paiement reçu : il n’émet pas de virement bancaire.
- Une interruption de dépôt conserve la reprise sans réexécuter le versement. Les champs financiers sont verrouillés après exécution. Aucun rafraîchissement au focus n’est ajouté.

## Vérifications effectuées

- Tests ciblés : **5 fichiers / 51 tests réussis** (formulaire, présentation, éligibilité, calcul des soldes et service sécurisé).
- Suite globale : **246 fichiers / 1 899 tests réussis**, durée 411,23 s.
- `npm run lint` : réussi.
- `npm run typecheck` : couverture des relations Supabase et compilation TypeScript réussies.
- `npm run build` : réussi, génération PWA incluse ; entrée `index-W7qnC1S3.js`, composant `PaymentCreate-C0UJxXps.js`.
- Rendu du composant réel inspecté dans le navigateur à 375, 768, 1 280 et 1 324 px ; aucun débordement horizontal global constaté. Le banc utilise exclusivement des données synthétiques, sans mutation de base.
- `git diff --check` : réussi sur les fichiers suivis du périmètre.
- `/payments/create` servi en HTTP 200 sur `http://127.0.0.1:5180`, avec la nouvelle entrée compilée.

## Limites

Pas de migration, de modification des droits, de paiement ni de téléversement dans la base distante pour cette demande. Le dépôt réseau complet sous un compte connecté n’a pas été exécuté. Les tests du workflow utilisent les services simulés et les contrats existants ; aucune nouvelle campagne SQL n’a été nécessaire pour cette refonte de présentation. La ressemblance a été contrôlée visuellement et par les dimensions, pas par une preuve de différence pixel à pixel nulle.

Modifications conservées dans le workspace ; pas de commit, de publication distante ou de rechargement automatique de la session utilisateur.
