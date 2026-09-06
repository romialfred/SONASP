# Affiliations & Cartes — Faso SANAMA

## Audit et périmètre

Référence : e6749a3c, branche SONASP_2026. Le schéma distant a été inspecté en lecture seule le 6 septembre 2026. Les formulaires de création/modification des artisans et sites ne sont pas modifiés. Le travail de connexion préexistant est conservé.

Le système historique créait une carte en_cours avec une durée arbitraire de 730 jours ; le renouvellement réécrivait la même ligne. Certaines listes assimilaient validation et activation. Aucun barème ni encaissement d’adhésion n’existait. Les paiements artisan existants règlent des factures de vente d’or, avec taxes et effets de stock : ils ne sont pas réutilisés comme encaissements d’adhésion.

## Parcours

1. Enregistrer le dossier artisan, le titulaire et sa photographie. La carte reste non validée, sans période effective.
2. Dans Carte professionnelle, générer les deux faces. Un instantané fige identité, rôle, nom réel du site, commune et photographie. Pour une société, le responsable physique et la société sont imprimés ; l’aide exploitant reprend le site de son exploitant.
3. Un autre agent habilité valide cette émission. Un refus est motivé. La validation n’active pas la carte.
4. Dans Affiliations & Cartes → Barèmes, définir explicitement rôle, montant, devise, durée, fuseau et seuil d’alerte. Aucun tarif de démonstration ni dispense n’est introduit.
5. Établir les droits avec début et fin inclus, conformes à la durée du barème. Les périodes ne se chevauchent pas.
6. Enregistrer les paiements, éventuellement partiels, avec référence, montant, mode et date. Un agent différent confirme les encaissements. Une promesse ou un paiement non confirmé ne vaut pas règlement.
7. Après validation et règlement intégral, confirmer puis cliquer Activer la carte. Le serveur revérifie habilitation, session AAL2, périmètre, version, montant et période dans une transaction. Le rendu définitif reprend l’identité validée. Un échec se reprend sans activation ni facturation supplémentaire.

Convention retenue : activation manuelle séparée, selon le document détaillé. La question posée sur l’ambiguïté du message initial est restée sans réponse ; cette hypothèse a été annoncée pendant le travail. Les dates des droits sont explicitement saisies comme demandé par l’utilisateur ; elles ne sont pas décalées silencieusement à l’activation. Une période future reste « Validité à venir ». La date imprimée de délivrance correspond à l’activation.

Les sélections de ventes et nouveaux règlements exigent une affiliation effectivement active. Des triggers appliquent aussi ce contrôle côté serveur. Les créances et règlements historiques restent consultables ; les dettes des membres inéligibles ne sont pas masquées.

## Corrections et suivi

Une correction crée une version distincte avec motif et nouveau contrôle. Pour la même période, les droits gardent leur encaissement d’origine, sans réutilisation pour un autre membre ou une autre période. L’activation de la correction remplace l’ancien titre, dont le QR indique « Remplacée ». Un rôle modifié doit disposer de droits compatibles.

Le renouvellement crée une nouvelle émission avec ses propres droits. Il ne réécrit pas les dates de l’ancienne carte. Suspension, annulation et refus nécessitent un motif. La levée de suspension exige un nouveau contrôle et une activation manuelle.

Les annulations et remboursements de paiements restent historisés ; une carte aux droits insuffisants passe à « Droits à réexaminer » et perd son éligibilité. Une échéance erronée peut être annulée après révision de tous ses encaissements ; la reprise utilise une nouvelle émission.

## Rendu, confidentialité et validité

Modèle déterministe faso-sanama-id1-v1. Les en-têtes sont extraits du PDF fourni, sans redessiner le logo et sans reprendre ses données de démonstration. Portrait recadré sans déformation, fontes Roboto embarquées, ajustement des textes selon les métriques des fontes, QR réellement généré.

PNG : 1011 × 638 pixels, densité enregistrée de 300 ppp. PDF : deux pages de 85,60 × 53,98 mm. Chemins privés, empreintes SHA-256, version, révision et état du rendu sont persistés. Un bail de rendu évite les traitements simultanés d’une révision. Le portrait figé est conservé pour la délivrance définitive.

Le bucket affiliation-cards est privé, avec RLS de périmètre et interdiction des mutations directes. Seul le service serveur peut confirmer le rendu. Les photographies corrompues/trop grandes et les ressources externes sont refusées. Aucun JWT, URL privée ou détail SQL n’est retourné dans les erreurs.

Le QR utilise un token opaque propre au titre ; le token provisoire est invalidé lors de l’activation définitive. La page publique renvoie uniquement numéro d’affiliation, version, statut, période et date de contrôle. Les informations personnelles et financières restent privées. Une indisponibilité ne vaut jamais validation.

Statut et compteur utilisent l’heure serveur et le fuseau du barème. La fin est incluse ; le dernier jour affiche « Expire aujourd’hui ». Actualisation au retour sur la page et toutes les minutes. Balayage horizontal de 380 ms, commandes clavier et respect de prefers-reduced-motion.

## Migration et mise en service

Migration additive : supabase/migrations/20260906134228_affiliations_cartes_faso_sanama.sql. Trois tables d’adhésion, instantanés et versions de carte, RPC, audit, stockage privé, protections des ventes/règlements. Le catalogue est mis à jour ; aucune ancienne migration n’est réécrite.

Nouvelles capacités sensibles : artisan.membership.manage, artisan.membership.confirm, artisan.cards.activate, en complément de artisan.cards.manage. Plafond administrateur, autorité du serveur sur les capacités effectives. Deux agents habilités sont nécessaires au double contrôle.

La tâche affiliation-card-expiry est planifiée chaque heure à la minute 15 si pg_cron existe. L’extension a été vérifiée présente sur le projet distant. Elle matérialise les expirations et prépare des alertes dédupliquées dans l’outbox existante ; aucun envoi externe ni activation automatique. Un retard de tâche ne prolonge pas la validité. L’expiration ne désactive pas administrativement le dossier artisan.

Avant mise en service :

1. Examiner la migration exacte, son dry-run et les dossiers hérités. Ne pas réparer l’historique divergent des migrations automatiquement.
2. Définir les vrais barèmes et habilitations. Aucune adhésion payée n’est déduite des anciennes cartes : les nouvelles opérations seront bloquées tant que les membres ne sont pas régularisés.
3. Déployer affiliation-card-render avec ses static_files ; configurer AFFILIATION_PUBLIC_ORIGIN avec l’origine HTTPS publique réelle. Les clés Supabase restent côté serveur.
4. Publier depuis le commit revu après les gardes de livraison. Vérifier le parcours avec des comptes de test autorisés sur l’environnement cible : RLS, Storage, double contrôle, activation et concurrence réelle.

État de cette session : migration et fonction préparées et testées localement ; aucune migration distante, publication ni activation de membre réel exécutée. Le travail de connexion n’est pas publié implicitement avec ce lot.

## Vérifications reproductibles

- npm run test:affiliations : contrats SQL dans PGlite isolé et tests UI/passerelle.
- npm run test:registry : inclut désormais les contrats SQL d’affiliation dans les gardes des prochaines livraisons, avec les protections des formulaires artisan et sites.
- npm run typecheck ; npm run lint ; npm run build ; suite Vitest ; catalogue d’intégrité.
- Rendu réel : deno run --node-modules-dir=none --allow-read --allow-write=docs/affiliation-qa --allow-env scripts/test-affiliation-render.ts. Imports npm épinglés, dépendances conservées dans deno.lock.
- Contrôle visuel : npx vite --config docs/affiliation-qa/vite.config.ts sur 127.0.0.1:5182. Le vrai composant utilise un service isolé de test, hors routage de production.

Pièces dans docs/affiliation-qa : PNG recto/verso, noms longs, PDF et captures mobile/ordinateur. Les identités sont fictives et les QR pointent vers verification.example.test. L’état actif affiché dans les captures est une fixture, sans paiement ni activation distante.

Limites : QR décodé depuis le PNG, sans essai physique d’impression ni téléphone. Les tests SQL exécutent les nouvelles fonctions sur un socle de schéma et des profils isolés ; ils ne remplacent pas une recette Supabase hébergée avec comptes autorisés, stockage réel et connexions concurrentes. Celle-ci reste nécessaire à la mise en service.

## Résultats du 6 septembre 2026

- 56 contrats SQL réussis sur base isolée, dont refus d’activation sans droits confirmés, AAL1/session révoquée/hors périmètre, idempotence, montants non finis, correction sans double affectation, suspension, expiration, alertes sans doublon, personne morale et aide exploitant.
- 20 tests ciblés carte/dossier/QR/passerelle réussis ; 70 contrôles ciblés incluant détails artisan, ventes et règlements réussis lors de l’intégration.
- Suite globale : 334 fichiers, 2 422 tests exécutés ; 2 421 réussis et un oubli de traduction du nouveau menu détecté. Cet oubli est corrigé ; les 59 tests navigation/composants/public concernés passent après correction. La suite globale entière n’a pas été relancée après cette correction de libellé.
- Typage Supabase et TypeScript, lint global et contrôle des libellés français réussis. Compilation Vite réussie. Catalogue et dix tests d’intégrité des migrations réussis.
- Deno check de la fonction Edge réussi. Rendu exécuté réellement, PNG et PDF inspectés ; QR décodé depuis le PNG, densité vérifiée à 300 ppp, pages PDF mesurées à 85,60 × 53,98 mm.
- Interface du vrai composant observée à 360, 768, 1366 et 1920 pixels : aucun débordement horizontal ; balayage au clic, une seule face accessible, compteur serveur simulé et commandes séparées. Le clavier est couvert par les tests du composant ; la réduction des animations est prévue par la règle CSS, sans émulation OS réalisée.
