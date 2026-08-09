import { useState, useEffect } from 'react';
import { Plus, TrendingUp, Target, Calendar } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { dailyProductionService, ProductionForecast } from '@/services/dailyProductionService';
import { forecastFieldGuides } from '@/data/productionFieldGuides';
import { FieldGuidePanel } from '@/components/ui/FieldGuidePanel';

export function ForecastManagementPage() {
  const [forecasts, setForecasts] = useState<ProductionForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeField, setActiveField] = useState('forecast_date');

  const [formData, setFormData] = useState({
    forecast_date: new Date().toISOString().split('T')[0],
    period_type: 'daily' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    forecast_oz: '',
    budget_oz: '',
    notes: ''
  });

  useEffect(() => {
    loadForecasts();
  }, []);

  const loadForecasts = async () => {
    try {
      setLoading(true);
      const data = await dailyProductionService.listForecasts({
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
      setForecasts(data);
    } catch (error) {
      console.error('Error loading forecasts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await dailyProductionService.createForecast({
        forecast_date: formData.forecast_date,
        period_type: formData.period_type,
        forecast_oz: formData.forecast_oz ? parseFloat(formData.forecast_oz) : undefined,
        budget_oz: formData.budget_oz ? parseFloat(formData.budget_oz) : undefined,
        notes: formData.notes || undefined
      });

      setFormData({
        forecast_date: new Date().toISOString().split('T')[0],
        period_type: 'daily',
        forecast_oz: '',
        budget_oz: '',
        notes: ''
      });

      loadForecasts();
      setShowForm(false);
      alert('Prévision enregistrée avec succès');
    } catch (error: any) {
      console.error('Error saving forecast:', error);
      alert(error.message || 'Erreur lors de la sauvegarde');
    }
  };

  const periodTypeLabels = {
    daily: 'Journalier',
    weekly: 'Hebdomadaire',
    monthly: 'Mensuel',
    yearly: 'Annuel'
  };

  const groupedForecasts = forecasts.reduce((acc, forecast) => {
    const date = forecast.forecast_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(forecast);
    return acc;
  }, {} as Record<string, ProductionForecast[]>);

  return (
    <MainLayout>
      <div className="max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Production Forecasts</h1>
          <p className="text-gray-600 mt-1">
            Gestion des prévisions et budgets de production
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle Prévision
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        {showForm && (
          <Card className="lg:col-span-2 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Saisir une Prévision
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de Référence *
                  </label>
                  <input
                    type="date"
                    value={formData.forecast_date}
                    onChange={(e) => {
                      setFormData({ ...formData, forecast_date: e.target.value });
                      setActiveField('forecast_date');
                    }}
                    onFocus={() => setActiveField('forecast_date')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type de Période *
                  </label>
                  <select
                    value={formData.period_type}
                    onChange={(e) => {
                      setFormData({ ...formData, period_type: e.target.value as any });
                      setActiveField('period_type');
                    }}
                    onFocus={() => setActiveField('period_type')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="daily">Journalier</option>
                    <option value="weekly">Hebdomadaire</option>
                    <option value="monthly">Mensuel</option>
                    <option value="yearly">Annuel</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Forecast (Oz)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.forecast_oz}
                    onChange={(e) => {
                      setFormData({ ...formData, forecast_oz: e.target.value });
                      setActiveField('forecast_oz');
                    }}
                    onFocus={() => setActiveField('forecast_oz')}
                    placeholder="ex: 340"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Budget (Oz)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.budget_oz}
                    onChange={(e) => {
                      setFormData({ ...formData, budget_oz: e.target.value });
                      setActiveField('budget_oz');
                    }}
                    onFocus={() => setActiveField('budget_oz')}
                    placeholder="ex: 350"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => {
                    setFormData({ ...formData, notes: e.target.value });
                    setActiveField('notes');
                  }}
                  onFocus={() => setActiveField('notes')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Hypothèses et commentaires..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Annuler
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Enregistrer
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Field Guide */}
        {showForm && (
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <Card className="bg-gray-50">
                <FieldGuidePanel
                  fieldGuides={forecastFieldGuides}
                  activeField={activeField}
                />
              </Card>
            </div>
          </div>
        )}

        {/* Forecasts List */}
        <Card className={showForm ? 'lg:col-span-3' : 'lg:col-span-3'}>
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Prévisions Enregistrées
            </h2>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : Object.keys(groupedForecasts).length === 0 ? (
              <div className="text-center py-12">
                <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">Aucune prévision enregistrée</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedForecasts).sort(([a], [b]) => b.localeCompare(a)).map(([date, items]) => (
                  <div key={date} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 text-gray-500 mr-2" />
                        <span className="font-semibold text-gray-900">
                          {new Date(date).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="divide-y divide-gray-200">
                      {items.map((forecast) => (
                        <div key={forecast.id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {periodTypeLabels[forecast.period_type]}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <TrendingUp className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm text-gray-600">Forecast:</span>
                                  </div>
                                  <span className="text-lg font-bold text-blue-700">
                                    {forecast.forecast_oz?.toFixed(2) || '—'} oz
                                  </span>
                                </div>

                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <Target className="w-4 h-4 text-purple-600" />
                                    <span className="text-sm text-gray-600">Budget:</span>
                                  </div>
                                  <span className="text-lg font-bold text-purple-700">
                                    {forecast.budget_oz?.toFixed(2) || '—'} oz
                                  </span>
                                </div>
                              </div>

                              {forecast.notes && (
                                <p className="text-sm text-gray-600 mt-3 italic">
                                  {forecast.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
      </div>
    </MainLayout>
  );
}
