import { useEffect, useState } from 'react';
import { Calendar, Activity, LogIn, Building2, Shield, Clock, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  job_title: string | null;
  department: string | null;
  is_active: boolean;
  account_locked: boolean;
  two_factor_enabled: boolean;
  last_login_at: string | null;
  last_activity_at: string | null;
  created_at: string;
  timezone: string;
  language_preference: string;
  failed_login_attempts: number;
}

interface DashboardStats {
  total_logins: number;
  logins_last_30_days: number;
  total_actions: number;
  actions_last_30_days: number;
  accessible_sites: number;
  last_login: string | null;
}

interface UserStatsCardProps {
  userId: string;
  userProfile: UserProfile;
}

export default function UserStatsCard({ userId, userProfile }: UserStatsCardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    total_logins: 0,
    logins_last_30_days: 0,
    total_actions: 0,
    actions_last_30_days: 0,
    accessible_sites: 0,
    last_login: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, [userId]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: totalLogins } = await supabase
        .from('user_login_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { count: recentLogins } = await supabase
        .from('user_login_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('login_at', thirtyDaysAgo.toISOString());

      const { count: totalActions } = await supabase
        .from('user_activity_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { count: recentActions } = await supabase
        .from('user_activity_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      const { count: accessibleSites } = await supabase
        .from('user_mining_company_access')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      setStats({
        total_logins: totalLogins || 0,
        logins_last_30_days: recentLogins || 0,
        total_actions: totalActions || 0,
        actions_last_30_days: recentActions || 0,
        accessible_sites: accessibleSites || 0,
        last_login: userProfile.last_login_at
      });
    } catch (err) {
      console.error('Error fetching user stats:', err);
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Jamais';
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRelativeDate = (dateString: string | null) => {
    if (!dateString) return 'Jamais';
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'À l\'instant';
    if (diffInMinutes < 60) return `Il y a ${diffInMinutes} min`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Il y a ${diffInHours}h`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `Il y a ${diffInDays}j`;

    return formatDate(dateString);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-32 bg-slate-200 rounded-lg"></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-64 bg-slate-200 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-red-600">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-200 rounded-lg">
              <LogIn className="w-6 h-6 text-blue-700" />
            </div>
            <span className="text-xs font-medium text-blue-600 bg-blue-200 px-2 py-1 rounded-full">
              30 jours
            </span>
          </div>
          <h3 className="text-3xl font-bold text-blue-900 mb-1">
            {stats.logins_last_30_days}
          </h3>
          <p className="text-sm font-medium text-blue-700">Connexions</p>
          <div className="mt-2 pt-2 border-t border-blue-200">
            <p className="text-xs text-blue-600">
              Total: <span className="font-semibold">{stats.total_logins}</span>
            </p>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-emerald-200 rounded-lg">
              <Activity className="w-6 h-6 text-emerald-700" />
            </div>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-200 px-2 py-1 rounded-full">
              30 jours
            </span>
          </div>
          <h3 className="text-3xl font-bold text-emerald-900 mb-1">
            {stats.actions_last_30_days}
          </h3>
          <p className="text-sm font-medium text-emerald-700">Actions</p>
          <div className="mt-2 pt-2 border-t border-emerald-200">
            <p className="text-xs text-emerald-600">
              Total: <span className="font-semibold">{stats.total_actions}</span>
            </p>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-amber-200 rounded-lg">
              <Building2 className="w-6 h-6 text-amber-700" />
            </div>
            <span className="text-xs font-medium text-amber-600 bg-amber-200 px-2 py-1 rounded-full">
              Actifs
            </span>
          </div>
          <h3 className="text-3xl font-bold text-amber-900 mb-1">
            {stats.accessible_sites}
          </h3>
          <p className="text-sm font-medium text-amber-700">Sites Accessibles</p>
          <div className="mt-2 pt-2 border-t border-amber-200">
            <p className="text-xs text-amber-600">
              Compagnies minières
            </p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 hover:shadow-lg transition-shadow">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Informations Temporelles
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-start py-3 border-b border-slate-100">
              <div>
                <span className="text-sm text-slate-600">Compte créé</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatRelativeDate(userProfile.created_at)}
                </p>
              </div>
              <span className="text-sm font-medium text-slate-900">
                {formatDate(userProfile.created_at)}
              </span>
            </div>
            <div className="flex justify-between items-start py-3 border-b border-slate-100">
              <div>
                <span className="text-sm text-slate-600">Dernière connexion</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatRelativeDate(stats.last_login || userProfile.last_login_at)}
                </p>
              </div>
              <span className="text-sm font-medium text-slate-900">
                {formatDate(stats.last_login || userProfile.last_login_at)}
              </span>
            </div>
            <div className="flex justify-between items-start py-3 border-b border-slate-100">
              <div>
                <span className="text-sm text-slate-600">Dernière activité</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatRelativeDate(userProfile.last_activity_at)}
                </p>
              </div>
              <span className="text-sm font-medium text-slate-900">
                {formatDate(userProfile.last_activity_at)}
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-sm text-slate-600">Fuseau horaire</span>
              <span className="text-sm font-medium text-slate-900 bg-slate-100 px-2 py-1 rounded">
                {userProfile.timezone}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-lg transition-shadow">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            Statut du Compte
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <span className="text-sm text-slate-600">Statut du compte</span>
              <span
                className={`text-sm font-semibold px-3 py-1 rounded-full ${
                  userProfile.is_active
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {userProfile.is_active ? 'Actif' : 'Inactif'}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <span className="text-sm text-slate-600">Compte Verrouillé</span>
              <span
                className={`text-sm font-semibold px-3 py-1 rounded-full ${
                  userProfile.account_locked
                    ? 'bg-red-100 text-red-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {userProfile.account_locked ? 'Oui' : 'Non'}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <span className="text-sm text-slate-600">2FA Activé</span>
              <span
                className={`text-sm font-semibold px-3 py-1 rounded-full ${
                  userProfile.two_factor_enabled
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {userProfile.two_factor_enabled ? 'Oui' : 'Non'}
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-sm text-slate-600">Tentatives échouées</span>
              <span
                className={`text-sm font-semibold px-3 py-1 rounded-full ${
                  userProfile.failed_login_attempts > 0
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {userProfile.failed_login_attempts}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 bg-gradient-to-r from-slate-50 to-blue-50 border-slate-200 hover:shadow-lg transition-shadow">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="text-base font-semibold text-slate-900 mb-2">
              Activité Récente
            </h4>
            <p className="text-sm text-slate-700 leading-relaxed">
              Cet utilisateur a effectué{' '}
              <span className="font-bold text-emerald-600">
                {stats.actions_last_30_days} actions
              </span>{' '}
              au cours des 30 derniers jours et s'est connecté{' '}
              <span className="font-bold text-blue-600">
                {stats.logins_last_30_days} fois
              </span>.
              {stats.accessible_sites > 0 && (
                <span>
                  {' '}Il a accès à{' '}
                  <span className="font-bold text-amber-600">
                    {stats.accessible_sites} site{stats.accessible_sites > 1 ? 's' : ''}
                  </span>.
                </span>
              )}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
