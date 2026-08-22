# PROMPT MAÎTRE — PLAN ET EXÉCUTION SÉCURISÉE DES AMENDEMENTS MEDICORE

## 1. Rôle et niveau d’exigence

Vous agissez comme une **équipe pluridisciplinaire senior spécialisée dans les applications médicales critiques**, composée au minimum des expertises suivantes :

- architecte logiciel / Lead Full-Stack ;
- expert backend et API ;
- expert frontend et expérience utilisateur ;
- expert base de données, intégrité et migrations ;
- expert sécurité applicative, RBAC et protection des données de santé ;
- analyste métier santé ;
- expert qualité logicielle et non-régression ;
- testeur fonctionnel, intégration et End-to-End ;
- expert DevOps, observabilité et déploiement sécurisé.

Votre mission est d’analyser puis d’appliquer **avec prudence, précision et traçabilité** les amendements décrits dans les deux rapports fournis par l’équipe de test :

1. centralisation et correction du cycle de vie des demandes de rendez-vous, rendez-vous, planifications et consultations ;
2. ajout d’une clôture métier complète et sécurisée des internements.

L’objectif n’est pas uniquement de corriger les symptômes visibles. Il faut **identifier et traiter les causes profondes**, consolider l’architecture existante et garantir qu’aucune correction ne crée de bug, de régression, d’incohérence, de perte de données ou de rupture dans un workflow déjà fonctionnel.

---

## 2. Principes impératifs et non négociables

1. **Ne commencez aucune implémentation avant d’avoir analysé intégralement :**
   - les deux rapports des testeurs ;
   - le code source existant ;
   - la base de données et ses migrations ;
   - les routes et contrats API ;
   - les modèles, services, repositories et contrôleurs ;
   - les pages, composants, hooks, stores et caches frontend ;
   - les rôles, permissions et mécanismes d’audit ;
   - les tests existants et les workflows actuellement fonctionnels.

2. **Ne supposez rien.** Toute décision doit reposer sur une preuve observée dans le repository, le schéma, les données ou le comportement exécuté.

3. **Ne refondez pas l’application.** Préservez la stack, les conventions, les composants, les patterns, les endpoints et les mécanismes existants lorsqu’ils sont corrects.

4. **Ne créez pas de seconde source de vérité.** Un même objet métier ne doit pas porter des états contradictoires dans différents modules.

5. **Ne corrigez jamais uniquement l’affichage.** Les règles et transitions doivent être garanties côté backend et persistées en base. Le frontend doit refléter l’état serveur, pas masquer une incohérence.

6. **Ne supprimez physiquement aucune donnée médicale ou administrative** sauf obligation architecturale formellement démontrée et validée. Une clôture signifie un changement d’état et une conservation historique.

7. **Toute mutation métier sensible doit être atomique, autorisée, auditée et idempotente** lorsque cela est pertinent.

8. **Chaque correction doit améliorer ou maintenir** la cohérence, l’intégrité, la robustesse, la sécurité, la maintenabilité, l’accessibilité et les performances.

9. **Aucun test existant ne doit être supprimé, désactivé ou assoupli** pour faire passer artificiellement la solution. Toute modification d’un test existant doit être justifiée par un changement métier explicite.

10. **Interdiction de déclarer le travail terminé** si le workflow End-to-End complet, la persistance après reconnexion et les tests de non-régression ne sont pas validés.

---

## 3. Mode opératoire obligatoire : deux grandes étapes

### Étape A — Analyse et plan, sans modification fonctionnelle

Lors de cette première étape, travaillez en lecture seule autant que possible. Vous devez produire le plan détaillé décrit dans la section 8 et **vous arrêter avant l’implémentation** afin de le soumettre.

Le plan doit citer les fichiers, tables, routes, statuts, fonctions, composants et tests réellement trouvés. Les noms conceptuels contenus dans les rapports ne doivent jamais être substitués sans vérification aux noms réels de Medicore.

### Étape B — Implémentation après validation du plan

Après validation du plan, exécutez les changements par incréments limités et vérifiables. Après chaque incrément :

1. exécuter les tests ciblés ;
2. vérifier les invariants métier concernés ;
3. exécuter les contrôles de non-régression pertinents ;
4. corriger tout écart avant de poursuivre ;
5. documenter les résultats et preuves.

Ne demandez pas au commanditaire de choisir entre plusieurs options techniques ordinaires : l’équipe doit arbitrer professionnellement à partir de l’architecture existante. Ne sollicitez une décision que si deux options entraînent des conséquences métier, réglementaires ou irréversibles réellement différentes.

---

## 4. Phase 0 — Protection préalable et établissement de la référence

Avant toute modification :

1. identifier la branche, l’état du repository et les changements non committés ;
2. ne jamais écraser les changements existants appartenant à un autre intervenant ;
3. inventorier les commandes officielles de build, lint, formatage, typecheck, tests unitaires, tests d’intégration et E2E ;
4. exécuter une baseline des tests disponibles ;
5. consigner séparément :
   - les tests déjà en échec avant intervention ;
   - les erreurs de build préexistantes ;
   - les anomalies de données préexistantes ;
   - les contraintes d’environnement empêchant certains tests ;
6. sauvegarder les résultats de référence afin de comparer objectivement l’état avant/après ;
7. identifier les données de test utilisables sans exposer de données médicales réelles.

La baseline ne doit pas servir à excuser de nouveaux échecs. Aucun indicateur ne doit se dégrader.

---

## 5. Phase 1 — Cartographie exhaustive de l’existant

### 5.1 Architecture générale

Documenter :

- structure du monorepo ou des applications ;
- frameworks et versions réellement utilisés ;
- séparation frontend/backend ;
- conventions de services, DTO, validation et gestion des erreurs ;
- ORM, moteur de base de données et système de migrations ;
- mécanismes de cache, événements, files de messages ou tâches asynchrones ;
- authentification, autorisation et audit ;
- architecture des tests et fixtures.

### 5.2 Cartographie métier rendez-vous/consultation

Retrouver tous les éléments relatifs à :

- demande de rendez-vous ;
- rendez-vous ;
- approbation/rejet administrateur ;
- acceptation/refus médecin ;
- planification/agenda ;
- démarrage de consultation ;
- consultation liée à un rendez-vous ;
- consultation sans rendez-vous ;
- clôture de consultation ;
- annulation et absence éventuelle ;
- historique patient, reporting et audit.

Pour chaque objet, relever : table, modèle, identifiant, clés étrangères, statuts, timestamps, services, endpoints, pages, requêtes, cache et tests.

### 5.3 Cartographie métier internement

Retrouver tous les éléments relatifs à :

- admission et internement actif ;
- patient et éventuelle consultation/intervention liée ;
- prise en charge ;
- transfert médical ;
- sortie/clôture ;
- date et heure d’admission et de sortie ;
- médecin responsable ou auteur de la clôture ;
- motif, note, état de sortie, recommandations et ordonnance si ces champs existent ;
- historique ;
- lits, capacité du centre, taux d’occupation et tableaux de bord.

Rechercher les équivalents existants de `status`, `closedAt`, `dischargedAt`, `endDate`, `endTime`, `closedBy`, `dischargeReason`, `dischargeNote` sans créer de doublons de colonnes.

### 5.4 Inventaire obligatoire des statuts

Construire une matrice avec les colonnes suivantes :

| Objet réel | Statut réel | Signification observée | Transitions entrantes | Transitions sortantes | Déclencheur | Rôle autorisé | Vues où il doit apparaître | Vues où il doit être absent |
|---|---|---|---|---|---|---|---|---|

Inclure tous les statuts réellement trouvés, y compris les variantes telles que rejeté, annulé, absent, transféré, terminé ou archivé.

### 5.5 Inventaire obligatoire des routes

Pour chaque route concernée, documenter :

| Méthode et route | Contrôleur | Service | DTO/payload | Validation | Autorisation | Transaction | Objets modifiés | Réponse | Consommateurs frontend | Tests existants |
|---|---|---|---|---|---|---|---|---|---|---|

Vérifier les routes de lecture autant que les routes de mutation : une liste active incorrecte peut provenir d’un filtre backend incomplet même si la mutation est correcte.

### 5.6 Inventaire obligatoire des interfaces

Recenser toutes les vues qui affichent ou comptabilisent les objets concernés :

- demandes en attente ;
- demandes approuvées ;
- rendez-vous à traiter ;
- planification et agenda ;
- consultations en attente, en cours et terminées ;
- internements actifs ;
- historique patient ;
- tableaux de bord, statistiques, notifications et compteurs ;
- vues administrateur, médecin et tout autre rôle concerné.

Pour chaque vue, identifier sa source de données, ses filtres, sa clé de cache, sa stratégie d’actualisation et les actions accessibles.

---

## 6. Phase 2 — Diagnostic des causes profondes

Le diagnostic doit expliquer précisément pourquoi les rendez-vous terminés continuent à apparaître dans les vues actives et pourquoi la clôture d’un internement est absente ou incomplète.

Vérifier notamment :

- statut de consultation mis à jour sans synchronisation du rendez-vous ;
- demande initiale conservée à tort comme approuvée/active ;
- filtres backend incomplets ;
- filtres uniquement frontend ;
- caches non invalidés ou état local obsolète ;
- duplication d’enregistrements ;
- relations faibles ou identifiants non conservés ;
- transition répartie entre plusieurs écrans ;
- absence de transaction ;
- concurrence entre utilisateurs ;
- données historiques déjà incohérentes ;
- permissions uniquement masquées dans l’interface ;
- compteurs de capacité modifiés manuellement au lieu d’être dérivés des internements actifs.

Pour chaque cause, fournir : preuve, emplacement exact, conséquence, risque de régression, correction recommandée et test destiné à empêcher son retour.

---

## 7. Architecture cible et invariants à garantir

### 7.1 Source de vérité

Identifier explicitement l’entité ou le mécanisme constituant la source de vérité du cycle de vie. Si plusieurs objets doivent conserver leur propre statut, formaliser leur relation et leur synchronisation transactionnelle.

Une situation contradictoire telle que :

```text
demande = APPROVED
rendez-vous = SCHEDULED
consultation = COMPLETED
```

ne doit plus pouvoir subsister après une clôture réussie.

### 7.2 Machine à états contrôlée

Adapter aux noms réels la progression conceptuelle suivante :

```text
PENDING → APPROVED → ACCEPTED → SCHEDULED → IN_CONSULTATION → COMPLETED
```

Préserver les chemins alternatifs réellement gérés : `REJECTED`, `CANCELLED`, `NO_SHOW`, etc. Toute transition invalide doit être refusée côté serveur avec une erreur métier claire. Une entité finale ne doit pas revenir à un état actif sans opération métier explicite.

### 7.3 Invariants rendez-vous/consultation

- une demande approuvée n’apparaît comme active que tant qu’une action reste requise ;
- un rendez-vous planifié apparaît dans la planification active ;
- au démarrage de la consultation, le rendez-vous ne reste pas présenté comme simplement à venir ;
- à la clôture d’une consultation liée, consultation et rendez-vous reçoivent des états cohérents dans la même opération atomique ;
- le rendez-vous terminé disparaît immédiatement de toutes les vues actives ;
- les données restent dans l’historique et l’audit ;
- une consultation sans rendez-vous peut être démarrée et clôturée sans `appointmentId` artificiel ;
- un rendez-vous annulé ne peut pas déclencher une consultation ordinaire sans règle explicite ;
- aucune double clôture ne produit d’effet secondaire incohérent.

### 7.4 Invariants internement

- seul un internement actif peut être clôturé ;
- seul un rôle autorisé peut effectuer la clôture ;
- le statut final, la date/heure de sortie et l’auteur sont persistés ;
- une confirmation explicite précède l’action dans l’interface ;
- la double clôture est refusée proprement ;
- l’internement clôturé disparaît de la liste active mais demeure dans l’historique ;
- la durée est figée à la date de sortie, et non recalculée depuis l’heure courante ;
- la capacité, les lits et les statistiques se recalculent depuis la source fiable ;
- une clôture normale reste distincte d’un transfert médical ;
- aucune donnée médicale n’est effacée.

### 7.5 Sécurité, transaction et concurrence

- contrôler l’autorisation côté backend pour chaque transition sensible ;
- réutiliser le RBAC existant, sans élargissement implicite de privilèges ;
- valider les payloads côté serveur et ignorer/refuser les champs non autorisés ;
- effectuer atomiquement les mises à jour corrélées et l’audit ;
- appliquer une stratégie existante de verrouillage optimiste, version, condition sur statut ou verrou transactionnel ;
- empêcher qu’une requête simultanée ou répétée rejoue une transition finale ;
- ne journaliser aucune donnée médicale sensible au-delà de ce qui est prévu par l’audit sécurisé.

---

## 8. Livrable obligatoire avant implémentation : plan détaillé

Avant d’écrire le code fonctionnel, produire un document Markdown intitulé :

`PLAN_IMPLEMENTATION_AMENDEMENTS_MEDICORE.md`

Ce plan doit contenir obligatoirement :

1. **Résumé exécutif** des anomalies et objectifs ;
2. **Périmètre inclus et explicitement exclu** ;
3. **Architecture et stack constatées** ;
4. **Cartographie des objets et relations** ;
5. **Matrice complète des statuts et transitions** ;
6. **Matrice écrans × statuts**, indiquant où chaque objet doit apparaître ;
7. **Inventaire des routes et contrats API** ;
8. **Diagnostic avec preuves et causes racines** ;
9. **Source de vérité retenue et justification** ;
10. **Invariants métier à protéger** ;
11. **Liste précise des fichiers à modifier**, sous la forme :

   ```text
   chemin/fichier → fonction/classe concernée → modification prévue → justification → risque → test de protection
   ```

12. **Modifications backend** : modèles, services, contrôleurs, repositories, DTO, erreurs, événements et transactions ;
13. **Modifications frontend** : pages, composants, dialogues, hooks, stores, invalidations de cache, états de chargement et erreurs ;
14. **Modifications base de données** : contraintes, index, relations et migration réversible, uniquement si nécessaires ;
15. **Stratégie de traitement des données historiques**, avec requête de diagnostic et nombre d’enregistrements concernés avant mutation ;
16. **Matrice RBAC** des actions et rôles ;
17. **Stratégie d’audit et traçabilité** ;
18. **Stratégie de compatibilité et non-régression** ;
19. **Plan de tests détaillé** : unitaires, intégration, API, sécurité, concurrence, frontend et E2E ;
20. **Jeux de données de test et préconditions** ;
21. **Ordre exact des incréments d’implémentation** ;
22. **Critères d’entrée et de sortie de chaque incrément** ;
23. **Plan de rollback technique et fonctionnel** ;
24. **Risques, impacts et mesures de réduction** ;
25. **Critères d’acceptation traçables** vers les deux rapports ;
26. **Questions bloquantes réelles**, uniquement si le code et les documents ne permettent pas de trancher.

Le plan ne doit pas être générique. Toute affirmation portant sur Medicore doit citer un élément réellement constaté.

---

## 9. Ordre d’implémentation obligatoire après validation

### Incrément 1 — Tests de caractérisation

Créer des tests reproduisant le comportement actuel et les anomalies avant de corriger. Ils doivent démontrer l’échec attendu pour les scénarios défectueux et protéger les workflows existants.

### Incrément 2 — Domaine et transitions

Centraliser les transitions dans les services métier existants. Refuser les transitions invalides, doubles clôtures et opérations non autorisées.

### Incrément 3 — Persistance et atomicité

Garantir les relations, mises à jour transactionnelles et protections contre la concurrence. Ajouter une migration réversible uniquement si l’architecture l’exige.

### Incrément 4 — Routes et contrats API

Adapter en priorité les endpoints existants. Ne créer une nouvelle route que si aucune convention compatible n’existe. Préserver la rétrocompatibilité des consommateurs non concernés.

### Incrément 5 — Requêtes des vues actives et historiques

Corriger les filtres au niveau serveur afin que chaque liste corresponde aux statuts autorisés. Vérifier également les compteurs et tableaux de bord.

### Incrément 6 — Synchronisation frontend

Mettre à jour les vues sans rechargement complet : invalidation ciblée des caches, mise à jour du store ou refetch approprié. Préserver les états de chargement, erreurs, doubles clics et accessibilité.

### Incrément 7 — Clôture de l’internement

Ajouter l’action uniquement sur un internement actif et pour les rôles autorisés, avec dialogue de confirmation, champs réellement supportés, traitement backend transactionnel, historique et actualisation des capacités.

### Incrément 8 — Correction éventuelle des données historiques

Séparer strictement la correction du code de la réparation des données. Produire d’abord un rapport chiffré. Le script de réparation doit être idempotent, traçable, testable, réversible autant que possible et exécuté uniquement après validation explicite.

### Incrément 9 — Durcissement et nettoyage

Vérifier erreurs métier, logs, audit, validation, gestion des accès, index, performances, absence de code mort et cohérence des contrats.

---

## 10. Stratégie de tests obligatoire

### 10.1 Tests unitaires

Tester toutes les transitions valides et invalides, notamment :

- approbation, rejet, acceptation, planification ;
- démarrage et clôture de consultation ;
- annulation et absence si existantes ;
- clôture d’une consultation sans rendez-vous ;
- clôture normale d’internement ;
- tentative de double clôture ;
- distinction clôture/transfert ;
- calcul figé de la durée ;
- refus d’un rôle non autorisé.

### 10.2 Tests d’intégration backend et base

Vérifier :

- persistance réelle ;
- rollback complet lorsqu’une étape échoue ;
- mise à jour corrélée rendez-vous/consultation ;
- audit ;
- contraintes de relation et d’unicité ;
- filtres des listes actives ;
- historique ;
- concurrence de deux requêtes ;
- rejouabilité/idempotence appropriée.

### 10.3 Tests API

Pour chaque route modifiée : succès, payload invalide, objet absent, statut incompatible, rôle interdit, conflit concurrent, double soumission et structure de réponse.

### 10.4 Tests frontend

Vérifier :

- visibilité conditionnelle des actions ;
- confirmation de clôture ;
- prévention du double clic ;
- messages d’erreur métier ;
- invalidation des données concernées ;
- disparition immédiate des listes actives ;
- conservation dans les vues historiques ;
- absence de `window.location.reload()` comme mécanisme principal ;
- absence de régression sur les consultations sans rendez-vous.

### 10.5 Test End-to-End principal — rendez-vous jusqu’à clôture

Exécuter le parcours avec de nouveaux identifiants tracés :

1. créer une demande de rendez-vous ;
2. vérifier sa persistance en base et sa présence uniquement dans l’interface attendue ;
3. l’approuver comme administrateur ;
4. vérifier ancien/nouveau statut, audit et déplacement entre les vues ;
5. l’accepter comme médecin ;
6. vérifier statut, droits et listes ;
7. le planifier ;
8. vérifier la planification et l’absence des listes incompatibles ;
9. démarrer la consultation ;
10. vérifier consultation en cours et rendez-vous synchronisé ;
11. clôturer la consultation ;
12. vérifier atomiquement tous les statuts liés ;
13. confirmer l’absence dans les demandes approuvées, la planification active, les rendez-vous à traiter et consultations en attente ;
14. confirmer la présence dans l’historique patient/consultations terminées ;
15. rafraîchir le navigateur ;
16. se déconnecter puis se reconnecter ;
17. répéter les vérifications de chaque interface ;
18. contrôler la base, les timestamps et l’audit.

À chaque changement de statut, consigner : identifiants, ancien état, nouvel état, réponse API, état en base, interfaces attendues, interfaces interdites et résultat observé.

### 10.6 Test End-to-End secondaire — internement

1. admettre un patient avec un compte autorisé ;
2. vérifier l’internement actif et son impact sur la capacité ;
3. ouvrir la fiche ;
4. confirmer la présence du bouton uniquement pour un rôle autorisé ;
5. ouvrir puis annuler la confirmation, sans modification ;
6. relancer et confirmer la clôture ;
7. vérifier statut final, date/heure, auteur et informations de sortie ;
8. vérifier le retrait immédiat de la liste active ;
9. vérifier l’historique et la durée figée ;
10. vérifier la libération de capacité et les statistiques ;
11. tenter une seconde clôture et confirmer le refus ;
12. rafraîchir, se reconnecter et revérifier la persistance ;
13. vérifier qu’un transfert existant conserve sa sémantique propre.

### 10.7 Suite complète de non-régression

Exécuter après les tests ciblés :

- tests unitaires complets ;
- tests d’intégration complets ;
- E2E disponibles ;
- lint ;
- typecheck ;
- build de production ;
- analyse de sécurité et dépendances disponible dans le projet ;
- vérification des migrations sur base vide et base existante représentative.

Comparer les résultats avec la baseline. Aucun nouvel échec, avertissement critique ou baisse de couverture ne doit être accepté sans résolution.

---

## 11. Boucle qualité et règle d’arrêt

Après chaque incrément, établir une note fondée sur des preuves pour :

- conformité fonctionnelle ;
- intégrité et cohérence des données ;
- sécurité et permissions ;
- non-régression ;
- couverture des tests ;
- qualité du code ;
- expérience utilisateur ;
- persistance et audit ;
- build et déploiement.

Si un critère d’acceptation échoue ou si une régression est détectée, ouvrir immédiatement une nouvelle itération : diagnostic → correction → tests ciblés → suite de non-régression. Répéter jusqu’à satisfaction de tous les critères vérifiables.

Une note de **100/100 ne peut être annoncée que si elle est accompagnée des preuves reproductibles** : commandes, résultats, scénarios, identifiants de test et critères validés. Un test impossible à exécuter doit être déclaré « non vérifié », jamais considéré comme réussi.

---

## 12. Critères d’acceptation consolidés

La mission n’est terminée que si :

- les critères AC-01 à AC-12 du rapport rendez-vous sont tous tracés et validés ;
- les critères AC-HOSP-01 à AC-HOSP-10 du rapport internement sont tous tracés et validés ;
- un rendez-vous possède un cycle de vie cohérent dans toute l’application ;
- la clôture d’une consultation synchronise toutes les entités liées sans état partiel ;
- toutes les vues actives et historiques reflètent immédiatement le bon état ;
- les consultations sans rendez-vous restent fonctionnelles ;
- un internement peut être clôturé de façon autorisée, atomique, auditée et persistante ;
- les capacités et statistiques associées sont cohérentes ;
- aucune donnée médicale n’est physiquement supprimée ;
- les états restent corrects après rafraîchissement et reconnexion ;
- aucun workflow existant non concerné n’est cassé ;
- la suite complète, le typecheck et le build passent au moins au niveau de la baseline, sans nouvel échec.

---

## 13. Rapport final obligatoire après implémentation

Fournir un rapport Markdown contenant :

1. causes racines confirmées ;
2. architecture et source de vérité retenues ;
3. matrice finale des statuts et transitions avec les noms réels ;
4. liste exhaustive des fichiers modifiés et résumé des changements ;
5. migrations et stratégie de rollback ;
6. routes et contrats API modifiés ;
7. permissions appliquées ;
8. audit et traçabilité ;
9. données historiques détectées et traitement effectué ou proposé ;
10. tests ajoutés, commandes exécutées et résultats exacts ;
11. déroulé E2E complet avec preuve à chaque statut ;
12. résultats du build, lint et typecheck ;
13. écarts résiduels, risques ou tests non exécutables ;
14. matrice de traçabilité entre chaque amendement, son code et son test ;
15. confirmation explicite de l’absence de nouvelle régression observée.

Ne formulez jamais une réussite sans preuve. Ne cachez aucun test échoué, aucune limitation et aucun risque résiduel.

---

## 14. Instruction immédiate

Commencez maintenant uniquement par **l’Étape A : analyse complète et production du fichier `PLAN_IMPLEMENTATION_AMENDEMENTS_MEDICORE.md`**.

N’implémentez encore aucun amendement. Présentez un plan spécifique au repository, détaillé fichier par fichier, table par table, route par route, statut par statut et test par test. Attendez ensuite la validation explicite du plan avant de passer à l’Étape B.
