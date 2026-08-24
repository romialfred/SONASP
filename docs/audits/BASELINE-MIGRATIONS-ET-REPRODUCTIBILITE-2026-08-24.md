# Lot 4D — Baseline des migrations et reproductibilité

- Date : 24 août 2026
- Périmètre : fichiers locaux uniquement
- Base distante : aucune connexion, requête, réparation ou application effectuée

## Verdict

La chaîne locale n'est pas encore reconstructible de façon fiable. Elle contient des versions dupliquées, des fichiers ignorés par le format Supabase et deux largeurs de préfixe. Un renommage automatique serait dangereux : une version peut déjà être enregistrée dans un historique distant sous son ancien identifiant, et deux scripts partageant la même version n'ont pas d'ordre d'application contractuel.

Le Lot 4D ajoute donc un verrou de non-régression sans prétendre corriger l'historique :

- chaque fichier SQL local est catalogué avec son chemin, sa taille canonique et son SHA-256 après normalisation CRLF/CR vers LF ;
- les anomalies historiques sont enregistrées comme dette connue ;
- la CI accepte seulement l'état catalogué à l'octet près ;
- l'audit strict reste rouge tant que la dette n'est pas réconciliée ;
- un catalogue existant ne peut pas être écrasé par la commande de génération ;
- le rapprochement distant est possible à partir d'un manifeste relu et fourni explicitement, sans accès réseau implicite.

Ce catalogue n'est pas une baseline de schéma live et ne prouve pas que `supabase db reset` réussit. Il empêche l'historique local de continuer à dériver silencieusement pendant la réconciliation.

## Inventaire actualisé

| Mesure | Audit principal avant P0–4C | État local Lot 4D | Interprétation |
|---|---:|---:|---|
| Fichiers SQL | 133 | 138 | cinq migrations canoniques P0, 1D, 4A, 4B et 4C ont été ajoutées localement |
| Fichiers sans préfixe numérique | 11 | 11 | ignorés comme migrations par l'outillage Supabase |
| Fichiers avec préfixe numérique | 122 | 127 | fichiers adressables, mais pas nécessairement versions uniques |
| Versions distinctes locales | 45 | 50 | unité pertinente pour comparer un historique de versions |
| Fichiers strictement canoniques | non mesuré | 29 | préfixe UTC valide à 14 chiffres et nom en minuscules `snake_case` |
| Groupes de versions dupliquées | 11 | 11 | ordre ambigu, 77 fichiers excédentaires au-delà d'un fichier par version |
| Préfixes non canoniques | non mesuré | 98 | 97 préfixes à huit chiffres et `20260824235960`, dont les secondes valent 60 |
| Noms non canoniques | non mesuré | 8 | descriptions historiques contenant des majuscules |
| Largeurs de version | non mesuré | 8 et 14 | 97 fichiers à huit chiffres, 30 à quatorze chiffres |

Le total de 129 constats stricts est un compteur de règles, pas un nombre de fichiers uniques : un même fichier peut être à la fois dans un groupe dupliqué et avoir un préfixe ou un nom non canonique.

Les onze groupes de versions ambiguës restent :

`20251112`, `20251113`, `20251114`, `20251115`, `20251117`, `20251227`, `20260817`, `20260819`, `20260820`, `20260821`, `20260822`.

## Réconciliation avec la dérive documentée

L'audit principal indique 17 versions communes, 28 versions locales absentes du serveur et 72 versions serveur absentes du dépôt. La somme `17 + 28 = 45` correspond bien aux 45 versions locales distinctes avant les cinq lots P0–4C. Si l'historique distant n'a pas changé — hypothèse non vérifiée dans ce lot — les cinq nouvelles versions feraient passer le local-only théorique de 28 à 33.

Le rapport du 23 août indiquait 4 entrées communes et 106 locales uniquement. Ce chiffre comptait des lignes/fichiers historiques alors que l'audit principal déduplique les préfixes de version. Les deux mesures ne doivent donc pas être comparées directement. Le catalogue Lot 4D conserve explicitement les deux notions : fichier physique et version distincte.

La valeur distante de 72 versions absentes du dépôt est seulement une preuve datée du rapport. Aucun résultat « live confirmé » n'est revendiqué par le Lot 4D.

## Artefacts et commandes

### Vérification bloquante de non-régression

```powershell
node scripts/check-migration-integrity.mjs verify
```

Le contrôle échoue si :

- un fichier catalogué manque ;
- un fichier SQL inattendu apparaît ;
- un octet SQL significatif, la taille canonique ou le SHA-256 d'un fichier change ;
- la liste des doublons, préfixes, noms, entrées SQL non régulières ou ordres ambigus change ;
- le catalogue lui-même ne correspond plus à son digest.

Un nouveau fichier canonique est donc également bloqué jusqu'à une revue explicite du nouveau catalogue. Cette contrainte est volontaire pendant le gel des migrations.

### Audit strict

```powershell
node scripts/check-migration-integrity.mjs audit
```

Cette commande retourne un code non nul tant qu'il reste un doublon, un fichier non versionné, un préfixe non canonique, un nom non canonique ou des largeurs de versions mixtes. Elle n'applique et ne renomme rien.

### Tests unitaires

```powershell
node --test tests/migrations/migration-integrity.test.mjs
```

Les tests couvrent timestamps impossibles, doublons, ordre ambigu, déterminisme, équivalence LF/CRLF, altération d'un octet significatif, ajout, suppression, falsification du catalogue et divergence avec un manifeste distant.

### Génération sûre d'un candidat

Le générateur refuse d'écraser un catalogue existant. Pour préparer une évolution :

```powershell
node scripts/check-migration-integrity.mjs snapshot --output supabase/migrations.catalogue.candidate.json
node scripts/check-migration-integrity.mjs verify --catalogue supabase/migrations.catalogue.candidate.json
```

Le candidat doit ensuite être comparé au catalogue courant, relié à une demande de changement et approuvé à quatre yeux. La CI ne doit jamais exécuter `snapshot` et le candidat ne doit pas remplacer automatiquement la baseline.

## Manifeste distant hors ligne

La comparaison distante n'effectue aucune connexion. Elle exige un fichier JSON produit séparément par un opérateur autorisé :

```json
{
  "formatVersion": 1,
  "source": "export en lecture seule revu",
  "versions": [
    "20260822154000",
    {
      "version": "20260823103000",
      "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    }
  ]
}
```

Commande :

```powershell
node scripts/check-migration-integrity.mjs verify --remote-history chemin/manifest-distant.json
```

Le checksum de l'exemple est une valeur illustrative. Le contrôle compare versions locales/distantes, doublons de chaque côté et checksums quand le manifeste contient une archive SQL fiable. Une simple sortie `supabase migration list` ne prouve pas le contenu SQL appliqué ; il faut omettre `sha256`, et non inventer une valeur, lorsque l'historique distant ne le fournit pas.

## Procédure de réconciliation recommandée

1. Maintenir le gel des migrations et le gate `verify`.
2. Faire exporter par un opérateur autorisé l'historique distant et un dump de schéma en lecture seule, puis signer/conserver ces artefacts.
3. Construire une matrice `version distante → SQL archivé → checksum → objet de schéma` ; classer les 72 versions distantes absentes.
4. Restaurer le dump dans une base jetable et comparer catalogues PostgreSQL, contraintes, policies, grants, fonctions et Storage.
5. Pour chaque préfixe local dupliqué, déterminer l'ordre réellement exécuté à partir des preuves, sans se fier au tri des noms.
6. Produire une baseline canonique revue. Ne jamais réécrire l'historique distant ; employer des migrations compensatoires horodatées et uniques.
7. Seulement après réussite du reset sur clone, générer les types et rendre l'audit strict bloquant.

## Risques résiduels

- SHA-256 assure l'intégrité accidentelle, pas l'authenticité : un auteur pouvant modifier simultanément script, catalogue et CI peut recalculer les digests. Les fins de ligne seules sont volontairement normalisées pour garantir le même résultat sous Windows/Linux. Protéger les fichiers par `CODEOWNERS`, revue obligatoire et branche protégée.
- Le catalogue fige aussi la dette historique ; un `verify` vert ne signifie ni que les scripts sont sûrs, ni qu'ils sont rejouables.
- Les checksums distants restent inconnus dans ce lot. Seules les divergences documentées sont disponibles.
- Le préfixe `20260824235960` est accepté comme nombre par certains outils mais n'est pas un timestamp UTC valide. Il est signalé, pas renommé.
- Les onze fichiers sans version et les scripts SQL hors `supabase/migrations` restent hors chaîne d'application ; leur consolidation exige une décision de baseline.
- Le workflow CI ne se connecte à aucune base et ne remplace pas un `supabase db reset` sur clone une fois l'historique réconcilié.
