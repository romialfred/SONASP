export const dailyProductionFieldGuides = {
  production_date: {
    title: 'Production Date',
    description: 'Date de la production journalière.',
    example: '15/11/2025',
    required: true
  },
  mining_company_id: {
    title: 'Mining Company',
    description: 'Société minière source du bullion.\nGénère automatiquement la référence du bar.',
    example: 'Société des Mines de Komana (SMK)',
    required: true
  },
  bar_reference: {
    title: 'Bar Reference',
    description: 'Référence unique générée automatiquement.\nFormat: HUM[CODE]-NNNN',
    example: 'HUMSMK-0001, HUMKGM-0015',
    readOnly: true
  },
  bullion_grams: {
    title: 'Bullion',
    description: 'Poids total du bullion en grammes.\nConversion automatique en onces.',
    example: '11270 g = 362.31 oz',
    required: true
  },
  estimated_fineness_pct: {
    title: 'Estimated Fineness (%)',
    description: 'Pourcentage de pureté estimé du bullion.\nDoit être entre 0 et 100%.',
    example: '92.1%',
    required: true
  },
  pure_gold_grams: {
    title: 'Pure Gold (g)',
    description: 'Calcul automatique: Bullion × Finesse ÷ 100.\nQuantité d\'or pur en grammes.',
    example: '10377.67 g',
    readOnly: true
  },
  estimated_oz: {
    title: 'Estimated Oz',
    description: 'Calcul automatique: Pure Gold ÷ 31.1035.\nQuantité d\'or pur en onces troy.',
    example: '333.57 oz',
    readOnly: true
  },
  notes: {
    title: 'Notes',
    description: 'Observations ou commentaires sur cette production.\nChamp optionnel.',
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
