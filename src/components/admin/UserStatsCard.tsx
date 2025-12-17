import { useEffect, useState } from 'react';
import { Calendar, Activity, LogIn, Building2, Shield, Clock } from 'lucide-react';
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
  account_status: {
    is_active: boolean;
    account_locked: boolean;
    two_factor_enabled: boolean;
    failed_login_attempts: number;
  };
}

interface UserStatsCardProps {
  userId: string;
  userProfile: UserProfile;
}

export default function UserStatsCard({ userId, userProfile }: UserStatsCardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [userId]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_user_dashboard_stats', {
        p_user_id: userId
      });

      if (error) throw error;
      setStats(data);
    } catch (error) {
      console.error('Error fetching user stats:', error);
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

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-32 bg-slate-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <LogIn className="w-8 h-8 text-blue-600" />
            <span className="text-xs font-medium text-blue-600">30 jours</span>
          </div>
          <h3 className="text-2xl font-bold text-blue-900">
            {stats?.logins_last_30_days || 0}
          </h3>
          <p className="text-sm text-blue-700">Connexions</p>
          <p className="text-xs text-blue-600 mt-1">
            Total: {stats?.total_logins || 0}
          </p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-8 h-8 text-emerald-600" />
            <span className="text-xs font-medium text-emerald-600">30 jours</span>
          </div>
          <h3 className="text-2xl font-bold text-emerald-900">
            {stats?.actions_last_30_days || 0}
          </h3>
          <p className="text-sm text-emerald-700">Actions</p>
          <p className="text-xs text-emerald-600 mt-1">
            Total: {stats?.total_actions || 0}
          </p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <div className="flex items-center justify-between mb-2">
            <Building2 className="w-8 h-8 text-amber-600" />
            <span className="text-xs font-medium text-amber-600">Actifs</span>
          </div>
          <h3 className="text-2xl font-bold text-amber-900">
            {stats?.accessible_sites || 0}
          </h3>
          <p className="text-sm text-amber-700">Sites Accessibles</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-600" />
            Informations Temporelles
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Créé le</span>
              <span className="text-sm font-medium text-slate-900">
                {formatDate(userProfile.created_at)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Dernière connexion</span>
              <span className="text-sm font-medium text-slate-900">
                {formatDate(stats?.last_login || userProfile.last_login_at)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Dernière activité</span>
              <span className="text-sm font-medium text-slate-900">
                {formatDate(userProfile.last_activity_at)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-slate-600">Fuseau horaire</span>
              <span className="text-sm font-medium text-slate-900">
                {userProfile.timezone}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-slate-600" />
            Statut du Compte
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Statut</span>
              <span
                className={`text-sm font-medium ${
                  userProfile.is_active ? 'text-emerald-600' : 'text-slate-400'
                }`}
              >
                {userProfile.is_active ? 'Actif' : 'Inactif'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Compte Verrouillé</span>
              <span
                className={`text-sm font-medium ${
                  userProfile.account_locked ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                {userProfile.account_locked ? 'Oui' : 'Non'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">2FA Activé</span>
              <span
                className={`text-sm font-medium ${
                  userProfile.two_factor_enabled ? 'text-emerald-600' : 'text-slate-400'
                }`}
              >
                {userProfile.two_factor_enabled ? 'Oui' : 'Non'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-slate-600">Tentatives échouées</span>
              <span
                className={`text-sm font-medium ${
                  userProfile.failed_login_attempts > 0 ? 'text-amber-600' : 'text-slate-900'
                }`}
              >
                {userProfile.failed_login_attempts}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 bg-slate-50 border-slate-200">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-slate-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-1">
              Activité Récente
            </h4>
            <p className="text-sm text-slate-600">
              Cet utilisateur a effectué{' '}
              <span className="font-medium text-slate-900">
                {stats?.actions_last_30_days || 0} actions
              </span>{' '}
              au cours des 30 derniers jours et s'est connecté{' '}
              <span className="font-medium text-slate-900">
                {stats?.logins_last_30_days || 0} fois
              </span>
              .
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
