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

---

## 7. Tests

| Gate | État |
|---|---|
| `npm run build` | vert |
| `npx vitest run` | **368/368 verts** (50 fichiers) |
| `npm run typecheck` | 179 erreurs préexistantes (829 à l'origine, −78 %) |

Timeout vitest relevé à 20 s : deux tests différents échouaient d'une exécution à
l'autre à exactement 5 s (plafond par défaut) sous charge — aucune régression.

---

## 8. Risques résiduels

- Le rattachement artisan↔site repose sur `commune = localité` faute de `site_id` sur
  `snp_artisans_miniers`. Migration à prévoir.
- Les contours provinciaux sont un découpage de proximité, pas un référentiel cadastral.
- Les migrations `20260817_*` et `20260817_003` ne sont pas appliquées en base.

---

## 9. Prochaine action exacte

**Poursuivre le lot 7 — Production (1/7 traité).** Restent : `ProductionDetails` (643),
`ProductionInSafe` (657), `ExportLicensesPage` (369), `ExportLicenseForm` (836),
`ExportLicenseDetails` (332) et `BudgetManagementPage` (1477).
