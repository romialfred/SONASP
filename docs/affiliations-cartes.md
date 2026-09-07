# Affiliations & Cartes — Faso SANAMA

## Audit et périmètre

Le module distingue le dossier d’affiliation, le paiement des droits, les fichiers de la carte, le contrôle documentaire et l’activation. La refonte du 7 septembre 2026 concerne le registre et la fiche détaillée ; les formulaires de création/modification des artisans et des sites restent inchangés.

Le système historique créait une carte en_cours avec une durée arbitraire de 730 jours ; le renouvellement réécrivait la même ligne. Certaines listes assimilaient validation et activation. Aucun barème ni encaissement d’adhésion n’existait. Les paiements artisan existants règlent des factures de vente d’or, avec taxes et effets de stock : ils ne sont pas réutilisés comme encaissements d’adhésion.

## Parcours

1. Enregistrer le dossier artisan, le titulaire et sa photographie. Une référence et une émission en cours peuvent exister sans générer les fichiers de la carte et sans rendre le membre éligible aux opérations.
2. Dans **Affiliations & Cartes → Barèmes d’adhésion**, un administrateur habilité définit un barème réel : rôle, montant, devise, durée, fuseau et seuil d’alerte. Aucun tarif de démonstration ni dispense n’est créé automatiquement.
3. Ouvrir le dossier depuis le registre et **Configurer les droits**. Choisir l’année, le barème applicable et la date de début ; la date de fin incluse est calculée selon la durée du barème. L’année désigne celle du début de la période, qui peut se prolonger sur l’année suivante. Les périodes d’un même membre ne se chevauchent pas. À cette étape, `snp_preparer_carte_affiliation` peut figer l’identité et les références du dossier ; cette préparation interne ne produit aucun PNG ni PDF.
4. **Enregistrer le paiement** dans la fiche : année d’affiliation, date de paiement, lieu de paiement et preuve jointe. Le montant proposé est le solde disponible ; le montant, le mode et la référence du reçu restent enregistrés pour le contrôle comptable. Les règlements partiels sont possibles. L’année doit correspondre aux droits et la date de paiement ne peut pas être future.
5. Un **autre agent habilité confirme** le paiement après vérification du justificatif. Un reçu saisi, une promesse ou un règlement partiel ne suffit pas à autoriser la génération. Dès que le montant intégral est confirmé, la génération des deux faces est déclenchée si l’agent possède aussi l’habilitation de carte ; sinon un agent habilité utilise **Générer les deux faces**. Les RPC de demande et de finalisation du rendu vérifient toutes deux le paiement, y compris si un remboursement intervient pendant la génération.
6. Un agent différent de l’émetteur effectue le **Contrôle documentaire** de l’identité, du rattachement et des informations de la carte, puis valide l’émission. Les demandes de correction, suspensions et annulations sont motivées. La validation documentaire reste distincte de l’activation.
7. Après règlement intégral confirmé et validation documentaire, un agent habilité confirme puis clique **Activer la carte**. Le serveur revérifie la session AAL2, le périmètre, le titulaire actif, le rôle, le montant et la période dans une transaction. Un nouveau rendu définitif reprend l’identité contrôlée, les dates effectives et un nouveau token de vérification. Un échec du rendu après confirmation du paiement ou activation ne doit jamais entraîner la saisie d’un second paiement : reprendre la génération depuis l’état conservé par le serveur.

L’activation demeure manuelle. Les dates des droits sont conservées ; elles ne sont pas décalées à l’activation. Une période future reste **Validité à venir** et ne rend pas encore le membre éligible. La date imprimée de délivrance correspond à l’activation ; la date de fin est celle des droits réglés.

Les sélections de ventes et nouveaux règlements exigent une affiliation effectivement active. Des triggers appliquent aussi ce contrôle côté serveur. Les créances et règlements historiques restent consultables ; les dettes des membres inéligibles ne sont pas masquées.

## Corrections et suivi

Une correction crée une version distincte avec motif et nouveau contrôle. Pour la même période, les droits gardent leur encaissement d’origine, sans réutilisation pour un autre membre ou une autre période. L’activation de la correction remplace l’ancien titre, dont le QR indique « Remplacée ». Un rôle modifié doit disposer de droits compatibles.

Le renouvellement crée une nouvelle émission avec ses propres droits. Il ne réécrit pas les dates de l’ancienne carte. Suspension, annulation et refus nécessitent un motif. La levée de suspension exige un nouveau contrôle et une activation manuelle.

Les annulations et remboursements de paiements restent historisés ; une carte aux droits insuffisants passe à « Droits à réexaminer » et perd son éligibilité. Une échéance erronée peut être annulée après révision de tous ses encaissements ; la reprise utilise une nouvelle émission.

## Rendu, confidentialité et validité

Modèle déterministe faso-sanama-id1-v1. Les en-têtes sont extraits du PDF fourni, sans redessiner le logo et sans reprendre ses données de démonstration. Portrait recadré sans déformation, fontes Roboto embarquées, ajustement des textes selon les métriques des fontes, QR réellement généré.

PNG : 1011 × 638 pixels, densité enregistrée de 300 ppp. PDF : deux pages de 85,60 × 53,98 mm. Chemins privés, empreintes SHA-256, version, révision et état du rendu sont persistés. Un bail de rendu évite les traitements simultanés d’une révision. Le portrait figé est conservé pour la délivrance définitive.

Le bucket affiliation-cards est privé, avec RLS de périmètre et interdiction des mutations directes. Seul le service serveur peut confirmer le rendu. Les photographies corrompues/trop grandes et les ressources externes sont refusées. Aucun JWT, URL privée ou détail SQL n’est retourné dans les erreurs.

Les justificatifs d’adhésion sont déposés par l’Edge **affiliation-payment-proof-upload** dans le bucket privé **affiliation-payment-proofs**. PDF, JPEG et PNG sont acceptés jusqu’à 5 Mo. Le serveur vérifie le nom, l’extension, le MIME et la structure du contenu avec le validateur partagé. Le rattachement au membre et l’auteur viennent de la session et des droits en base, jamais d’un tenant fourni par le navigateur. Le chemin, l’empreinte SHA-256, le type, la taille et l’auteur sont conservés dans `snp_adhesion_preuves` ; le reçu référence cette preuve immuable.

Le dépôt seul n’est pas un paiement : le RPC d’encaissement vérifie à nouveau le dossier, l’auteur du dépôt et l’objet Storage avant de créer le reçu. Une relance avec la même clé et les mêmes informations est idempotente ; une clé réutilisée pour un autre paiement est refusée. Une réponse réseau incertaine ne déclenche pas la suppression d’un justificatif déjà référencé. Les anciens reçus ne sont pas réécrits et gardent des champs année/lieu/preuve nuls lorsqu’ils n’étaient pas collectés.

Les lecteurs autorisés du registre reçoivent le statut et la période des droits. Les montants exacts, sommes confirmées/en attente et devises sont transmis uniquement avec les habilitations financières `artisan.membership.manage`, `artisan.membership.confirm` ou `artisan.cards.activate`, en cohérence avec les règles de lecture des encaissements. Une URL signée de document est temporaire et reste soumise au périmètre du membre.

Le QR utilise un token opaque propre au titre ; le token provisoire est invalidé lors de l’activation définitive. La page publique renvoie uniquement numéro d’affiliation, version, statut, période et date de contrôle. Les informations personnelles et financières restent privées. Une indisponibilité ne vaut jamais validation.

Statut et compteur utilisent l’heure serveur et le fuseau du barème. La fin est incluse ; le dernier jour affiche « Expire aujourd’hui ». Actualisation au retour sur la page et toutes les minutes. Balayage horizontal de 380 ms, commandes clavier et respect de prefers-reduced-motion.

## Migration et mise en service

Migration additive : supabase/migrations/20260906134228_affiliations_cartes_faso_sanama.sql. Trois tables d’adhésion, instantanés et versions de carte, RPC, audit, stockage privé, protections des ventes/règlements. Le catalogue est mis à jour ; aucune ancienne migration n’est réécrite.

Complément du 7 septembre : `supabase/migrations/20260906235254_affiliation_payment_evidence_and_paid_generation.sql`. Il ajoute les métadonnées du reçu et les preuves privées, impose le paiement confirmé avant tout nouveau rendu, enrichit le registre sans exposer les montants aux lecteurs non financiers et autorise la préparation interne du dossier aux gestionnaires des droits. L’ancienne signature de saisie sans justificatif est refusée ; la nouvelle interface et son contrat doivent donc être publiés dans la même séquence.

Nouvelles capacités sensibles : artisan.membership.manage, artisan.membership.confirm, artisan.cards.activate, en complément de artisan.cards.manage. Plafond administrateur, autorité du serveur sur les capacités effectives. Deux agents habilités sont nécessaires au double contrôle.

La tâche affiliation-card-expiry est planifiée chaque heure à la minute 15 si pg_cron existe. L’extension a été vérifiée présente sur le projet distant. Elle matérialise les expirations et prépare des alertes dédupliquées dans l’outbox existante ; aucun envoi externe ni activation automatique. Un retard de tâche ne prolonge pas la validité. L’expiration ne désactive pas administrativement le dossier artisan.

Avant mise en service :

1. Examiner la migration exacte, le catalogue, le dry-run et les dossiers hérités. Ne pas réparer l’historique divergent des migrations automatiquement.
2. Utiliser `scripts/release/deploy-affiliation-payment-evidence.mjs` avec les modes `backup`, `rehearse`, `apply`, puis `verify`, le chemin du CLI Supabase et un nouveau dossier privé sous `backups/`. La répétition applique le SQL dans une transaction annulée et vérifie le retour du schéma ; l’application conserve les empreintes des anciens champs métier et inscrit la version avec son SQL exact dans la même transaction. Une seconde application vérifie l’état et le checksum sans rejouer la migration.
3. Déployer séparément **affiliation-payment-proof-upload** après la migration. Conserver les clés Supabase côté serveur. Le handler vérifie le JWT avec GoTrue, l’AAL2, la session et les droits du membre ; `verify_jwt=false` permet au prévol CORS d’atteindre ce handler et ne constitue pas une ouverture anonyme.
4. Conserver **affiliation-card-render** et ses fichiers statiques, avec `AFFILIATION_PUBLIC_ORIGIN` fixé à l’origine HTTPS réelle. Les contrôles de paiement sont effectués par ses RPC corrigées ; un redéploiement du rendu est nécessaire seulement si son code ou ses ressources changent.
5. Publier le frontend depuis le commit revu, puis vérifier la version servie et le parcours avec des comptes autorisés : saisie, dépôt Storage, persistance, contrôle indépendant, rendu, activation, expiration et refus hors périmètre.
6. Définir les vrais barèmes et habilitations avant le premier paiement. **L’inspection live du 7 septembre 2026 constatait zéro barème, zéro droit et zéro encaissement d’adhésion.** Aucun montant ne doit être inventé. Deux agents habilités sont nécessaires au double contrôle. Aucune adhésion payée n’est déduite des anciennes cartes ; les membres doivent être régularisés pour devenir éligibles aux nouvelles opérations.

Inspection du 7 septembre 2026 : prérequis d’affiliation présent, nouvelles table/colonnes/bucket absents, cinq fonctions remplacées identiques à la version canonique, RLS et restrictions existantes conformes. Le mode `backup` a sauvegardé schéma et empreintes de huit tables dans `backups/affiliation-evidence-release-20260907-v2`, sans exporter de dossiers métier. Ce constat est antérieur à la publication du lot ; il ne constitue pas une preuve de déploiement. Les étapes `rehearse`, `apply`, `verify` et la recette hébergée doivent être attestées dans le compte rendu de publication.

## Vérifications reproductibles

- npm run test:affiliations : contrats SQL dans PGlite isolé et tests UI/passerelle.
- `node scripts/test-affiliation-migration.mjs` : ancien cycle historique et nouveau cycle payé → rendu → contrôle → activation ; preuves obligatoires, refus partiel, double contrôle, remboursement pendant rendu, confidentialité des montants et lecture des preuves par l’agent chargé de l’activation sans accès hors périmètre.
- `node scripts/test-affiliation-release.mjs` : exécute le véritable script de publication contre PostgreSQL/PGlite isolé avec un reçu historique ; sauvegarde, répétition avec rollback, application, quinze contrôles et réapplication idempotente.
- `npx vitest run src/services/affiliationService.test.ts supabase/functions/affiliation-payment-proof-upload/handler.test.ts` : contrat client, refus de preuve incorrecte, validation du contenu, périmètre transmis, limites de taille et erreurs privées.
- npm run test:registry : inclut désormais les contrats SQL d’affiliation dans les gardes des prochaines livraisons, avec les protections des formulaires artisan et sites.
- npm run typecheck ; npm run lint ; npm run build ; suite Vitest ; catalogue d’intégrité.
- Rendu réel : deno run --node-modules-dir=none --allow-read --allow-write=docs/affiliation-qa --allow-env scripts/test-affiliation-render.ts. Imports npm épinglés, dépendances conservées dans deno.lock.
- Contrôle visuel : npx vite --config docs/affiliation-qa/vite.config.ts sur 127.0.0.1:5182. Le vrai composant utilise un service isolé de test, hors routage de production.

Pièces dans docs/affiliation-qa : PNG recto/verso, noms longs, PDF et captures mobile/ordinateur. Les identités sont fictives et les QR pointent vers verification.example.test. L’état actif affiché dans les captures est une fixture, sans paiement ni activation distante.

Limites : QR décodé depuis le PNG, sans essai physique d’impression ni téléphone. Les tests SQL exécutent les nouvelles fonctions sur un socle de schéma et des profils isolés ; ils ne remplacent pas une recette Supabase hébergée avec comptes autorisés, stockage réel et connexions concurrentes. Un dépôt de justificatif abandonné avant création du reçu reste privé et lié à son dossier ; aucune purge automatique de ces dépôts n’est introduite dans ce lot. Le contrôle structurel des fichiers n’est pas un antivirus.

## Historique de validation du premier lot, 6 septembre 2026

Ces résultats décrivent le premier lot et ne valent pas validation du correctif du 7 septembre.

- 56 contrats SQL réussis sur base isolée, dont refus d’activation sans droits confirmés, AAL1/session révoquée/hors périmètre, idempotence, montants non finis, correction sans double affectation, suspension, expiration, alertes sans doublon, personne morale et aide exploitant.
- 20 tests ciblés carte/dossier/QR/passerelle réussis ; 70 contrôles ciblés incluant détails artisan, ventes et règlements réussis lors de l’intégration.
- Suite globale : 334 fichiers, 2 422 tests exécutés ; 2 421 réussis et un oubli de traduction du nouveau menu détecté. Cet oubli est corrigé ; les 59 tests navigation/composants/public concernés passent après correction. La suite globale entière n’a pas été relancée après cette correction de libellé.
- Typage Supabase et TypeScript, lint global et contrôle des libellés français réussis. Compilation Vite réussie. Catalogue et dix tests d’intégrité des migrations réussis.
- Deno check de la fonction Edge réussi. Rendu exécuté réellement, PNG et PDF inspectés ; QR décodé depuis le PNG, densité vérifiée à 300 ppp, pages PDF mesurées à 85,60 × 53,98 mm.
- Interface du vrai composant observée à 360, 768, 1366 et 1920 pixels : aucun débordement horizontal ; balayage au clic, une seule face accessible, compteur serveur simulé et commandes séparées. Le clavier est couvert par les tests du composant ; la réduction des animations est prévue par la règle CSS, sans émulation OS réalisée.
