export const dailyProductionFieldGuides = {
  production_date: {
    title: 'Production Date',
    description: 'Date de production',
    example: '15/11/2025',
    required: true
  },
  mining_company_id: {
    title: 'Mining Company',
    description: 'Source du bullion',
    example: 'SBM',
    required: true
  },
  bar_reference: {
    title: 'Bar Reference',
    description: 'Référence automatique : code de la société puis compteur',
    example: 'SBM-0001',
    readOnly: true
  },
  bullion_grams: {
    title: 'Bullion',
    description: 'Poids total (auto converti en oz)',
    example: '11270 g',
    required: true
  },
  estimated_fineness_pct: {
    title: 'Teneur en or (%)',
    description: 'Part d’or fin dans le doré, de 0 à 100 %',
    example: '92.1%',
    required: true
  },
  pure_gold_grams: {
    title: 'Pure Gold (g)',
    description: 'Calculé : masse de doré × teneur ÷ 100',
    example: '10377.67 g',
    readOnly: true
  },
  estimated_oz: {
    title: 'Estimated Oz',
    description: 'Auto: Pure Gold ÷ 31.1034768',
    example: '333.57 oz',
    readOnly: true
  },
  notes: {
    title: 'Notes',
    description: 'Commentaires (optionnel)',
    example: 'Production exceptionnelle',
    required: false
  }
};

export const forecastFieldGuides = {
  forecast_date: {
    title: 'Forecast Date',
    description: 'Date pour laquelle la prévision est établie',
    tips: [
      'Date de référence pour la période',
      'Pour les prévisions hebdomadaires: premier jour de la semaine',
      'Pour les prévisions mensuelles: premier jour du mois'
    ],
    required: true
  },
  period_type: {
    title: 'Period Type',
    description: 'Type de période de prévision',
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
    title: 'Forecast (Oz)',
    description: 'Production prévue en onces troy',
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
    title: 'Budget (Oz)',
    description: 'Objectif budgétaire en onces troy',
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
    title: 'Notes',
    description: 'Notes sur les prévisions',
    tips: [
      'Hypothèses utilisées',
      'Facteurs pris en compte',
      'Ajustements par rapport aux périodes précédentes'
    ],
    required: false
  }
};
