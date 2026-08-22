# Vitrine institutionnelle SONASP

La vitrine est intégrée à l’application React/Vite existante. Les routes publiques sont chargées séparément du back-office afin de ne pas imposer son bundle aux visiteurs. Le Portail Mine reste protégé par l’authentification, le profil actif, le rattachement à une société et les politiques de base de données.

## Routes livrées

- `/` : vitrine institutionnelle complète ;
- `/actualites` et `/actualites/:slug` : publications issues de Supabase ;
- `/assistance` : centre d’aide et formulaire protégé ;
- `/mentions-legales`, `/confidentialite`, `/conditions-utilisation`, `/securite` ;
- `/recuperer-acces` et `/modifier-mot-de-passe` ;
- `/portail-mine` : espace privé réservé à la société rattachée ;
- `/admin/publications` : administration des publications pour les rôles SONASP autorisés.

## Lancement local

```bash
npm install
npm run dev
```

Le serveur local utilise `http://localhost:5180`. Pour valider une version de production :

```bash
npm run typecheck
npm test -- --run
npm run build
npm run preview
```

L’hébergeur doit rediriger les routes applicatives inconnues vers `index.html` afin que React Router traite les URL directes.

## Paramètres

Le frontend utilise les paramètres Supabase déjà attendus par l’application :

```dotenv
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

Pour une publication officielle, fournir également l’origine HTTPS exacte au moment du build :

```dotenv
SONASP_PUBLIC_BASE_URL=https://domaine-officiel.example
```

Cette valeur injecte les URL absolues du sitemap, la canonique et l’image Open Graph. En son absence, le code n’invente aucun domaine.

## Base de données et assistance

Appliquer, dans l’ordre, les migrations suivantes :

1. `supabase/migrations/20260821_031_portail_mine_securite.sql` ;
2. `supabase/migrations/20260821_032_vitrine_publique.sql`.

Configurer ensuite la fonction Edge :

```dotenv
PUBLIC_SITE_ORIGINS=https://domaine-officiel.example
ASSISTANCE_HASH_SALT=une-valeur-aleatoire-longue-et-secrete
```

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis par l’environnement Supabase. Déployer la fonction publique sans vérification JWT, car elle applique elle-même l’origine autorisée, la validation, le leurre anti-robot, la temporisation et la limitation de cinq demandes par tranche de quinze minutes :

```bash
supabase functions deploy public-assistance --no-verify-jwt
```

Les demandes ne peuvent pas être insérées directement avec la clé anonyme. Les contenus publiés sont les seuls lisibles publiquement.

## Contenus et ressources

Les textes français et anglais sont centralisés dans `src/pages/public/publicContent.ts`. Les actualités sont administrées depuis `/admin/publications`. Les valeurs de démonstration des aperçus métier sont explicitement signalées et n’exposent aucune donnée nationale ou minière.

Les armoiries proviennent de la source officielle de la Présidence du Faso. Le logo existant de l’application est conservé sans reconstruction. Le visuel minier est une illustration générée, optimisée en AVIF, WebP et JPEG, et indiquée comme scène reconstituée dans la page.

## Contrôles disponibles

- captures aux largeurs 1440, 1280, 1024, 768, 430, 390 et 360 px dans `docs/vitrine/captures/` ;
- rapport visuel : `RAPPORT-COMPARAISON-VISUELLE.md` ;
- non-régression : `RAPPORT-NON-REGRESSION.md` ;
- audit final : `AUDIT-FINAL.md` ;
- audit des dépendances : `RAPPORT-DEPENDANCES.md` ;
- inventaire des fichiers : `FICHIERS-MODIFIES.md`.
