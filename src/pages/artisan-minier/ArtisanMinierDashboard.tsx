import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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
  Filter
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { carteProfessionnelleService } from '@/services/carteProfessionnelleService';
import { artisanMinierService } from '@/services/artisanMinierService';

export default function ArtisanMinierDashboard() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [cartesExpirant, setCartesExpirant] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dashboardStats, expiringCartes] = await Promise.all([
        carteProfessionnelleService.getDashboardStats(),
        carteProfessionnelleService.getCartesExpirant(60)
      ]);

      setStats(dashboardStats);
      setCartesExpirant(expiringCartes);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchArtisans = async () => {
    if (!searchQuery.trim()) return;

    try {
      const results = await artisanMinierService.searchArtisans(searchQuery);
      console.log('Search results:', results);
    } catch (error) {
      console.error('Error searching:', error);
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Gestion des Artisans Miniers
          </h1>
          <p className="text-gray-600 mt-1">
            Système National de Gestion de la Collecte de l'Or - SONASP
          </p>
        </div>
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

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Cartes</p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">
                {stats?.total || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">Artisans enregistrés</p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl">
              <CreditCard className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Cartes Validées</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {stats?.validees || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">Actives</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200">
          <div className="flex items-start justify-between">
            <div>
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
            <div>
              <p className="text-sm text-gray-600 font-medium">Expirent bientôt</p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                {stats?.expirant_60_jours || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">Dans les 60 jours</p>
            </div>
            <div className="p-3 bg-red-100 rounded-xl">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Statistiques par statut */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">En Exploitation</h3>
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-green-600">{stats?.en_exploitation || 0}</p>
          <p className="text-sm text-gray-600 mt-1">Cartes en cours d'utilisation</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Suspendues</h3>
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-yellow-600">{stats?.suspendues || 0}</p>
          <p className="text-sm text-gray-600 mt-1">Cartes temporairement suspendues</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Expirées</h3>
            <div className="p-2 bg-gray-100 rounded-lg">
              <Calendar className="h-5 w-5 text-gray-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-600">{stats?.expirees || 0}</p>
          <p className="text-sm text-gray-600 mt-1">Cartes à renouveler</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <TrendingUp className="h-6 w-6 text-purple-600 mb-2" />
              <h4 className="font-semibold text-gray-900">Suivi des activités</h4>
              <p className="text-sm text-gray-600 mt-1">
                Statistiques et performances
              </p>
            </div>
          </Link>
        </div>
      </Card>
    </div>
  );
}
