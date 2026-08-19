# SONASP — Consignes de travail

Plateforme nationale burkinabè de collecte et de traçabilité de l'or.
React 18 + Vite + TypeScript + Tailwind + Supabase.

## À lire en premier, à chaque session

1. **`IMPLEMENTATION_PROGRESS.md`** — état d'avancement, inventaire des écrans, registre des
   anomalies (A1, A2, …), et **l'action suivante exacte** en fin de document.
2. **`docs/JOURNAL-IMPLEMENTATION.md`** — journal des itérations : ce qui a été trouvé, ce
   qui a été décidé et pourquoi.

Ces deux fichiers portent toute la continuité du chantier. Une session neuve n'a aucun
souvenir des échanges précédents : elle reprend à partir d'eux.

## Mandat en cours

Refonte intégrale de la plateforme existante, module par module.

- **Ne pas repartir de zéro.** Ce qui fonctionne est préservé et amélioré ; aucune
  régression n'est acceptable.
- **Cycle par lot** : audit → refonte → tests → vérification des portes → mise à jour du
  suivi → lot suivant, sans attendre de relance.
- **Aucun bouton décoratif.** Une action affichée doit agir. Les écrans qui n'enregistrent
  rien sont soit branchés sur un stockage réel, soit retirés — jamais laissés en place.
- **Aucune donnée inventée.** Un indicateur qui ne peut pas être calculé affiche « — » ou
  une mention explicite, et la source manquante est nommée à l'écran. Pas de jeu de
  démonstration en production.
- **Tout en français**, y compris les libellés d'erreur et les exports.

## Socle technique

- **Charte visuelle** : `src/styles/design-system.css` (jetons `--sn-*`, classes `sn-`) et
  les primitives `src/components/ui/sn/index.tsx` (`PageHeader`, `Section`, `Field`,
  `StatGrid`, `Badge`, `Note`, `EmptyState`, `Segmented`, `ChoiceCards`…).
- **Mise en page** : `NationalDashboardLayout` — ne plus utiliser `MainLayout` sur les
  écrans refondus.
- **Erreurs** : `errorMessage()` (`src/lib/errorMessage.ts`). Les erreurs Supabase sont des
  objets simples, pas des `Error` : ne jamais tester `instanceof Error` seul.
- **Rôles** : `src/lib/roleLabels.ts` — libellés français et référentiel complet des
  sept rôles.
- **Habilitations** : `src/services/userPermissionsService.ts` est **l'unique** point
  d'écriture sur `user_permissions`.

## Portes de validation

À passer avant de clore un lot, et à reporter dans `IMPLEMENTATION_PROGRESS.md` :

```bash
npx vitest run && npm run build && npx tsc --noEmit -p tsconfig.app.json
```

Le typage porte des erreurs héritées : la consigne est de **ne pas en ajouter** et de les
réduire quand un écran est refondu.

## Exploitation locale

Le serveur de développement écoute sur le port **5180** (`strictPort`) : le 5173 est occupé
par un autre projet du poste.

```bash
npm run dev
```
