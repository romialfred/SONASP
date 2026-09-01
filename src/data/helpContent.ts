export interface HelpArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  subcategory?: string;
  tags: string[];
  relatedModules?: string[];
  lastUpdated: string;
}

export interface HelpCategory {
  id: string;
  title: string;
  icon: string;
  description: string;
  articles: HelpArticle[];
}

const lastUpdated = '2026-08-22';

export const helpCategories: HelpCategory[] = [
  {
    id: 'getting-started',
    title: 'Prise en main',
    icon: 'Rocket',
    description: 'Comprendre le périmètre SONASP et retrouver les fonctions utiles.',
    articles: [
      {
        id: 'welcome',
        title: 'Bienvenue sur la plateforme SONASP',
        category: 'getting-started',
        tags: ['SONASP', 'présentation', 'navigation'],
        relatedModules: ['navigation', 'security'],
        content: `# Plateforme nationale SONASP

La plateforme accompagne la collecte, le contrôle, l'achat et la vente des substances précieuses au Burkina Faso. Les informations visibles dépendent du rôle de l'utilisateur et, pour les comptes rattachés à une mine, du périmètre de cette société.

## Repères principaux

- **Tableaux de bord** : synthèse des opérations autorisées.
- **Production et expéditions** : prévisions, déclarations, analyses, enlèvements et expéditions.
- **Achats et ventes** : décisions, pièces justificatives et suivi des règlements.
- **Administration** : comptes, rôles et habilitations, réservés aux responsables autorisés.

Les chiffres affichés proviennent des enregistrements accessibles à votre compte. Les données indisponibles sont signalées comme telles.`,
        lastUpdated,
      },
      {
        id: 'navigation',
        title: 'Naviguer selon son rôle',
        category: 'getting-started',
        tags: ['menu', 'rôle', 'mine', 'périmètre'],
        relatedModules: ['navigation', 'security'],
        content: `# Naviguer selon son rôle

Le menu latéral présente uniquement les modules ouverts par vos habilitations.

## Utilisateur d'une société minière

Le compte ouvre le périmètre de la société à laquelle il est rattaché. Les listes, indicateurs et documents restent cloisonnés à cette mine.

## Administrateur général

Le compte **Owner** dispose du périmètre national. Le sélecteur de mine dans l'en-tête permet de consulter une société sans modifier le rattachement des utilisateurs.

## Bonnes pratiques

1. Vérifiez la société sélectionnée avant une consultation ou une décision.
2. Utilisez le fil d'Ariane pour revenir au niveau précédent.
3. Fermez la session dès que vous quittez un poste partagé.`,
        lastUpdated,
      },
    ],
  },
  {
    id: 'batch-management',
    title: 'Production et expéditions',
    icon: 'Package',
    description: "Suivre la matière depuis la déclaration jusqu'à l'expédition.",
    articles: [
      {
        id: 'create-batch',
        title: 'Enregistrer une opération de production',
        category: 'batch-management',
        tags: ['production', 'lot', 'analyse', 'expédition'],
        relatedModules: ['production', 'shipping', 'inventory'],
        content: `# Enregistrer une production

Avant toute saisie, vérifiez la période, le site et la société minière affichés.

1. Ouvrez le module **Production** autorisé pour votre rôle.
2. Renseignez la date, le site, le poids et les caractéristiques disponibles.
3. Joignez les justificatifs demandés par le processus métier.
4. Relisez la saisie, puis enregistrez-la.

Une donnée enregistrée doit rester traçable. N'utilisez pas une valeur estimée comme résultat d'analyse définitif et ne téléversez pas de document qui ne correspond pas à l'opération.`,
        lastUpdated,
      },
      {
        id: 'batch-workflow',
        title: 'Chaîne de traitement de la matière',
        category: 'batch-management',
        tags: ['workflow', 'traçabilité', 'enlèvement', 'expédition'],
        relatedModules: ['production', 'shipping', 'inventory'],
        content: `# Chaîne de traitement

Le parcours opérationnel relie les étapes suivantes :

**Prévision → Déclaration → Analyse laboratoire → Enlèvement → Expédition → Réception → Stock SONASP**

Chaque transition dépend des droits de l'utilisateur et de l'état réel de l'opération. Les étapes sensibles doivent conserver leur auteur, leur date et les pièces associées.

## En cas de blocage

- contrôlez le statut courant ;
- vérifiez que les données obligatoires et les documents sont présents ;
- confirmez que votre rôle autorise la transition ;
- contactez un administrateur si le périmètre de la mine n'est pas correct.

Ne recréez pas une opération pour contourner un statut bloqué : cela romprait la traçabilité.`,
        lastUpdated,
      },
    ],
  },
  {
    id: 'presales',
    title: 'Achats SONASP',
    icon: 'PackagePlus',
    description: 'Suivre les engagements et acquisitions auprès des producteurs.',
    articles: [
      {
        id: 'presales-overview',
        title: 'Du producteur au stock SONASP',
        category: 'presales',
        tags: ['achat', 'SONASP', 'producteur', 'validation'],
        relatedModules: ['purchases', 'inventory', 'payments'],
        content: `# Du producteur au stock SONASP

Les productions industrielles et artisanales suivent leur circuit d'achat propre. La SONASP est identifiée par son code institutionnel **SONASP**, jamais par une approximation de nom.

Une acquisition doit être fondée sur une production ou une vente source, une quantité contrôlée, un prix explicite et les validations requises. Le stock disponible ne doit augmenter qu'après une opération métier enregistrée et traçable.

Si la source, le poids ou le prix manque, l'opération doit rester incomplète plutôt que recevoir une valeur fictive.`,
        lastUpdated,
      },
    ],
  },
  {
    id: 'sales',
    title: 'Ventes et règlements',
    icon: 'ShoppingCart',
    description: 'Préparer une vente extérieure et suivre ses décisions.',
    articles: [
      {
        id: 'sales-overview',
        title: 'Circuit de vente SONASP',
        category: 'sales',
        tags: ['vente', 'client', 'approbation', 'paiement'],
        relatedModules: ['sales', 'customers', 'inventory', 'payments'],
        content: `# Circuit de vente SONASP

La SONASP centralise le stock national acquis et constitue le vendeur institutionnel vers les clients extérieurs enregistrés.

## Principes

1. Sélectionner un acheteur actif et un stock réellement disponible.
2. Utiliser le cours et le taux de change datés affichés par la plateforme.
3. Soumettre la proposition aux niveaux d'approbation configurés.
4. Conserver séparément la décision interne et l'acceptation du client.
5. Enregistrer le règlement avec ses justificatifs avant la clôture.

Une vente refusée ou annulée n'est pas effacée : son historique reste consultable selon les habilitations.`,
        lastUpdated,
      },
    ],
  },
  {
    id: 'inventory',
    title: 'Stock et traçabilité',
    icon: 'Warehouse',
    description: 'Comprendre les quantités disponibles, réservées et vendues.',
    articles: [
      {
        id: 'inventory-overview',
        title: 'Lecture du stock national',
        category: 'inventory',
        tags: ['stock', 'traçabilité', 'quantité', 'inventaire'],
        relatedModules: ['inventory', 'production', 'sales'],
        content: `# Lecture du stock national

- **Disponible** : quantité contrôlée qui n'est pas engagée dans une vente.
- **Réservé** : quantité affectée à une opération en cours.
- **Vendu** : quantité rattachée à une vente finalisée selon le processus autorisé.

Les totaux doivent pouvoir être rapprochés de leurs opérations sources. Si un découvert ou une incohérence apparaît, aucune nouvelle vente ne doit être créée avant régularisation.`,
        lastUpdated,
      },
    ],
  },
  {
    id: 'system',
    title: 'Sécurité et administration',
    icon: 'Settings',
    description: 'Protéger les comptes, rôles, périmètres et sessions.',
    articles: [
      {
        id: 'user-roles',
        title: 'Comptes, habilitations et double authentification',
        category: 'system',
        tags: ['compte', 'MFA', '2FA', 'rôle', 'session'],
        relatedModules: ['security', 'users', 'navigation'],
        content: `# Sécurité des comptes

Chaque utilisateur reçoit un rôle et, lorsqu'il travaille pour une mine, un rattachement explicite à cette société. Les droits doivent suivre le principe du moindre privilège.

## Activation

Le lien reçu par courriel permet à l'utilisateur de définir son mot de passe. L'enrôlement à la double authentification est ensuite obligatoire avant l'accès aux modules protégés.

## Session

Une alerte prévient l'utilisateur avant l'expiration pour inactivité. Sans reprise volontaire, la session est fermée. La fermeture de l'onglet ne doit pas transformer une session de navigateur en connexion persistante.

Ne partagez jamais un code de double authentification, un lien d'activation ou un mot de passe.`,
        lastUpdated,
      },
    ],
  },
];

export function searchHelpContent(query: string): HelpArticle[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('fr');
  if (!normalizedQuery) return [];

  return helpCategories.flatMap((category) =>
    category.articles.filter((article) =>
      article.title.toLocaleLowerCase('fr').includes(normalizedQuery)
      || article.tags.some((tag) => tag.toLocaleLowerCase('fr').includes(normalizedQuery))
      || article.content.toLocaleLowerCase('fr').includes(normalizedQuery)
      || category.title.toLocaleLowerCase('fr').includes(normalizedQuery)
    )
  );
}

export function getArticleById(id: string): HelpArticle | null {
  for (const category of helpCategories) {
    const article = category.articles.find((candidate) => candidate.id === id);
    if (article) return article;
  }
  return null;
}

export function getRelatedArticles(articleId: string): HelpArticle[] {
  const article = getArticleById(articleId);
  if (!article?.relatedModules) return [];

  return helpCategories
    .flatMap((category) => category.articles)
    .filter((candidate) =>
      candidate.id !== articleId
      && candidate.relatedModules?.some((module) => article.relatedModules?.includes(module))
    )
    .slice(0, 3);
}
