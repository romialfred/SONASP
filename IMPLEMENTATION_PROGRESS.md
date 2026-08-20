# Suivi d'implémentation — Plateforme SONASP

Fichier de continuité du mandat de refonte. **À relire en début de chaque reprise**, avant
toute modification. Il indique l'état réel du code, les décisions prises et la prochaine
action exacte.

Dernière mise à jour : 2026-08-18.

---

## 1. Références de conception retenues

Deux écrans existants servent de référence — ils ne sont pas reproduits mécaniquement,
leurs **principes** sont extraits puis adaptés à chaque contexte.

**Fiche de site artisanal** (`/artisan-sites/nouveau`) — référence des formulaires :
sections fonctionnelles à bandeau coloré et icône, lignes composées selon la nature des
champs (jamais une grille uniforme), contrôles lisibles sans ouvrir de menu (segmenté,
cartes de choix), valeurs calculées sorties de la zone de saisie et remontées en tuiles
d'en-tête, volet contextuel à droite, barre d'actions collante.

**Tableau de bord national** (`/dashboard`) — référence des écrans de consultation :
palette, cartes d'indicateurs, panneaux, tableaux clairs, filtres, densité, rythme
vertical.

Formalisation : `src/styles/design-system.css` (tokens + primitives `sn-`) et
`src/components/ui/sn/index.tsx` (15 primitives React).

---

## 2. Inventaire (généré, pas estimé)

**109 pages · 21 modules · 119 routes · 52 930 lignes.**
103 pages sont routées ; les 6 restantes sont des onglets internes du module Analyses
(pas des pages orphelines). **Aucune page morte.**

| Module | Pages | Lignes | Refondues | Testées | Dialogues natifs | Statut |
|---|---:|---:|---:|---:|---:|---|
| artisan-minier | 19 | 8587 | 4 | 4 | 6 | en cours |
| admin | 15 | 6560 | 0 | 0 | 1 | à traiter |
| production | 7 | 4684 | 0 | 0 | 1 | à traiter |
| sales | 5 | 4373 | 0 | 0 | 0 | à traiter |
| freight | 6 | 3254 | 0 | 0 | 1 | à traiter |
| shipping | 4 | 2999 | 0 | 0 | 1 | à traiter |
| payments | 5 | 2968 | 0 | 0 | 1 | à traiter |
| analytics | 8 | 2363 | 0 | 0 | 0 | à traiter |
| inventory | 3 | 2205 | 0 | 0 | 0 | à traiter |
| prices | 2 | 2088 | 0 | 0 | 0 | à traiter |
| stakeholders | 7 | 1774 | 0 | 0 | 0 | à traiter |
| customers | 4 | 1741 | 0 | 0 | 0 | à traiter |
| dashboards | 7 | 1702 | 0 | 1 | 0 | à traiter |
| artisanal-sites | 3 | 1683 | 3 | 1 | 0 | **validé** |
| racine | 4 | 1426 | 0 | 0 | 0 | à traiter |
| presales | 3 | 1325 | 0 | 0 | 1 | à traiter |
| refining | 2 | 1082 | 0 | 0 | 0 | à traiter |
| auth | 2 | 772 | 0 | 0 | 0 | à traiter |
| documents | 1 | 662 | 0 | 0 | 0 | à traiter |
| reports | 1 | 356 | 0 | 0 | 0 | à traiter |
| performance | 1 | 326 | 0 | 0 | 2 | à traiter |
| **Total** | **109** | **52 930** | **7** | **6** | **14** | |

### Dettes transverses mesurées

| Dette | Constat initial | État |
|---|---|---|
| Coquille applicative | 91 pages sur l'ancien layout | **résolu** — `MainLayout` délègue à `NationalDashboardLayout` |
| Primitives visuelles | 107 pages en utilitaires ad hoc | **résolu** — Button/Input/Select/TextArea/Card/Table restylés |
| `console.*` en production | 878 appels | **résolu** — `esbuild.drop` (12 résiduels, tiers) |
| Dialogues natifs | 34 `alert()`/`confirm()` | 14 restants — repris page par page |
| `any` explicites | 459 | en cours (−2 par page convertie en moyenne) |
| Chaînes anglaises en dur | 25 | à traiter par module |
| Pages sans `catch` | 21 | à traiter par module |

---

## 3. Ce qui est conservé sans modification

- L'architecture de routage (`App.tsx`, `ProtectedRoute`, lazy loading).
- Les 64 services et leurs signatures : aucune API modifiée sans écart démontré.
- Les règles métier financières (constantes or, royalties) — figées par 18 tests golden.
- Les contextes `Auth`, `Toast`, `Dialog`, `Notification`.
- Les migrations Supabase existantes ; les nouvelles sont additives et réversibles.

---

## 4. Plan directeur

Ordre d'exécution retenu : **volume de code décroissant pondéré par la fréquence
d'usage métier**, en terminant chaque module avant de passer au suivant.

| # | Lot | Statut |
|---|---|---|
| 0 | Socle : design system, primitives, coquille, journalisation | **validé** |
| 1 | Sites artisanaux (3 pages) | **validé** |
| 2 | Artisans miniers — cartes (validation, expirations, suivi) | **validé** |
| 3 | Artisans miniers — ventes d'or et paiements | **validé** |
| 4 | Artisans miniers — dossier et conformité | **validé (8/8)** |
| 5 | Tableaux de bord (7) | **validé (7/7)** |
| 6 | Administration (15) | **validé (15/15)** |
| 7 | Production / Collecte (7) | à faire |
| 8 | Ventes, pré-ventes, paiements (13) | à faire |
| 9 | Fret, expéditions, raffinage (12) | à faire |
| 10 | Parties prenantes, clients (11) | à faire |
| 11 | Analyses, rapports, prix, stocks (14) | à faire |
| 12 | Racine, auth, documents (7) | à faire |
| 13 | Audit transversal final | à faire |

---

## 5. Modules traités

### Lot 0 — Socle (validé)
- `src/styles/design-system.css` : tokens et primitives `sn-`.
- `src/components/ui/sn/index.tsx` : PageHeader, Breadcrumb, Section, Card, Field,
  SelectControl, SearchInput, Segmented, ChoiceCards, StatGrid, Badge, Note, DataTable,
  EmptyState, FormActions.
- `MainLayout` → `NationalDashboardLayout` : 91 pages basculées sans modification.
- Barre latérale : bascule remontée en tête, pied de page passé en pleine largeur,
  verticalité resserrée — **aucun défilement à 1366×700** (mesuré).
- `vite.config.ts` : `console.*` retiré du bundle de production.

### Lot 1 — Sites artisanaux (validé)
Vue d'ensemble, Production, Fiche site. Production **calculée** depuis les ventes d'or
des artisans (jamais saisie). Code de site généré `SA-XXX-AAAA-NNNN`. Carte des 45
provinces cliquable renseignant région + province + coordonnées. Photos (3 max).

### Lot 2 — Cartes professionnelles (en cours)
- `CarteValidation` : refondue, 5 tests. ✅
- `CarteExpirations` : refondue, 6 tests. **Anomalie corrigée** : l'ancienne version
  restreignait au statut `en_exploitation`, rendant invisible une carte `validee`
  arrivant à échéance ; les bornes des 4 fenêtres se recouvraient. ✅
- `CarteSuivi` : refondu, 5 tests. **Écart structurel corrigé** : la page interrogeait
  Supabase directement (constat F8) ; les deux requêtes sont passées dans
  `carteProfessionnelleService` (`getRecentActivities`, `getTopArtisans`, avec agrégation
  par artisan côté service). Chargement en `Promise.allSettled` : une table absente
  n'efface plus tout l'écran. ✅

**Lot 2 validé** (3/3 pages, 16 tests).

### Lot 3 — Ventes d'or et paiements (en cours)
- `VentesOr` : refondue, 8 tests. Filtres **combinables** (statut, type d'or, période,
  recherche) et tri extraits en fonctions pures testées. Le `confirm()` natif est
  remplacé par `useConfirmationDialog`, qui affiche quantité, montant et statut avant
  suppression. État d'erreur avec réessai conservé, état vide actionnable ajouté. ✅
- `PaiementsVentesDashboard` : refondu, 6 tests. **Anomalie corrigée** : la page
  naviguait vers l'écran de paiement même lorsque la création de la facture définitive
  échouait — l'utilisateur arrivait sur un dossier sans facture. La navigation est
  désormais conditionnée au succès, l'échec est signalé. Signalement des dossiers au-delà
  de 30 jours d'attente. ✅
- `PaiementsHistorique` : refondue, 7 tests. **Bouton inactif corrigé** : « Exporter »
  ne faisait qu'un `console.log`. Export CSV réel (8 colonnes, BOM UTF-8, fichier daté),
  compteur dans le libellé, refus explicite à vide. Bornes de période rendues inclusives
  (l'ancienne comparaison de `Date` excluait le jour de fin). ✅
- `VenteOrForm` : refondu en 4 sections + volet contextuel, 8 tests. **Anomalie
  financière corrigée** : l'écran affichait le montant **brut** sous le libellé « Montant
  total » alors que l'enregistrement stockait brut + TVA 18 % + taxe 1 % — 19 % d'écart
  entre ce que voyait l'agent et ce qui partait en base. Le récapitulatif est désormais
  calculé par `calculateTaxes`, la **même** fonction que la sauvegarde ; un test compare
  l'affichage et la charge utile envoyée au service. Ajout : garde anti-double
  soumission, bouton désactivé tant qu'un champ déterminant manque avec le motif affiché,
  titre en carats lié au pourcentage, volet montrant l'artisan et son historique. ✅
- `VenteOrDetails` : refondue, 9 tests. Page de détail hiérarchisée (identité + statut,
  4 indicateurs, caractéristiques, détail fiscal, observations) avec volet artisan et
  suivi. **Le workflow devient actionnable** : la page se contentait d'afficher et de
  renvoyer vers la modification alors que `updateStatus` existait déjà dans le service et
  n'était appelé de nulle part. Les actions sont désormais ouvertes selon le statut
  (`availableActions`, testée sur les 4 statuts) : valider, annuler, ouvrir le paiement.
  La fiche reste consultable si la fiche artisan est indisponible. ✅
- `PaiementForm` : refondu, 9 tests. **Facture PDF réparée** : la charge utile transmise
  au service PDF utilisait `poids_grammes`, `prix_unitaire_fcfa`, `purete_pourcentage`,
  `artisan.prenom` et `adresse_physique` — aucun de ces champs n'existe sur la vente ni
  sur l'artisan. `venteOr.prix_unitaire_fcfa.toLocaleString()` levait une `TypeError` :
  **le téléchargement de facture échouait systématiquement**, masqué par un `alert()`
  générique. `buildInvoicePayload` fait désormais la traduction, testée.
  Les 5 `alert()` et le `window.confirm()` sont remplacés par les dialogues de la
  plateforme. Les moyens de paiement deviennent une définition de données : chaque canal
  n'affiche que ses champs (les 4 services mobiles partagent le même jeu), avec blocage
  explicite listant les obligations non satisfaites. Une vente introuvable ou sans
  facture affiche un motif au lieu d'un écran vide. ✅

**Lot 3 validé** (6/6 pages, 47 tests). Plus aucun dialogue natif dans le module.

### Lot 7 — Production (en cours)
- `DailyProductionPage` : refondue et francisée. **Quatre défauts corrigés.**
  1. **La suppression d'une déclaration ne se produisait jamais.** L'appel employait la
     signature `showConfirm(message, callback, options)` alors que le hook expose
     `(titre, message, options) => Promise<boolean>` : la fonction de suppression était
     passée en guise de message, la promesse n'était jamais lue, et rien n'était supprimé.
  2. Le bouton « Budget et prévisions » menait vers `/production/budget`, **route qui
     n'existe pas** ; la bonne est `/performance/budgets`.
  3. L'export CSV inscrivait `mining_company_id` dans la colonne « compagnie » :
     **le fichier livrait des UUID** au lieu des raisons sociales, avec des en-têtes
     anglaises et un séparateur incompatible avec le tableur français.
  4. Après chaque enregistrement, la période choisie par l'utilisateur était **écrasée
     par une fenêtre de 90 jours**.
  Le titre moyen affiché est désormais pondéré par la masse de doré. 11 tests.

### Lot 6 — Administration (validé)
- `UsersListPage` : refondue et **francisée** — l'écran était intégralement en anglais
  (« Users Management », « Never », dates au format `en-US`). Trois défauts corrigés :
  le filtre par rôle **omettait « propriétaire » et « administrateur »**, les deux rôles
  les plus privilégiés, donc impossibles à isoler ; la désactivation d'un compte se
  faisait **en un clic sans confirmation** ; et rien n'empêchait un administrateur de
  **se verrouiller lui-même hors de la plateforme**.
- `UserDetailsPage` : refondue. La page était un cul-de-sac — aucune action possible
  depuis la fiche ; elle porte désormais l'accès aux permissions et à la modification.
  Un compte absent et une base injoignable donnaient le même écran muet ; les deux cas
  sont maintenant distingués.
- `RefineriesPage` et `TransportCompaniesPage` : refondues et francisées. Une requête en
  échec rendait un **tableau vide, indiscernable d'un référentiel vide** — l'erreur réelle
  est désormais affichée. La recherche appelait `.toLowerCase()` sur des colonnes
  facultatives : un établissement au contact non renseigné faisait **planter le filtre**.
- `ApprovalsDashboard` : refondu. **Les trois compteurs étaient faux** : ils portaient sur
  la liste déjà filtrée, si bien qu'« Approuvées » et « Rejetées » affichaient toujours
  zéro tant que le filtre « en attente » était actif. Les demandes sont désormais
  chargées une fois et filtrées à l'écran.
- `errorMessage()` (`src/lib/errorMessage.ts`) : les erreurs Supabase sont des objets
  simples, pas des instances d'`Error` ; le test `instanceof Error` les remplaçait
  partout par un libellé générique et la cause réelle n'atteignait jamais l'utilisateur.
- `RefineryForm` et `TransportCompanyForm` : refondus et francisés. Les deux chargeaient
  la fiche avec `single()`, qui **lève une exception sur une référence inconnue** : le
  formulaire restait vide mais enregistrable et visait une ligne inexistante. Ils
  distinguent désormais la fiche absente, avec un écran dédié.
- `ModulesManagement` : refondu sur la charte, avec recherche sur la hiérarchie et
  décomptes. **La désactivation d'un module se faisait en un clic** alors qu'elle retire
  une section entière de l'application à tous les utilisateurs et emporte ses
  sous-modules : elle passe par une confirmation qui annonce le nombre de sous-modules
  concernés.
- **`userPermissionsService` + `UserPermissionsPage`** : le sous-ensemble « habilitations »
  portait quatre défauts graves, tous corrigés.
  1. **Deux écrans écrivaient dans `user_permissions` avec des jeux de colonnes
     incompatibles** — `can_read/can_write/can_delete` d'un côté, `can_view/can_create/
     can_edit/can_delete/can_approve` de l'autre. Chacun remplaçant l'existant,
     enregistrer depuis un écran **effaçait ce que l'autre avait posé**.
  2. **L'enregistrement supprimait tout puis réinsérait.** Si l'insertion échouait,
     l'utilisateur se retrouvait **sans aucun droit**, sans rollback. Pire : un
     chargement en échec laissait un écran vide, et cliquer sur « Enregistrer »
     **révoquait alors la totalité des habilitations réelles**. L'écriture procède
     désormais par différence, et l'enregistrement est bloqué tant que l'état de départ
     n'est pas établi avec certitude.
  3. **Les deux écrans ne pointaient pas sur le même référentiel de modules** :
     `user_permissions.module_id` référence `modules`, mais `UserManagementModern`
     alimentait ses cases depuis `snp_modules`. Les droits accordés depuis cet écran
     portaient des identifiants qu'aucun lecteur ne pouvait résoudre.
  4. **Les permissions par champ étaient écrites `{ read, write }` et lues
     `{ can_view, can_edit }`** : aucune n'a jamais pu s'appliquer. Le service normalise
     les deux formes.
  L'écran est par ailleurs refondu, francisé, et ses catégories déduites du référentiel
  au lieu des cinq libellés codés en dur. 14 tests.
- `UserManagementModern` : couche de données recâblée sur le service partagé (le reste
  de l'écran sera refondu à l'étape suivante).
- `StatusManagerPage` : devient un **référentiel en lecture seule**, ce qu'il était en
  réalité. Le bouton « Éditer » n'écrivait rien et annonçait « les modifications seront
  appliquées dans une prochaine version » ; le panneau qu'il ouvrait était un composant
  stub renvoyant `null` ; le bouton « Voir les détails » n'avait aucune action. Les
  transitions sont désormais lues dans `ALLOWED_TRANSITIONS`, la table de référence du
  service de contrôle, au lieu d'une carte reconstituée en dur. Le stub est supprimé.
- `GoldSalesSettingsPage` : refondu ; la suppression d'une règle de vente passait par un
  `confirm()` natif, remplacé par une confirmation tracée qui explique la portée.
  Recherche ajoutée.
- **`/settings` supprimé** : cet écran de configuration système présentait six onglets
  (société, taux de change, cours de l'or, modèles d'e-mail, seuils, notifications)
  dont **le bouton « Save Changes » se contentait d'un `console.log`** — toute saisie
  d'administrateur était silencieusement jetée. Il affichait de surcroît l'identité d'une
  société guinéenne (« Mansa Resources », Conakry) sur une plateforme burkinabè. La route
  redirige vers `/parameters`, le paramétrage réellement persisté ; l'écran factice est
  supprimé.
- `ParametersPage` : refondu et francisé. **Deux de ses quatre onglets étaient
  décoratifs.** « Préférences » alignait quatre listes déroulantes **sans valeur ni
  gestionnaire**, sous un bouton « Save Preferences » **sans `onClick`** : rien n'était
  chargé, rien n'était enregistré ; la liste des fuseaux proposait UTC, Abidjan, Conakry
  et Bamako mais **pas Ouagadougou**. « Notifications » affichait des interrupteurs figés
  sur `checked={true}` avec `onChange={() => {}}`. Les deux fonctionnent désormais sur
  des stockages qui existent réellement : `language_preference` et `timezone` sur
  `user_profiles`, les trois indicateurs de notification dans les métadonnées du compte
  — celles-là mêmes que le contexte d'authentification relit. Devise et unité de poids
  n'avaient aucun stockage : plutôt que de promettre un réglage inexistant, la page
  énonce la règle appliquée. La bascule de double authentification passe par une
  confirmation. 9 tests.
- `UserManagementModern` : refonte visuelle achevée (la couche de données l'avait été à
  l'itération 21). **Trois défauts corrigés** : la liste des rôles s'arrêtait à cinq
  entrées — **ni propriétaire ni administrateur**, donc impossible de créer un
  administrateur depuis cet écran ; les descriptions de rôle renvoyaient au module
  « batches » inexistant ; et les rattachements aux compagnies étaient supprimés puis
  réinsérés **sans que l'issue d'aucune des deux écritures ne soit jamais vérifiée**.
  L'écran passe en français, sur la charte, en deux étapes assumées (identité, puis
  habilitations) avec des gabarits d'habilitations. 12 tests.
- **Trois composants d'administration supprimés** : `StatusEditorModal` et
  `TransitionEditorModal` importaient `workflowManagerService`, **un module qui n'existe
  pas** — ils ne pouvaient pas compiler ; `GoldSalesSettingForm` doublonnait le panneau
  réellement utilisé. Aucun des trois n'était référencé.
- `GoldShippingWorkflow` : le diagramme BPMN était **écrit à la main de bout en bout** et
  décrivait un processus « Batch Management » qui **n'existe pas dans la plateforme** — ni
  module de lots, ni route correspondante. La documentation affichée aux administrateurs
  ne correspondait donc à aucun circuit réel, et son bouton « Export » n'avait aucun
  gestionnaire. Le diagramme est désormais **calculé à partir d'`ALLOWED_TRANSITIONS`** :
  couloirs déduits du module responsable, positions calculées par profondeur dans la
  chaîne, navigation d'étape en étape, export SVG réellement branché. Il ne peut plus
  diverger du comportement effectif. 12 tests.
- `statusFormatter` : trois étapes du circuit (`waiting_for_customs_approval`,
  `in_inventory`, `paid`) **n'avaient aucun libellé français** et retombaient sur leur
  identifiant technique anglicisé (« Waiting For Customs Approval ») à l'écran.
- `Toggle` : ajout d'un nom accessible (`ariaLabel`) et de la sémantique `role="switch"`.
  Une bascule sans libellé visible n'avait **aucun nom** pour les technologies
  d'assistance — impossible de savoir ce qu'elle commandait.
- `vitest.config.ts` : passage au pool `threads`. Borner les forks à 6 n'avait pas suffi —
  une exécution a de nouveau perdu 6 fichiers en silence (285 tests annoncés au lieu de
  333). Les threads évitent la création de processus, l'étape qui échouait. Trois
  exécutions consécutives couvrent les 47 fichiers.
- `ParametersPage` : `editedRules[clef] || rule.rule_value` renvoyait l'ancienne valeur
  lorsque la nouvelle était **0** — une règle métier ramenée à zéro (seuil, tolérance)
  n'était jamais appliquée. Corrigé en `??`.
- **Trois tests exposés à une course de rendu** corrigés : ils attendaient l'appel au
  service, ou un titre déjà présent pendant le chargement, puis affirmaient
  synchroniquement sur du contenu pas encore rendu. Sous charge, l'assertion partait trop
  tôt. Ils attendent maintenant le contenu lui-même. Quatre exécutions complètes
  consécutives sont vertes.
- `vitest.config.ts` : parallélisme borné à 6 workers. Avec un fork par fichier sur
  22 cœurs, des workers n'arrivaient pas à démarrer — vitest **passait alors les fichiers
  concernés sous silence et annonçait un résultat vert portant sur 285 tests au lieu de
  299**. Trois exécutions consécutives couvrent désormais les 44 fichiers.
- `src/test/setup.ts` : délai des utilitaires asynchrones de Testing Library porté à 5 s.
  Sous charge, un test différent échouait à chaque exécution sans traduire la moindre
  régression. Deux exécutions complètes consécutives sont vertes.

### Lot 5 — Tableaux de bord (validé)
- `GlobalDashboardEnhanced` (tableau de bord national) : la maquette est conservée — c'est
  l'écran de référence du design system — mais **tous les chiffres inventés sont
  supprimés**. L'écran embarquait un jeu de repli codé en dur (1 244,23 oz collectées,
  2,84 Mds FCFA de ventes, quatre transactions nommées) affiché **comme s'il s'agissait
  de statistiques nationales réelles** dès que la base ne répondait pas. Il portait aussi
  une répartition par origine figée à 62 / 24 / 14 %, des variations « +8,4 % » et
  « +12,1 % » écrites en dur, un « Taux 3 % » de redevance, « 3 agréments expirent sous
  30 jours », une heure d'actualisation « 10:42 » et des bornes de période figées au
  17 août 2026 que la pastille n'a jamais reflétées. Tout est désormais calculé
  (`nationalDashboardData.ts`) : origines depuis `seller_type`, variations contre la
  période précédente de même durée, taux de redevance constaté, cartes expirantes
  réellement comptées. 12 tests. ✅
- **Cinq tableaux de bord de rôle** (`ManagementDashboard`, `FactoryDashboard`,
  `AirportDashboard`, `RefineryDashboard`, `CustomerDashboard`) : c'étaient des maquettes
  intégrales — indicateurs, activités et graphiques étaient des littéraux, avec des
  numéros de lots inventés (« BT-2024-012 »), des sites **en Guinée, au Mali et en
  Côte d'Ivoire**, des montants **en dollars**, une interface en anglais et un bouton
  « Create New Batch » pointant vers `/batches/new`, **route qui n'existe pas**. Les cinq
  écrans sont reconstruits sur un socle commun (`roleDashboardData.ts`,
  `RoleDashboardShell.tsx`) alimenté par les tables réelles, en français et en FCFA.
  11 tests. ✅
- `ProductionDashboardModern` : déjà branché sur les données, refondu sur la charte et
  corrigé. Le consolidé s'intitulait « Groupe Mansa Resources » — organisation étrangère
  à la SONASP ; la carte « Mois précédent » portait un badge « MTD » ; et le **titre moyen
  était moyenné sur douze mois, zéros compris**, ce qui le tirait mécaniquement vers le
  bas. Il est désormais pondéré par le nombre de déclarations et vaut « — » sans
  production. 7 tests. ✅
- `carteProfessionnelleService.getCartesExpirant` : la requête n'avait **pas de borne
  basse**, donc les cartes expirées depuis des mois étaient comptées comme « arrivant à
  échéance ».

### Lot 4 — Dossier artisan et conformité (validé)
- `ArtisanMinierDetails` : refondu, 8 tests. Dossier à 4 sections (identité et contact,
  carte professionnelle, ventes déclarées, infractions) avec en-tête d'identité, badges
  d'alerte et 4 indicateurs consolidés. **Deux défauts corrigés** : les quatre sources
  étaient chargées en cascade dans un seul `try` — une table absente vidait tout le
  dossier ; elles passent en `Promise.allSettled`. La carte affichée était
  systématiquement `cartes[0]` sans tenir compte du statut ni de la date : une carte
  **expirée** pouvait masquer la carte valide. `carteActive` retient la plus récente
  parmi les valides, testée. ✅
- `InfractionForm` : refondu en quatre sections (constat, qualification, instruction,
  pièces) avec volet contextuel rappelant l'artisan mis en cause et ses antécédents.
  **Quatre défauts corrigés** : un nouvel envoi de pièce **effaçait toutes les pièces
  déjà versées** ; une qualification hors nomenclature revenait sur un select vide et
  était perdue au ré-enregistrement ; le plafond de 10 Mo était annoncé mais jamais
  appliqué ; la réouverture d'un dossier clôturé **conservait le verdict et la date de
  clôture**. 12 tests. ✅
- `InfractionDetails` : refondu (constat, faits, observations, pièces + volet
  d'instruction, artisan, traçabilité). Les métadonnées absentes affichaient
  « Invalid Date » ; la durée d'instruction est désormais calculée. 8 tests. ✅
- `ArtisanMinierForm` (remplace `ArtisanMinierFormWithTabs`, 973 lignes, supprimé) :
  quatre sections au lieu de quatre onglets, volet de suivi avec photo, badges et
  jauge de complétude. **Trois défauts corrigés** : pour un artisan hors Burkina, la
  chaîne d'effets **remettait région et commune à zéro** au chargement de la fiche ;
  la photo était écrite **en base64 dans la colonne `photo_url`** avant tout dépôt au
  stockage ; un échec d'envoi de pièce était avalé et l'écran annonçait malgré tout un
  succès complet. 13 tests. `ArtisanMinierEdit` et `ArtisanMinierListe` recâblés. ✅
- `artisanAnalyticsService` : **dette C-03 soldée**. Les quatre écrans de rapports
  interrogeaient `artisan_ventes_or`, `artisan_factures_definitives` et
  `artisans_miniers` — aucune de ces tables n'existe (préfixe `snp_`), donc tous les
  rapports échouaient en base. Corrigé, avec `prenoms` au lieu de `prenom`, les onces
  troy déduites du poids en grammes (`quantite_onces` n'est pas stockée) et les
  royalties assises sur la taxe de développement communal au lieu d'un forfait inventé
  de 3 %. 5 tests verrouillent les cibles de requête. ✅
- `vite.config.ts` : port de développement fixé à 5180 (`strictPort`), le 5173 étant
  occupé par un autre projet du poste — l'aperçu pointait sur une autre application.
- **Les quatre écrans de rapports** (`CentreRapportsAnalyse`, `RapportChiffreAffaires`,
  `RapportQuantites`, `RapportTaxesRoyalties`) : refondus sur la charte, avec un module
  partagé `rapportsShared.ts` (formats, bornes de période, export Excel). 17 tests.
  **Six défauts corrigés** : le centre chargeait ses quatre sources en `Promise.all` —
  une seule en échec vidait l'écran sans un mot d'explication ; l'évolution mensuelle
  portait sur l'année courante quelle que soit la période choisie ; le rapport
  « par région » **ignorait purement et simplement les bornes de période** ; le filtre
  régional n'offrait que **5 des 13 régions**, codées en dur ; les récapitulatifs de
  taxes affichaient **« NaN% »** sur une période sans facture ; les échecs d'export
  Excel n'étaient consignés qu'au journal, l'utilisateur ne voyait rien se produire.
  Les totaux d'effectifs d'artisans, non additionnables entre régions, sont désormais
  affichés « — » avec la note qui l'explique. Les 7 erreurs de typage résiduelles du
  module ont disparu (179 → 172). ✅

### Barre latérale — réorganisation en quatre sections ✅

Modèle de navigation extrait dans `sidebarNavigation.ts` et organisé en quatre
sections : mines semi-mécanisées, mines industrielles, paramètres et configuration,
rapports et analyses. Palette de la barre passée du vert à une gamme ardoise sobre.

**Cinq défauts corrigés** :

- **A86 — la barre sautait sous le curseur.** Le groupe correspondant à la route était
  choisi par le premier `find()` satisfaisant `startsWith` : `/artisan-minier/paiements`
  correspondait à « Artisans miniers » via son enfant `/artisan-minier`, de sorte que
  cliquer dans « Marché d'or artisanal » repliait ce groupe pour en ouvrir un autre.
  Le groupe est désormais choisi sur la correspondance **la plus longue**.
- **A87 — le premier « Tableau de bord » pointait vers le tableau de bord des artisans**
  et non vers la vue nationale. Il pointe vers `/dashboard` et reste le seul intitulé
  « Tableau de bord » de la barre ; toutes les autres entrées ainsi nommées dans les
  groupes sont renommées « Vue d'ensemble ».
- **A88 — deux entrées vers la même route.** L'entrée de section pointait vers
  `/artisan-minier`, déjà desservie par « Artisans miniers › Vue d'ensemble ». Supprimée.
- **A89 — intitulés tronqués.** Trois règles coupaient les libellés aux points de
  suspension ; ils passent à la ligne, les hauteurs fixes devenant des hauteurs minimales.
- **A90 — indentation des sous-menus** ramenée de 35 px à 20 px cumulés.

### Analyse par assistance IA — `/analytics/assistant` ✅

Nouvelle page (`AiAssistantPage.tsx`, 15 tests) : historique de conversations, fil de
discussion, composeur avec envoi à la touche Entrée et quatre amorces adossées aux
données réellement suivies (collecte par région, cartes expirées, taxes, rapport
institutionnel). **Le moteur d'analyse n'est pas raccordé** : la page l'annonce par un
bandeau, une pastille d'état et une réponse explicite, plutôt que de fabriquer des
chiffres. L'entrée de menu ajoutée pointe vers une route déclarée, pas vers un cul-de-sac.

**A91 — le tableau de bord national ne recensait pas les artisans**, pourtant au cœur du
dispositif. `loadNationalDashboard` remonte désormais l'effectif total et l'effectif
actif, avec la même règle que les autres sources : indisponibilité signalée, jamais
estimée.

---

## 6. Anomalies trouvées et corrigées

| # | Anomalie | Module | Correction |
|---|---|---|---|
| A1 | Jauge de conformité : arc complémentaire tracé (`large-arc-flag`) | Sites | Drapeau figé à 0, test de non-régression |
| A2 | Cartes arrivant à échéance invisibles si statut `validee` | Cartes | Classement unique par fenêtre, testé |
| A3 | Liste artisans : une requête carte **par artisan** (63 requêtes) | Artisans | Un seul `getAllCartes()` |
| A4 | `@import` du design system ignoré par PostCSS | Socle | Import en tête + spécificité renforcée |
| A5 | `esbuild.drop` inopérant (`NODE_ENV` non positionné) | Socle | Branché sur le mode Vite |
| A6 | Cache local servant l'ancien jeu de démonstration | Sites | Clé de stockage versionnée `:v2` |
| A7 | Accès Supabase direct depuis une page (F8) | Cartes | Requêtes déplacées dans le service |
| A8 | Une source en échec vidait tout l'écran de suivi | Cartes | `Promise.allSettled` par source |
| A9 | `confirm()` natif pour supprimer une vente | Ventes d'or | `useConfirmationDialog` avec récapitulatif |
| A10 | Navigation vers le paiement malgré l'échec de la facture | Paiements | Navigation conditionnée au succès, testée |
| A11 | Bouton « Exporter » inactif (`console.log`) | Historique | Export CSV réel, testé |
| A12 | Période de filtre excluant le jour de fin | Historique | Bornes inclusives, testées |
| A13 | Montant affiché 19 % inférieur au montant enregistré | Vente d'or | Récapitulatif calculé par la fonction de sauvegarde |
| A14 | `updateStatus` jamais appelé : workflow de vente non actionnable | Détail vente | Actions par statut, confirmées et testées |
| A15 | Facture PDF : champs inexistants → `TypeError`, téléchargement toujours en échec | Paiement | `buildInvoicePayload` traduit vente↔facture, testé |
| A16 | Vente introuvable : sortie silencieuse, écran vide | Paiement | Motif affiché, état vide actionnable |
| A17 | 10 groupes de menu affichaient un chevron sans sous-menu | Navigation | Sous-menus réels tirés des routes |
| A18 | Dossier artisan vidé si une source annexe échoue | Dossier artisan | `Promise.allSettled` par source |
| A19 | Carte expirée affichée à la place de la carte valide | Dossier artisan | `carteActive` (statut + date), testée |
| A20 | Nouvel envoi de pièce effaçant les pièces déjà versées | Infractions | Fusion pièces stockées + envois, testée |
| A21 | Qualification hors nomenclature perdue au ré-enregistrement | Infractions | `draftFromInfraction` → « Autre » + saisie libre |
| A22 | Plafond de 10 Mo annoncé mais non appliqué | Infractions | Contrôle de taille nommant le fichier refusé |
| A23 | Dossier rouvert conservant verdict et date de clôture | Infractions | `buildInfractionPayload` les efface |
| A24 | « Invalid Date » sur les métadonnées absentes | Infractions | `formatDate` tolérant |
| A25 | Région et commune vidées pour un artisan hors Burkina | Fiche artisan | Référentiels dérivés des valeurs (`useMemo`) |
| A26 | Photo écrite en base64 dans `photo_url` | Fiche artisan | Aperçu local ; seul le lien de stockage est persisté |
| A27 | Échec d'envoi de pièce avalé, succès annoncé | Fiche artisan | Message d'échec nommant la pièce concernée |
| A28 | Rapports pointant sur des tables inexistantes | Rapports | Préfixe `snp_`, `prenoms`, onces dérivées |
| A29 | Royalties calculées par un forfait inventé de 3 % | Rapports | Taxe de développement communal réelle |
| A30 | Une source en échec vidait le centre de rapports | Rapports | `Promise.allSettled` + mention des blocs manquants |
| A31 | Évolution mensuelle figée sur l'année courante | Rapports | Année déduite de la période retenue |
| A32 | Rapport « par région » ignorant les bornes de période | Rapports | Bornes transmises au service, testé |
| A33 | Filtre régional limité à 5 régions codées en dur | Rapports | Référentiel national des 13 régions |
| A34 | « NaN% » sur une période sans facture | Rapports | `tauxEffectif` renvoie `null`, affiché « — » |
| A35 | Échec d'export Excel invisible pour l'utilisateur | Rapports | Message d'erreur restitué à l'écran |
| A36 | Jeu de démonstration codé en dur servi comme statistiques nationales | Tableau de bord national | Repli supprimé ; sources indisponibles annoncées |
| A37 | Répartition par origine figée à 62 / 24 / 14 % | Tableau de bord national | Calcul sur `seller_type` des ventes, testé |
| A38 | Variations « +8,4 % » / « +12,1 % » écrites en dur | Tableau de bord national | Comparaison à la période précédente de même durée |
| A39 | « Taux 3 % » de redevance annoncé sans calcul | Tableau de bord national | Taux constaté redevances / ventes |
| A40 | Bornes de période figées, pastille jamais mise à jour | Tableau de bord national | Période par défaut sur l'exercice, libellé dérivé |
| A41 | Alertes « 3 agréments », « 1 écart » codées en dur | Tableau de bord national | Décomptes réels ; alerte masquée si nulle |
| A42 | Cartes déjà expirées comptées comme « arrivant à échéance » | Cartes | Borne basse ajoutée à la requête |
| A43 | Cinq tableaux de bord entièrement fictifs (lots, sites, dollars) | Tableaux de bord | Reconstruits sur les tables réelles, en FCFA |
| A44 | Bouton « Create New Batch » vers `/batches/new` inexistante | Tableau de bord usine | Action vers `/shipping/preparation` |
| A45 | Consolidé intitulé « Groupe Mansa Resources » | Tableau de bord production | « Toutes les compagnies » |
| A46 | Titre moyen dilué par les mois sans production | Tableau de bord production | Pondération par déclarations, testée |
| A47 | Filtre par rôle amputé de « propriétaire » et « administrateur » | Utilisateurs | Référentiel complet des 7 rôles |
| A48 | Désactivation d'un compte sans confirmation | Utilisateurs | Dialogue de confirmation, testé |
| A49 | Un administrateur pouvait désactiver son propre compte | Utilisateurs | Action bloquée sur le compte courant |
| A50 | Fiche utilisateur sans aucune action possible | Utilisateurs | Accès permissions et modification |
| A51 | Requête en échec rendue comme un référentiel vide | Référentiels | Message d'erreur réel affiché |
| A52 | Recherche plantant sur un champ facultatif non renseigné | Référentiels | Filtres tolérants, testés |
| A53 | Compteurs d'approbations calculés sur la liste filtrée | Approbations | Décomptes sur l'ensemble, testés |
| A54 | Erreurs Supabase remplacées par un libellé générique | Transverse | `errorMessage()` partagé |
| A55 | `single()` laissant un formulaire vide mais enregistrable | Référentiels | `maybeSingle()` + écran « fiche introuvable » |
| A56 | Désactivation d'un module sans confirmation | Modules | Confirmation annonçant les sous-modules emportés |
| A57 | Fichiers de test silencieusement ignorés par vitest | Outillage | Parallélisme borné à 6 workers |
| A58 | Deux écrans écrivant des colonnes incompatibles sur `user_permissions` | Habilitations | Service unique portant le jeu complet |
| A59 | Enregistrement destructif : suppression totale puis réinsertion | Habilitations | Écriture par différence, testée |
| A60 | Un chargement en échec permettait de révoquer tous les droits | Habilitations | Enregistrement bloqué sans état de départ fiable |
| A61 | Habilitations posées sur `snp_modules` au lieu de `modules` | Habilitations | Référentiel unique via le service |
| A62 | Permissions par champ écrites `{read,write}`, lues `{can_view,can_edit}` | Habilitations | Normalisation des deux formes |
| A63 | Tests affirmant avant le rendu de l'état chargé | Outillage | Attente du contenu, non de l'appel |
| A64 | « Éditer un statut » n'écrivait rien et ouvrait un stub `null` | Statuts | Référentiel assumé en lecture seule |
| A65 | Carte de transitions reconstituée en dur | Statuts | Lecture d'`ALLOWED_TRANSITIONS` |
| A66 | Suppression d'une règle de vente par `confirm()` natif | Paramétrage ventes | Confirmation tracée |
| A67 | Écran `/settings` jetant toute saisie (`console.log`) | Configuration | Route redirigée vers `/parameters`, écran supprimé |
| A68 | Identité d'une société guinéenne en dur dans la configuration | Configuration | Écran supprimé |
| A69 | Règle métier ramenée à 0 jamais appliquée (ou-logique au lieu de `??`) | Paramètres | Coalescence nulle |
| A70 | Onglet « Préférences » sans valeur, sans gestionnaire, sans `onClick` | Paramètres | Chargé et enregistré sur `user_profiles` |
| A71 | Interrupteurs de notification figés avec gestionnaire vide | Paramètres | Persistés dans les métadonnées du compte |
| A72 | Ouagadougou absent de la liste des fuseaux | Paramètres | Référentiel corrigé |
| A73 | Réglages de devise et d'unité sans aucun stockage | Paramètres | Retirés, règle appliquée énoncée |
| A74 | Bascule sans nom accessible | Socle | `ariaLabel` + `role="switch"` |
| A75 | Perte silencieuse de fichiers de test malgré le bridage des forks | Outillage | Pool `threads` |
| A76 | Diagramme documentant un processus inexistant | Circuit | Graphe dérivé d'`ALLOWED_TRANSITIONS` |
| A77 | Bouton « Export » du diagramme sans gestionnaire | Circuit | Export SVG réel |
| A78 | Trois étapes du circuit sans libellé français | Socle | Libellés ajoutés au formateur |
| A79 | Rôles propriétaire et administrateur absents de la création de compte | Utilisateurs | Référentiel complet des 7 rôles |
| A80 | Rattachements écrits sans vérification de l'issue | Utilisateurs | Erreurs remontées et bloquantes |
| A81 | Trois composants morts, dont deux important un service inexistant | Administration | Supprimés |
| A82 | Suppression d'une déclaration jamais exécutée (signature de `showConfirm`) | Production | Forme promise, testée |
| A83 | Bouton « Budget » vers `/production/budget` inexistante | Production | Route `/performance/budgets` |
| A84 | Export CSV livrant des UUID au lieu des raisons sociales | Production | Jointure sur le référentiel, testée |
| A85 | Période de consultation écrasée après chaque enregistrement | Production | Période conservée |
| A86 | Barre latérale sautant au clic (groupe choisi sur le premier `startsWith`) | Navigation | Correspondance la plus longue |
| A87 | Premier « Tableau de bord » pointant vers le tableau de bord des artisans | Navigation | Vue nationale `/dashboard` |
| A88 | Deux entrées de menu vers `/artisan-minier` | Navigation | Doublon supprimé |
| A89 | Intitulés de la barre tronqués aux points de suspension | Navigation | Retour à la ligne, hauteurs minimales |
| A90 | Sous-menus indentés de 35 px | Navigation | Ramenés à 20 px |
| A91 | Tableau de bord national sans recensement des artisans | Analyses | Effectifs total et actif |
| A92 | Quatre intitulés de la barre repliés sur deux lignes | Navigation | Une ligne, barre à 268 px |
| A93 | Chevron sur des entrées sans sous-menu | Navigation | Chevron retiré, place rendue à l'intitulé |
| A94 | Le sélecteur d'intitulé attrapait la pastille d'icône | Navigation | Sélecteur restreint, largeur rendue au texte |
| A95 | Barre reconstruite à chaque navigation : défilement remis en haut | Navigation | État visuel conservé hors du composant |
| A96 | Ouverture exclusive : replier un groupe déplaçait celui qu'on venait de cliquer | Navigation | Groupes indépendants |
| A97 | Sous-menu sélectionné collé au titre du groupe | Navigation | 6 px d'écart |
| A98 | Licences : échec de chargement consigné au seul journal | Production | Erreur affichée |
| A99 | Licences : taux d'utilisation divisant par zéro | Production | « — » sans volume autorisé |
| A100 | Licences et budgets encore sur `MainLayout` | Production | `NationalDashboardLayout` |
| A101 | Graphiques de production : deux arcs-en-ciel Tailwind divergents | Production | Rampe unique de la charte |
| A102 | Libellés anglais dans les graphiques et le formulaire de déclaration | Production | Traduits |
| A103 | `DailyProductionForm` mort, non importé, libellés anglais | Production | Supprimé |
| A104 | Budgets : volet de droite à 420 px fixes face à une matrice bridée | Production | Colonnes proportionnées |
| A105 | Page des paiements intégralement en anglais, montants en `en-US` | Paiements | Réécrite en français |
| A106 | Total des paiements additionnant des devises différentes | Paiements | « — » si la devise n'est pas unique |
| A107 | Paiements : échec de chargement en simple `toast` sans trace à l'écran | Paiements | Erreur affichée |
| A108 | Boutons « Export » sans gestionnaire (stocks, détail paiement, audit) | Transverse | Supprimés |
| A109 | Boutons d'export sur des écrans qui ne sont pas des rapports | Transverse | Supprimés sur 13 écrans |
| A110 | Actions d'en-tête collées au sous-titre (`div:first-child` ne matchait jamais) | Socle | Titre extensible, actions à droite |
| A111 | Numéros de reçu avec barres obliques, générés par une fonction distante absente du dépôt | Ventes d'or | `VE-OR-AAAAMM-NNNNN`, service applicatif + migration |
| A112 | Échec de numérotation avalé par un `console.warn` | Ventes d'or | Erreur bloquante |
| A113 | Filtres en bande pleine largeur entre indicateurs et registre | Ventes d'or | Volet latéral |
| A114 | Panneau de cours inventant ouverture, haut et bas 24 h (× 0,995 / × 1,008 / × 0,992) | Cours de l'or | « — » et source nommée |
| A115 | Taux USD/XOF de repli à 600 présenté comme le taux du référentiel | Cours de l'or | Conversions masquées sans taux |
| A116 | Numéro de reçu saisissable à la main | Vente d'or | Attribué à l'enregistrement |
| A117 | `update` propageant un numéro vide, effaçant celui d'une vente enregistrée | Vente d'or | Champ retiré du payload |
| A118 | Numéro de vente annoncé seulement après coup | Vente d'or | Attribué et affiché à l'ouverture, repris à l'enregistrement |
| A119 | Titres en carats sans indication de pureté | Vente d'or | Jauge, 24 K = 100 % |
| A120 | Prix au gramme saisi à l'aveugle, sans référence de marché | Vente d'or | Prérempli au cours, écart affiché |
| A121 | Cours de l'or sondé deux fois sur le même écran, valeurs susceptibles de diverger | Cours de l'or | Hook `useCoursOr` partagé |
| A122 | Suivi des stocks intégralement en anglais, sur `MainLayout` | Stocks | Réécrit à la charte |
| A123 | Ni transit, ni aéroport, ni vendu non réglé dans le suivi des stocks | Stocks | Vue nationale complète |
| A124 | Teneur en argent et raffinerie saisies puis abandonnées à l'enregistrement | Stocks | Persistées |
| A125 | Société minière jamais posée sur le stock, ventilation par mine impossible | Stocks | Colonne alimentée depuis l'expédition |
| A126 | Rendement et écarts calculés sur des dénominateurs nuls | Stocks | « — » quand la référence manque |
| A127 | Filigrane tourné débordant de 137 px, facture en défilement horizontal | Facture | `contain: strict` et rotation en pseudo-élément |
| A128 | `CardTitle` à 24 px : le titre de section pesait plus que ses champs | Socle | Ramené à 16 px |
| A129 | Guide de saisie en volet vert, occupant un tiers de l'écran pour redire les libellés | Sociétés minières | Retiré, indications au pied des champs |
| A130 | Coordonnées de règlement ressaisies à chaque paiement, sans garantie d'appartenance | Paiements artisans | Rattachées à la fiche, choisies au paiement |
| A131 | Aucun rattachement entre le règlement et le moyen employé | Paiements artisans | `moyen_paiement_id` sur le paiement |
| A132 | Dossier de règlement sans accès à la facture de la vente | Paiements artisans | Lien vers le spécimen |
| A133 | `set_sonasp_as_buyer()` comparant `company_type = 'sonasp'`, valeur absente de l'énumération : **aucune vente d'or ne pouvait être créée ni modifiée** | Ventes d'or | SONASP identifiée par son code |
| A134 | `key={location.pathname}` remontant tout le sous-arbre à chaque navigation | Socle | Clé passée en propriété |
| A135 | Habillage rendu par chaque page : barre latérale et en-tête reconstruits à chaque navigation | Socle | Route parente, montée une fois |
| A136 | Repli de suspense hors de l'habillage : écran blanc à chaque chargement de page | Socle | Repli dans la zone de contenu |
| A137 | Service worker en `autoUpdate` : rechargement spontané de la page | Socle | `prompt`, sans rechargement automatique |
| A138 | Regroupement sous l'habillage incomplet : 60 routes le reconstruisaient encore | Socle | 108 routes sur 122 sous la route parente |
| A139 | `user_profiles_role_check` refusant les rôles `owner` et `admin`, pourtant définis dans le code | Comptes | Contrainte élargie aux sept rôles |
| A140 | Centre d'aide relié au seul `Header.tsx`, composant mort : page inatteignable | Socle | Accès depuis l'en-tête |
| A141 | Deux ré-exports (`FreightCompaniesPage`, `RefineryPlantsPage`) hors habillage | Socle | Ramenés sous la route parente |
| A138 | Doublons dans la barre latérale : « Transporteurs » et « Raffineries » présents sous *Parties prenantes* **et** *Administration* | Navigation | Entrées retirées d'Administration |
| A139 | Entrée « Déposants » pointant une entité distincte, alors que le métier attend des « Approbateurs » habilités à valider les ventes | Navigation | Renommée « Approbateurs », pointée sur `/stakeholders/approvers` |
| A140 | Action « Approuver la vente » ouverte à tout utilisateur : la porte facture/paiement n'était pas gardée par un rôle | Ventes d'or | Restreinte à `is_sales_approver` + direction ; page Approbateurs pour accorder/retirer le droit |
| A142 | Module de pré-ventes sans usage : 0 enregistrement en base, aucun lien avec le circuit réel | Ventes d'or | Écrans, service, routes et entrée de menu supprimés ; tables conservées pour la contrainte `customer_accounts_receivable` |
| A143 | Achat de la SONASP aux mines industrielles inexistant : la production déclarée ne débouchait sur aucune acquisition | Mines industrielles | Table `snp_achats_mines`, service, écran `/production/achats-mines` |
| A144 | `sales` inscrivait la mine comme vendeur des ventes hors du Burkina : l'or passait au raffineur sans appartenir à la SONASP | Ventes d'or | Vendeur figé à la SONASP ; stock opposable = achats aux mines + aux artisans − ventes déjà conclues |
| A145 | `gold_sales_settings` n'habilitait que les mines : la liste des clients serait restée vide pour la SONASP vendeuse | Ventes d'or | Une habilitation par client actif ouverte à la SONASP |
| A146 | « Acheter tout le stock » conditionné à une quantité déjà saisie, donc invisible quand il sert | Mines industrielles | Affiché dès la société choisie |
| A147 | Contrôle de stock de la vente interrogeant `daily_production` au nom du vendeur : la SONASP ne déclarant aucune production, toutes les ventes auraient été bloquées | Ventes d'or | Remplacé par le contrôle de couverture sur les lots d'achat |
| A148 | Aucune écriture ne reliait une vente à l'export aux achats qui l'approvisionnent : origine de l'or invérifiable | Traçabilité | Table `snp_ventes_lots`, répartition au plus ancien d'abord, composition affichée sur la fiche de vente |
| A149 | Rien ne détectait une vente créée hors du formulaire, qui entamerait le stock sans origine tracée | Traçabilité | Contrôle de cohérence masse/lots, bannière nommant les ventes concernées sur le tableau de bord des ventes |
| A150 | `ProductionInSafe` comparait le réalisé à des objectifs codés en dur (850/2 800/5 500 oz), affichés avec feux tricolores comme s'ils venaient d'une source | Production | Budget et prévision lus dans `monthly_budgets` et `quarterly_forecasts`, cumulés au prorata des jours ; mois non couvert nommé |
| A151 | Semaine de suivi ouverte le dimanche, contre l'usage burkinabè et le découpage des déclarations | Production | Semaine ouverte le lundi |
| A152 | `ProductionDetails` comblait les données absentes par « Kourousa », « KOURO-2511-1000 » et le pays « Guinée » — vestiges d'un autre projet affichés comme réels | Production | Aucune valeur suppléée ; le pays vient de `mining_companies.country` |
| A153 | Bouton « Modifier » pointant `/production/daily-production`, route inexistante : la modification n'aboutissait jamais | Production | Renvoi vers `/production/daily` avec ouverture du formulaire sur la déclaration |
| A154 | Historique des statuts résolvant les auteurs dans la table `profiles`, absente du schéma : toute modification attribuée à « Système » | Production | Résolution sur `user_profiles`, en une requête, avec distinction système / auteur inconnu |
| A155 | Site national identifié `guinea` dans la base (`daily_production`, `annual_budgets`, `production_forecasts`) et en défaut de paramètre dans dix services | Socle | Constante `SITE_NATIONAL` unique + migration vers `burkina_faso` |
| A156 | Lignes de production référençant un compte supprimé : la clé en NO ACTION faisait échouer **toute** mise à jour, changement de statut compris | Production | Références orphelines mises à NULL, clés passées en ON DELETE SET NULL sur cinq tables |
| A157 | Références de barres préfixées `HUM…` — codes de mines maliennes, guinéennes et libériennes — parfois sans rapport avec la société de la ligne | Production | Préfixe issu du code de la société ; renumérotation `SBM-0001`, `WGM-0001` |
| A158 | Bordereau de colisage expédiant au nom de « HUMMINGBIRD RESOURCES » depuis Bamako, Mali | Expéditions | Expéditeur : SONASP, Ouagadougou |
| A159 | `/customers/:id/payments` affichait une vente inventée et n'enregistrait rien : le bouton revenait en arrière | Paiements | Écran supprimé, route renvoyée vers l'écran qui enregistre |
| A160 | Trois comptes bancaires inventés proposés au règlement faute de paramétrage | Paiements | Liste vide et paramètre manquant nommé à l'écran |
| A161 | Filtre des sociétés productrices comparant à « Mansa Resources S.A. », absente du référentiel : la SOPAMIB et la SONASP figuraient parmi les mines | Référentiels | Tri sur `company_type` |
| A162 | Trois des cinq paires de change suivies libellées en franc guinéen, sans cours au Burkina | Marché | Paires ramenées à USD/XOF, EUR/XOF, EUR/USD |
| A163 | Six rapports PDF et un export Excel entièrement inventés, signés SONASP | Rapports | Exports refusés en nommant la source manquante ; générateur de 602 lignes supprimé |
| A164 | Six onglets d'analyses reposant sur 157 lignes de données écrites en dur | Analyses | Bannière annonçant que les chiffres ne viennent pas de la base ; raccordement à faire |
| A165 | « Or en coffre » comptait les barres déjà parties : 4 sur 10 étaient rattachées à une expédition partie, dont 2 chez le raffineur | Production | Sortie du coffre au départ de l'expédition ; décompte des barres retirées affiché |
| A166 | Filtre de statut proposant « Expédié » et « Affiné », absents de `production_status_v2` : la table se vidait sans explication | Production | Entrées retirées |
| A167 | Définitions et règles de gestion affichées en pavés permanents en haut des écrans (14 notes de plus de 115 caractères) | Socle | Primitive `Infobulle` ; `PageHeader` et `Section` acceptent une propriété `info` |
| A168 | Messages énumérant chaque mois manquant (« Prévision absente pour avril 2026, mai 2026… ») | Production | Messages ramenés à « Prévision non saisie », « Source illisible » |
| A169 | `sites_country_check` limité à 'GN', 'CI', 'ML' : le schéma interdisait d'enregistrer un site burkinabè | Socle | Liste élargie à BF et aux pays voisins ; sites remplacés |
| A170 | `fx_rates_daily_currency_pair_check` sans EUR/XOF, paire pourtant suivie par les écrans de marché | Marché | Paire autorisée |
| A171 | `sales_seller_type_check` limité à 'mining_company' et 'mansa_ressources' : la SONASP ne pouvait pas se désigner vendeur | Ventes | Valeur 'sonasp' ajoutée |
| A172 | 57 clés étrangères vers `auth.users` en NO ACTION : toute ligne référençant un compte supprimé était immodifiable (généralisation de A156) | Socle | Conversion en ON DELETE SET NULL, table par table |
| A173 | Référentiel résiduel : abréviations KGM/DGB/MAN, SONASP nommée « Substances Naturelles », expéditions préfixées HUM-SMK | Référentiels | Corrigés ; expéditions renumérotées EXP-BF-AAAA-NNN |
| A174 | Vente artisanale VE-OR-2025-00001 à 2 740 000 000 FCFA le kilogramme, trente-quatre fois le cours : 125 g valorisés 342 millions | Marché artisanal | Prix recalculé au cours de la période, ajusté du titre ; ancienne valeur mentionnée en observation |
| A175 | Module artisanal sans moyen de paiement, sans facture définitive et sans règlement : les écrans de suivi affichaient des compteurs à zéro | Marché artisanal | 30 moyens, 36 ventes, 30 factures, 24 règlements et leurs taxes |
| A176 | `user_profiles` sans rattachement à une société minière : l'isolation « une mine ne voit que ses demandes » était inapplicable | Socle | Colonne `mining_company_id` + politiques RLS sur les sept tables du module |
| A177 | Éligibilité calculée sur la production validée mais engagements déduits de la production déclarée : éligible nul partout | Achats industriels | Assiette unifiée sur la production déclarée non annulée |
| A178 | Paramètre de sortie `demande_id` en conflit avec la colonne homonyme : toute approbation échouait sur « column reference is ambiguous » | Achats industriels | Sorties préfixées `r_`, tables aliasées |
| A179 | Le montant payé d'une facture comptait toute affectation active : un règlement en brouillon soldait la dette avant toute exécution bancaire | Règlements | Distinction engagé / payé ; la dette ne baisse qu'à l'exécution confirmée |
| A180 | Cycle de règlement à quatre états, confondant validation interne, émission de l'ordre, exécution bancaire et rapprochement | Règlements | Huit états, transitions contrôlées, preuve exigée avant exécution |
| A181 | Deux profils sur trois sans compte `auth.users` : actifs à l'écran, aucune connexion possible — et la séparation des fonctions les comptait comme validateurs | Socle | Décompte joint à `auth.users` ; les profils orphelins restent à rattacher ou désactiver |
| A182 | `snp_affecter_fifo` refusait tout règlement hors brouillon : le bouton « Imputer » d'un acompte validé renvoyait 400 sans rien afficher | Règlements | Imputation possible jusqu'à l'exécution ; messages d'échec explicites |
| A183 | Formulaires portant des mentions du carnet de développement (« c'est la protection contre le double ordre », « seul mode admis ») | Socle | Six mentions retirées ; un formulaire applique ses règles, il ne les récite pas |
| A184 | Aucune imputation possible sur un règlement exécuté ou rapproché : les 450 M non imputés de REG-DEMO-0003 restaient inaccessibles | Règlements | Le reliquat s'impute toujours ; seule la modification d'une imputation exécutée est interdite |
| A185 | Tirets cadratins dans les libellés et notes décrivant le fonctionnement interne, sur l'ensemble de la plateforme | Socle | 9 tirets et 3 notes traités ; règle posée pour les écrans à venir |

---

## 7. Tests

| Gate | État |
|---|---|
| `npm run build` | vert |
| `npx vitest run` | **529/529 verts** (62 fichiers), audit d'intégrité passé |
| `npm run typecheck` | 141 erreurs préexistantes (829 à l'origine, −83 %) |

Timeout vitest relevé à 20 s : deux tests différents échouaient d'une exécution à
l'autre à exactement 5 s (plafond par défaut) sous charge — aucune régression.

---

## 8. Risques résiduels

- Le rattachement artisan↔site repose sur `commune = localité` faute de `site_id` sur
  `snp_artisans_miniers`. Migration à prévoir.
- Les contours provinciaux sont un découpage de proximité, pas un référentiel cadastral.
- Les migrations `20260817_*` et `20260817_003` ne sont pas appliquées en base.
- Les migrations `20260819_001` à `20260819_006` **sont appliquées** sur `SONASP_OPS`
  (projet `yyverzuhkdonjjuficor`), vérifiées après coup.
- La migration `20260819_006_add_sales_approver_flag` (colonne `user_profiles.is_sales_approver`)
  **est appliquée** sur `SONASP_OPS` ; additive et non destructive.
- Les migrations `20260819_007_achats_mines` (table `snp_achats_mines`) et
  `20260819_008_sonasp_vendeuse_export` (habilitations commerciales de la SONASP) **sont
  appliquées** sur `SONASP_OPS` ; additives, retour arrière documenté en tête de fichier.
- La migration `20260820_001_tracabilite_lots_vente` (table `snp_ventes_lots`) **est
  appliquée** sur `SONASP_OPS` ; additive, retour arrière documenté en tête de fichier.
- Les migrations `20260820_005` (référentiel burkinabè), `20260820_006` (clés d'auteur,
  généralisation) et `20260820_007` (jeu de présentation 2026) **sont appliquées** sur
  `SONASP_OPS`. La 007 dépend des deux précédentes.
- Les migrations `20260820_002` (site national), `20260820_003` (auteurs supprimés) et
  `20260820_004` (références de barres) **sont appliquées** sur `SONASP_OPS`. La 004 exige la
  003 : sans elle, toute mise à jour de `daily_production` échoue sur une clé orpheline.

---

## 9. Prochaine action exacte

**Retirer le jeu de présentation avant toute mise en service réelle.** Les libellés ne
l'annoncent plus à l'écran : le repère est désormais la **date de création, 20 août 2026**. Les
requêtes de suppression, à jour, figurent en tête de
`supabase/migrations/20260820_008_libelles_metier.sql` et
`20260820_009_marche_or_artisanal_2026.sql`.

Puis **raccorder le module d'analyses aux données réelles** (A164) : six onglets, 157 lignes
écrites en dur, aujourd'hui signalées par une bannière mais toujours affichées. Puis le moteur
de rapports (A163), dont les exports sont refusés faute de source.

Ensuite, **poursuivre le lot 7 — Production (4/7 traités)** : `ExportLicenseForm` (836),
`ExportLicenseDetails` (332) et `BudgetManagementPage` (1477).

En parallèle, **obtenir de la DGI les éléments qui débloquent la facturation certifiée** : cahier des
charges du SFE, protocole SFE ↔ MCF, spécification du QR, arrêté 2025-0047 et article 564
§2 du CGI ; engager l'acquisition du MCF auprès de la CCI-BF et le dossier
d'homologation. Le spécimen de facture est en place et sert la démonstration.
Ensuite, **raccorder le moteur d'analyse de `/analytics/assistant`**, puis poursuivre le
**lot 7 — Production (1/7 traité).** Restent : `ProductionDetails` (643),
`ProductionInSafe` (657), `ExportLicensesPage` (369), `ExportLicenseForm` (836),
`ExportLicenseDetails` (332) et `BudgetManagementPage` (1477).
