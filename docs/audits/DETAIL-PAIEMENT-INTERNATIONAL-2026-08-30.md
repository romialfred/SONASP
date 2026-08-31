# Détail d’un paiement international — 30 août 2026

## Périmètre livré

Route existante `/payments/:id`, accessible depuis le registre des paiements. Refonte du détail uniquement ; aucune mutation bancaire, migration, modification de RLS, élévation de droits ou publication en production.

Présentation issue de la maquette : bandeau de synthèse à six champs, cinq onglets (Aperçu, Détails du paiement, Réconciliation, Documents, Historique), aperçu financier avec anneau, chronologie, statut, coordonnées du client, données bancaires et pièces associées. Le cadre national et ses tokens restent partagés avec les autres écrans. Les recommandations des compétences `senior-frontend` et `ui-ux-pro-max` ont guidé la séparation contrôleur/vue, les états explicites et la navigation clavier ; la maquette et le design system existant priment sur les propositions génériques.

## Sources et invariants

- Lecture du paiement autorisé avant sa vente. Toutes les requêtes utilisent le client authentifié et les identifiants provenant du parent, jamais un périmètre fourni par l’URL.
- Registre des versements paginé par 500, filtré par `sale_id`. Une lecture échouée/incomplète n’est pas remplacée par un registre vide ni un solde nul.
- Documents et événements amont issus de `snp_dossier_complet('paiement', id)`, procédure existante SECURITY INVOKER. Les liens existants remontent production, expédition/fret, analyse raffinerie, conciliation, vente et règlements.
- Les événements absents ne sont pas inventés et l’échec du dossier est signalé localement. L’historique complet est chronologique, filtrable par étape et paginé ; l’aperçu présente les derniers événements enregistrés des étapes clés et du paiement consulté.
- L’encaissement confirmé inclut exclusivement les paiements `approved`, non virtuels, dans la devise de règlement. Les versements `processing` restent à rapprocher. Les montants reçus dans une devise étrangère ne sont pas additionnés aux montants convertis de règlement.
- Un paiement confirmé partiel n’entraîne pas la mention « Vente entièrement réglée ». Aucun double comptage des avances ni réapplication de l’écart de conciliation au montant définitif de la vente.
- Les comptes bancaires sont lus uniquement via leurs identifiants enregistrés ; le compte émetteur est en plus limité au client de la vente.
- Les documents sont dédupliqués par bucket et chemin canonique. Le justificatif de l’en-tête correspond au paiement consulté, pas au justificatif arbitraire d’un autre versement.
- Téléchargements signés à la demande pour 300 secondes ; les anciennes URL Storage sont recanonisées et resignées. Les URL externes arbitraires, traversées de chemin et buckets inconnus/fermés ne sont pas ouverts. Les pièces de référence restent visibles sans action trompeuse.
- Le bouton de la maquette « Télécharger le reçu » est présenté comme « Télécharger le justificatif » lorsqu’il s’agit réellement d’une preuve bancaire. Aucun reçu officiel ni confirmation externe de banque n’est fabriqué.
- Aucun rafraîchissement lié au focus ou au renouvellement équivalent de session. Les filtres et l’onglet restent en place lors de l’actualisation manuelle. Un changement réel d’identité/périmètre ou d’URL masque immédiatement le dossier précédent et annule lectures et téléchargement.

## Vérifications

- 38 tests ciblés : modèle financier/chronologie (9), interactions et conservation des ajustements fiscaux (11), service et documents privés (10), contrôleur et isolation (8).
- `npm run lint` : réussi.
- `npm run typecheck` : réussi, couverture des relations Supabase incluse.
- Contrôle navigateur du composant réel dans un point d’entrée isolé : 375, 768, 1280 et 1688 pixels, sans débordement global ; filtres documentaires, chronologie et déclenchement de téléchargement contrôlés.
- Les données synthétiques du banc visuel sont exclues de la route de production. Aucun paiement ni document réel n’a été créé pendant les essais.
- Premier passage global : 253 fichiers, 1 952 tests réussis sur 1 953 ; un test existant du formulaire d’enregistrement a dépassé l’attente par défaut d’une seconde de Testing Library lors du chargement des comptes bancaires. Le fichier complet repasse isolément (10/10). L’attente ciblée a été portée à dix secondes, sans suppression d’assertion ni modification du formulaire.
- Contre-analyse globale : 234 fichiers et 1 801 tests réussis ; 19 fichiers n’ont pas démarré (timeout du pool de workers, sortie 1). Relance avec `--maxWorkers=2` des 19 fichiers concernés et des cinq fichiers paiement : **24 fichiers / 201 tests réussis**, sortie 0, dont les 153 tests manquants et 48 tests paiement déjà comptés. Au total, les **253 fichiers / 1 954 tests distincts** sont validés en plusieurs passages, et non dans une exécution monolithique sans incident. Le test fiscal ajouté explique le passage de 1 953 à 1 954 tests.
- Compilation finale `npm run build` : réussie, génération PWA comprise. Le détail reste chargé à la demande (`PaymentDetailsPage-qcZYEwAH.js`, 30 738 octets ; CSS, 14 464 octets). Les données du banc visuel sont absentes du bundle de production.
- Contrôle final du compilateur TypeScript et lint des fichiers touchés : réussis. La version locale recompilée répond HTTP 200 sur `http://127.0.0.1:5180/payments` ; aucune publication distante.
- Dernier contrôle des deux nouveaux fichiers de tests d’interface après attente explicite des opérations asynchrones : 19/19 réussis, sans avertissement React `act`, et lint réussi. Le test de changement de compte annule bien un téléchargement encore en cours, et non seulement un téléchargement déjà terminé.

## Limites de vérification

Les rattachements et la lecture signée sont couverts par tests automatisés et par la réutilisation du dossier serveur existant. Aucun essai de téléchargement avec une session utilisateur réelle ni de mutation bancaire distante n’a été effectué. Les tests visuels ne prétendent pas reproduire les chiffres fictifs ni les incohérences comptables de la maquette.
