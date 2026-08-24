export const dailyProductionFieldGuides = {
  production_date: {
    title: 'Date de production',
    description: 'Jour auquel cette coulée est rattachée.',
    example: '15/11/2025',
    required: true
  },
  mining_company_id: {
    title: 'Société minière',
    description: 'Mine à l’origine du doré.',
    example: 'SBM',
    required: true
  },
  bar_reference: {
    title: 'Référence de barre',
    description: 'Référence automatique : code de la société puis compteur',
    example: 'SBM-0001',
    readOnly: true
  },
  bullion_grams: {
    title: 'Doré pesé',
    description: 'Poids total du doré, automatiquement converti en onces.',
    example: '11270 g',
    required: true
  },
  estimated_gold_pct: {
    title: 'Teneur en or (%)',
    description: 'Part estimée d’or fin dans le doré, de 0 à 100 %.',
    example: '92.1%',
    required: true
  },
  estimated_silver_pct: {
    title: 'Teneur en argent (%)',
    description: 'Part estimée d’argent dans le doré, de 0 à 100 %.',
    example: '5,2 %',
    required: false
  },
  pure_gold_grams: {
    title: 'Or fin (g)',
    description: 'Calculé : masse de doré × teneur ÷ 100',
    example: '10377.67 g',
    readOnly: true
  },
  estimated_oz: {
    title: 'Équivalent en onces',
    description: 'Calcul automatique : or fin ÷ 31,1034768.',
    example: '333.57 oz',
    readOnly: true
  },
  notes: {
    title: 'Commentaires',
    description: 'Précision utile sur la production, si nécessaire.',
    example: 'Coulée de contrôle',
    required: false
  }
};

export const forecastFieldGuides = {
  forecast_date: {
    title: 'Date de référence',
    description: 'Premier jour de la période prévue.',
    tips: [
      'Date de référence pour la période',
      'Pour les prévisions hebdomadaires: premier jour de la semaine',
      'Pour les prévisions mensuelles: premier jour du mois'
    ],
    required: true
  },
  period_type: {
    title: 'Type de période',
    description: 'Durée couverte par la prévision.',
    tips: [
      'Daily: Prévision quotidienne',
      'Weekly: Prévision hebdomadaire (7 jours)',
      'Monthly: Prévision mensuelle',
      'Yearly: Prévision annuelle'
    ],
    options: [
      { value: 'daily', label: 'Daily (Journalier)' },
      { value: 'weekly', label: 'Weekly (Hebdomadaire)' },
      { value: 'monthly', label: 'Monthly (Mensuel)' },
      { value: 'yearly', label: 'Yearly (Annuel)' }
    ],
    required: true
  },
  forecast_oz: {
    title: 'Prévision (oz)',
    description: 'Volume de production attendu.',
    tips: [
      'Basé sur les performances historiques',
      'Conditions normales d\'opération',
      'Ajustable selon les circonstances',
      'Sert de référence pour les comparaisons'
    ],
    examples: ['340', '732', '2368'],
    required: false
  },
  budget_oz: {
    title: 'Budget (oz)',
    description: 'Objectif budgétaire de la période.',
    tips: [
      'Objectif fixé par la direction',
      'Généralement supérieur au forecast',
      'Utilisé pour l\'évaluation de performance',
      'Base pour les bonus et incentives'
    ],
    examples: ['350', '807', '2735'],
    required: false
  },
  notes: {
    title: 'Commentaires',
    description: 'Hypothèse ou précision utile.',
    tips: [
      'Hypothèses utilisées',
      'Facteurs pris en compte',
      'Ajustements par rapport aux périodes précédentes'
    ],
    required: false
  }
};
