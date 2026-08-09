import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import {
  TrendingUp,
  Users,
  DollarSign,
  Scale,
  FileText,
  BarChart3,
  PieChart,
  Calendar,
  MapPin
} from 'lucide-react';
import { artisanAnalyticsService, type IndicateursCles } from '@/services/artisanAnalyticsService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#B8860B', '#475569', '#10B981', '#3B82F6', '#EF4444', '#F59E0B'];

const CentreRapportsAnalyse = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [indicateurs, setIndicateurs] = useState<IndicateursCles | null>(null);
  const [caParRegion, setCaParRegion] = useState<any[]>([]);
  const [quantitesParType, setQuantitesParType] = useState<any[]>([]);
  const [caParMois, setCaParMois] = useState<any[]>([]);
  const [dateDebut, setDateDebut] = useState<string>(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  );
  const [dateFin, setDateFin] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    chargerDonnees();
  }, [dateDebut, dateFin]);

  const chargerDonnees = async () => {
    try {
      setLoading(true);

      const [
        indicateursData,
        caRegionData,
        quantitesData,
        caMoisData
      ] = await Promise.all([
        artisanAnalyticsService.getIndicateursCles(dateDebut, dateFin),
        artisanAnalyticsService.getChiffreAffairesParRegion(dateDebut, dateFin),
        artisanAnalyticsService.getQuantiteParType(dateDebut, dateFin),
        artisanAnalyticsService.getChiffreAffairesParMois(new Date().getFullYear())
      ]);

      setIndicateurs(indicateursData);
      setCaParRegion(caRegionData);
      setQuantitesParType(quantitesData);
      setCaParMois(caMoisData);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatMontant = (montant: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(montant);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loading size="lg" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Centre de Rapports & Analyse</h1>
            <p className="text-gray-600 mt-1">Suivi des indicateurs et rapports pour les Ministères</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate('/artisan-minier/rapports/chiffre-affaires')}
            >
              <FileText className="w-4 h-4 mr-2" />
              Rapports CA
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/artisan-minier/rapports/quantites')}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Rapports Quantités
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/artisan-minier/rapports/taxes')}
            >
              <Scale className="w-4 h-4 mr-2" />
              Rapports Taxes
            </Button>
          </div>
        </div>

        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-blue-600" />
            <div className="flex-1 flex gap-4 items-center">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
                <input
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
                <input
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Button onClick={chargerDonnees} className="mt-6">
                Actualiser
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Ventes</p>
                <p className="text-3xl font-bold text-blue-900 mt-1">{indicateurs?.total_ventes || 0}</p>
                <p className="text-xs text-blue-700 mt-1">
                  {indicateurs?.ventes_en_attente || 0} en attente
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-600">Chiffre d'Affaires</p>
                <p className="text-2xl font-bold text-emerald-900 mt-1">
                  {formatMontant(indicateurs?.chiffre_affaires_total || 0)} FCFA
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  {formatMontant(indicateurs?.montant_en_attente || 0)} FCFA en attente
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600">Quantité d'Or</p>
                <p className="text-2xl font-bold text-amber-900 mt-1">
                  {formatMontant(indicateurs?.quantite_totale_grammes || 0)} g
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  {indicateurs?.quantite_totale_onces.toFixed(2)} oz
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center">
                <Scale className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Artisans Actifs</p>
                <p className="text-3xl font-bold text-purple-900 mt-1">
                  {indicateurs?.total_artisans_actifs || 0}
                </p>
                <p className="text-xs text-purple-700 mt-1">
                  Prix moy: {formatMontant(indicateurs?.prix_moyen_gramme || 0)} FCFA/g
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Taxes Totales</p>
                <p className="text-2xl font-bold text-red-900 mt-1">
                  {formatMontant(indicateurs?.taxes_total || 0)} FCFA
                </p>
              </div>
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-600">Royalties Totales</p>
                <p className="text-2xl font-bold text-indigo-900 mt-1">
                  {formatMontant(indicateurs?.royalties_total || 0)} FCFA
                </p>
              </div>
              <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center">
                <Scale className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Chiffre d'Affaires par Région</h3>
              <MapPin className="w-5 h-5 text-gray-400" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={caParRegion}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="region" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value: any) => formatMontant(value) + ' FCFA'} />
                <Legend />
                <Bar dataKey="montant_total_brut" fill="#B8860B" name="CA Total" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Répartition par Type d'Or</h3>
              <PieChart className="w-5 h-5 text-gray-400" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie
                  data={quantitesParType}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.type_or} (${entry.pourcentage_total.toFixed(1)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="quantite_totale_grammes"
                >
                  {quantitesParType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatMontant(value) + ' g'} />
              </RePieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Évolution Mensuelle {new Date().getFullYear()}</h3>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={caParMois}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="periode"
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fontSize: 12 }}
              />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={(value: any) => formatMontant(value)} />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="montant_total_brut"
                stroke="#B8860B"
                strokeWidth={2}
                name="CA (FCFA)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="quantite_totale_grammes"
                stroke="#10B981"
                strokeWidth={2}
                name="Quantité (g)"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card
            className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/artisan-minier/rapports/chiffre-affaires')}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Rapports CA</h4>
                <p className="text-sm text-gray-600">Par région, artisan, période</p>
              </div>
            </div>
          </Card>

          <Card
            className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/artisan-minier/rapports/quantites')}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Rapports Quantités</h4>
                <p className="text-sm text-gray-600">Par type, région, artisan</p>
              </div>
            </div>
          </Card>

          <Card
            className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/artisan-minier/rapports/taxes')}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <Scale className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Rapports Taxes & Royalties</h4>
                <p className="text-sm text-gray-600">TVA, retenue, royalties</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default CentreRapportsAnalyse;
