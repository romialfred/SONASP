# Audit Expéditions, fret et douane — 31 août 2026

## Périmètre

Contre-analyse du registre des préparations, du formulaire de préparation, des expéditions fret, des formalités douanières, de leurs documents, statuts, références, permissions et états d'erreur. Les références métier, identifiants, routes, valeurs d'enum et règles RLS existantes n'ont pas été renommés pour traduire l'interface.

## Défauts confirmés

1. Les lectures PostgREST de `freight_customs_operations` étaient ambiguës : deux clés étrangères relient certaines paires de tables. L'API refusait l'embed et exposait son message technique à l'utilisateur.
2. Plusieurs écrans utilisaient les anciens noms `reference_number`, `shipment_date`, `total_weight_grams` et `transport_company_id` au lieu des colonnes canoniques des préparations.
3. Une panne de lecture était rendue comme une liste vide, ce qui confondait « aucun dossier » et « accès/chargement impossible ».
4. La création fret ne renseignait pas `mining_company_id` alors que la base impose la cohérence avec `shipping_preparation_id`.
5. Plusieurs préparations de sociétés différentes pouvaient être agrégées côté client sans contrôle explicite.
6. Le statut de `freight_shipments` pouvait encore être écrit directement par un ancien service, sans graphe serveur ni contrôle optimiste.
7. Les messages d'erreur affichaient des détails SQL/PostgREST et les formulaires ne protégeaient pas systématiquement contre le double clic ou une reprise après enregistrement partiel.
8. Le module mélangeait du français et de l'anglais et présentait des formulaires longs sans hiérarchie opérationnelle.

## Corrections réalisées

- Relations PostgREST désambiguïsées par les noms exacts de clés étrangères ; les colonnes et relations canoniques sont utilisées.
- Registre commun Expéditions/Fret/Douane : indicateurs cohérents, recherche, filtres combinables, période, société, statut, pagination, distinction panne/liste vide et bouton de reprise.
- Nouveau formulaire de préparation restructuré en quatre étapes, résumé de contrôle, prévisualisation compacte, validations de poids, licence, scellés, transporteur et raffinerie.
- Création fret : vérification de visibilité RLS, statut éligible, lots non déjà consommés, quantités positives, absence de doublons, société unique et transmission explicite de `mining_company_id`.
- Reprise contrôlée d'un enregistrement parent partiel : l'identifiant existant est présenté et aucune nouvelle expédition n'est recréée silencieusement.
- Formalités douanières : création et changement de statut par RPC existantes, habilitations fail-closed, données obsolètes non présentées comme fiables.
- Erreurs : nouvelle boîte modale accessible (`alertdialog`), piège de focus, restauration du focus, fermeture clavier, consigne de récupération et code diagnostic assaini. Aucun SQL, jeton, URL privée ou message PostgREST brut n'est affiché.
- Interface du périmètre Expéditions/Fret/Douane en anglais, langue par défaut anglaise et traduction de présentation du menu principal sans modification des clés métier.
- Aucun rafraîchissement automatique au retour de focus n'a été ajouté au module refondu.

## Workflow serveur proposé et implémenté localement

La migration `20260831223000_durcir_workflow_freight_shipments.sql` ajoute :

- dérivation serveur du tenant depuis la préparation ;
- immutabilité de la référence, du parent, du tenant et du créateur ;
- horodatages et acteurs de transition imposés par trigger ;
- contrôle de version par statut attendu ;
- MFA, capability et périmètre tenant pour les transitions sensibles ;
- RLS de lecture/écriture sur `freight_shipments` ;
- graphe autorisé :
  - `pending → approved` (`freight.customs.approve`) ;
  - `approved → shipped_to_refinery` (`freight.transport.dispatch`) ;
  - `shipped_to_refinery → received_at_refinery` (`refining.supervise`) ;
  - `received_at_refinery → processing` (`refining.supervise`) ;
  - `processing → processed` (`refining.supervise`) ;
  - `processed → in_stock` reste réservé au RPC d'entrée en stock et à son écriture de grand livre.

Le client appelle prioritairement ce RPC. Un repli de compatibilité n'est autorisé que si la fonction est absente (`PGRST202`/`42883`), jamais après un refus d'accès, une erreur de validation ou un conflit.

## Vérifications exécutées

- Services fret/douane et transitions : tests de relations explicites, périmètre, société unique, lots déjà affectés, création partielle, transition RPC et refus sans repli.
- Pages de création : tests d'échec de chargement, absence de fausse liste vide, verrouillage double clic et reprise d'un parent déjà créé.
- Fenêtre d'erreur : tests de rôle ARIA, focus, clavier et assainissement des détails.
- Type coverage Supabase validée.
- Audit ciblé de langue : 0 candidat dans `src/pages/shipping`, `src/pages/freight` et `src/components/freight` ; un nom légal SONASP reste volontairement inchangé dans `DynamicPackingList`.
- Compilation de production Vite validée avant la présente contre-analyse ; le compilateur TypeScript et les tests ciblés sont rejoués après les derniers durcissements.

## Limites et actions nécessitant une décision

1. La migration de durcissement est créée localement mais **n'est pas appliquée à la base distante** dans cette intervention. Son déploiement doit être explicitement autorisé et accompagné d'un test Owner/Admin/Mine/Raffinerie avec MFA.
2. La totalité de la plateforme n'est pas encore anglaise. L'inventaire AST global relève 7 718 chaînes candidates dans les modules historiques ; le lot Expéditions/Fret/Douane est traité. Une substitution automatique globale risquerait de modifier des libellés légaux, données, références et règles métier. La suite doit être migrée module par module avec tests.
3. La vérification visuelle privée exige une session Owner active. La route publique locale répond, mais aucune authentification privée n'a été simulée ni contournée.
4. La création fret reste constituée de plusieurs écritures côté client. La reprise est désormais déterministe et les doublons sont bloqués, mais une future RPC transactionnelle unique serait le niveau final pour garantir l'atomicité parent/lots/signataires.
