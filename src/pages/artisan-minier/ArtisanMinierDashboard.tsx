import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  UserPlus,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  TrendingUp,
  Calendar,
  Search,
  Filter,
  MapPin,
  Activity,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { carteProfessionnelleService } from '@/services/carteProfessionnelleService';
import { artisanMinierService } from '@/services/artisanMinierService';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const COLORS = {
  exploitant: '#10B981',
  collecteur: '#3B82F6',
  intermediaire: '#F59E0B',
  fournisseur: '#8B5CF6',
  M: '#3B82F6',
  F: '#EC4899',
  validees: '#10B981',
  en_cours: '#F59E0B',
  suspendues: '#EF4444',
  expirees: '#6B7280'
};

export default function ArtisanMinierDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [artisans, setArtisans] = useState<any[]>([]);
  const [cartesExpirant, setCartesExpirant] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Analytics data
  const [typeDistribution, setTypeDistribution] = useState<any[]>([]);
  const [genreDistribution, setGenreDistribution] = useState<any[]>([]);
  const [regionDistribution, setRegionDistribution] = useState<any[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<any[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dashboardStats, expiringCartes, allArtisans] = await Promise.all([
        carteProfessionnelleService.getDashboardStats(),
        carteProfessionnelleService.getCartesExpirant(60),
        artisanMinierService.getAll()
      ]);

      setStats(dashboardStats);
      setCartesExpirant(expiringCartes);
      setArtisans(allArtisans || []);

      // Calculer les distributions
      if (allArtisans && allArtisans.length > 0) {
        calculateDistributions(allArtisans);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDistributions = (data: any[]) => {
    // Distribution par type d'artisan
    const typeCount: any = {};
    data.forEach(a => {
      const type = a.type_artisan || 'non-specifie';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    setTypeDistribution(
      Object.entries(typeCount).map(([name, value]) => ({ name, value }))
    );

    // Distribution par genre
    const genreCount: any = {};
    data.forEach(a => {
      if (a.type_personne === 'physique') {
        const genre = a.sexe || 'non-specifie';
        genreCount[genre] = (genreCount[genre] || 0) + 1;
      }
    });
    setGenreDistribution(
      Object.entries(genreCount).map(([name, value]) => ({ name, value }))
    );

    // Distribution par région
    const regionCount: any = {};
    data.forEach(a => {
      const region = a.region || 'Non spécifiée';
      regionCount[region] = (regionCount[region] || 0) + 1;
    });
    const topRegions = Object.entries(regionCount)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    setRegionDistribution(topRegions);

    // Distribution par statut (simulé - à adapter selon votre modèle)
    const statusCount = {
      validees: stats?.validees || 0,
      en_cours: stats?.en_cours || 0,
      suspendues: stats?.suspendues || 0,
      expirees: stats?.expirees || 0
    };
    setStatusDistribution(
      Object.entries(statusCount).map(([name, value]) => ({ name, value }))
    );

    // Tendance mensuelle (simulation - à adapter)
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const trendData = months.map((month, index) => ({
      month,
      nouveaux: Math.floor(Math.random() * 20) + 5,
      actifs: Math.floor(Math.random() * 50) + 20
    }));
    setMonthlyTrend(trendData);
  };

  const searchArtisans = async () => {
    if (!searchQuery.trim()) return;
    try {
      const results = await artisanMinierService.searchArtisans(searchQuery);
      navigate('/artisan-minier/liste');
    } catch (error) {
      console.error('Error searching:', error);
    }
  };

  // Traffic Light Indicator
  const getTrafficLight = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return { color: 'bg-green-500', label: 'Excellent' };
    if (value >= thresholds.warning) return { color: 'bg-yellow-500', label: 'Attention' };
    return { color: 'bg-red-500', label: 'Critique' };
  };

  const validationRate = stats?.total > 0 ? (stats.validees / stats.total) * 100 : 0;
  const trafficLight = getTrafficLight(validationRate, { good: 80, warning: 60 });

  if (loading) {
    return (
      <MainLayout>
        <Loading />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Gestion des Artisans Miniers
            </h1>
            <p className="text-gray-600 mt-1">
              Tableau de Bord Analytique - SONASP
            </p>
          </div>
          <Link to="/artisan-minier/liste">
            <Button variant="primary" className="bg-emerald-600 hover:bg-emerald-700">
              <UserPlus className="h-5 w-5 mr-2" />
              Nouvel Artisan
            </Button>
          </Link>
        </div>

        {/* Barre de recherche */}
        <Card>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Rechercher un artisan (nom, prénom, n° carte, téléphone...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') searchArtisans();
                }}
                icon={Search}
              />
            </div>
            <Button variant="secondary" onClick={searchArtisans}>
              Rechercher
            </Button>
            <Link to="/artisan-minier/liste">
              <Button variant="outline">
                Voir tout
              </Button>
            </Link>
          </div>
        </Card>

        {/* KPIs avec Traffic Lights */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-medium">Total Artisans</p>
                <p className="text-3xl font-bold text-emerald-600 mt-2">
                  {stats?.total || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">Enregistrés</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-600 font-medium">Cartes Validées</p>
                  <div className={`w-3 h-3 rounded-full ${trafficLight.color} animate-pulse`}></div>
                </div>
                <p className="text-3xl font-bold text-blue-600 mt-2">
                  {stats?.validees || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Taux: {validationRate.toFixed(1)}% - {trafficLight.label}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-medium">En Attente</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">
                  {stats?.en_cours || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">À valider</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-xl">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-medium">Alertes</p>
                <p className="text-3xl font-bold text-red-600 mt-2">
                  {stats?.expirant_60_jours || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">Expirent sous 60j</p>
              </div>
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Graphiques Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribution par Type d'Artisan */}
          <Card>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-emerald-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Distribution par Type d'Artisan
                </h3>
              </div>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={typeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {typeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || '#94A3B8'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Distribution par Genre */}
          <Card>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Distribution par Genre
                </h3>
              </div>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={genreDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name === 'M' ? 'Masculin' : name === 'F' ? 'Féminin' : name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {genreDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || '#94A3B8'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Graphiques Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribution par Région */}
          <Card>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Distribution par Région (Top 10)
                </h3>
              </div>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={regionDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8B5CF6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Évolution Mensuelle */}
          <Card>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Évolution des Enregistrements
                </h3>
              </div>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="nouveaux" stroke="#10B981" strokeWidth={2} name="Nouveaux" />
                  <Line type="monotone" dataKey="actifs" stroke="#3B82F6" strokeWidth={2} name="Actifs" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Statistiques par statut */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">En Exploitation</h3>
              <div className="p-2 bg-green-100 rounded-lg">
                <Activity className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-green-600">{stats?.en_exploitation || 0}</p>
            <p className="text-sm text-gray-600 mt-1">Cartes actives</p>
            <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-600"
                style={{ width: `${stats?.total > 0 ? ((stats.en_exploitation || 0) / stats.total) * 100 : 0}%` }}
              ></div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Suspendues</h3>
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-yellow-600">{stats?.suspendues || 0}</p>
            <p className="text-sm text-gray-600 mt-1">Temporairement</p>
            <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-600"
                style={{ width: `${stats?.total > 0 ? ((stats.suspendues || 0) / stats.total) * 100 : 0}%` }}
              ></div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Expirées</h3>
              <div className="p-2 bg-gray-100 rounded-lg">
                <Calendar className="h-5 w-5 text-gray-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-600">{stats?.expirees || 0}</p>
            <p className="text-sm text-gray-600 mt-1">À renouveler</p>
            <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-600"
                style={{ width: `${stats?.total > 0 ? ((stats.expirees || 0) / stats.total) * 100 : 0}%` }}
              ></div>
            </div>
          </Card>
        </div>

        {/* Alertes d'expiration */}
        {cartesExpirant && cartesExpirant.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-orange-100 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Cartes expirant prochainement
                </h3>
                <p className="text-gray-700 mb-4">
                  {cartesExpirant.length} carte(s) expire(nt) dans les 60 prochains jours
                </p>
                <div className="space-y-2">
                  {cartesExpirant.slice(0, 5).map((carte: any) => {
                    const joursRestants = carteProfessionnelleService.getJoursRestants(carte.date_expiration);
                    return (
                      <div
                        key={carte.id}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {carte.artisan?.nom} {carte.artisan?.prenoms || carte.artisan?.raison_sociale}
                          </p>
                          <p className="text-sm text-gray-600">
                            N° {carte.numero_carte}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-orange-600">
                            {joursRestants} jours restants
                          </p>
                          <p className="text-xs text-gray-500">
                            Expire le {new Date(carte.date_expiration).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {cartesExpirant.length > 5 && (
                  <Link to="/artisan-minier/cartes/expirations">
                    <Button variant="outline" className="mt-4">
                      Voir toutes les expirations ({cartesExpirant.length})
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Actions rapides */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Actions rapides
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/artisan-minier/cartes/validation" className="block">
              <div className="p-4 border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer">
                <CheckCircle className="h-6 w-6 text-blue-600 mb-2" />
                <h4 className="font-semibold text-gray-900">Valider des cartes</h4>
                <p className="text-sm text-gray-600 mt-1">
                  {stats?.en_cours || 0} carte(s) en attente
                </p>
              </div>
            </Link>

            <Link to="/artisan-minier/cartes/suivi" className="block">
              <div className="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all cursor-pointer">
                <BarChart3 className="h-6 w-6 text-purple-600 mb-2" />
                <h4 className="font-semibold text-gray-900">Suivi des activités</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Statistiques et performances
                </p>
              </div>
            </Link>

            <Link to="/artisan-minier/liste" className="block">
              <div className="p-4 border-2 border-emerald-200 rounded-lg hover:border-emerald-400 hover:bg-emerald-50 transition-all cursor-pointer">
                <Users className="h-6 w-6 text-emerald-600 mb-2" />
                <h4 className="font-semibold text-gray-900">Gérer les artisans</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Liste complète et modifications
                </p>
              </div>
            </Link>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
