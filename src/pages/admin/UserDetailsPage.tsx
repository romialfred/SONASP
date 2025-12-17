import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Activity, LogIn, Lock, Building2, Monitor } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Loading } from '@/components/ui/Loading';
import UserStatsCard from '@/components/admin/UserStatsCard';
import LoginHistoryTab from '@/components/admin/LoginHistoryTab';
import ActivityHistoryTab from '@/components/admin/ActivityHistoryTab';
import SiteAccessTab from '@/components/admin/SiteAccessTab';
import SessionsTab from '@/components/admin/SessionsTab';
import UserPermissionsTab from '@/components/admin/UserPermissionsTab';

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
  profile_picture_url: string | null;
  failed_login_attempts: number;
}

export default function UserDetailsPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (userId) {
      fetchUserDetails();
    }
  }, [userId]);

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUser(data);
    } catch (error) {
      console.error('Error fetching user details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <p className="text-slate-600">User not found</p>
          <Button onClick={() => navigate('/admin/users')} className="mt-4">
            Back to Users
          </Button>
        </Card>
      </div>
    );
  }

  const tabs = [
    {
      id: 'overview',
      label: 'Vue d\'ensemble',
      icon: User,
      content: <UserStatsCard userId={user.id} userProfile={user} />
    },
    {
      id: 'login-history',
      label: 'Historique Connexions',
      icon: LogIn,
      content: <LoginHistoryTab userId={user.id} />
    },
    {
      id: 'activity-history',
      label: 'Historique Actions',
      icon: Activity,
      content: <ActivityHistoryTab userId={user.id} />
    },
    {
      id: 'permissions',
      label: 'Permissions',
      icon: Lock,
      content: <UserPermissionsTab userId={user.id} userRole={user.role} />
    },
    {
      id: 'site-access',
      label: 'Accès aux Sites',
      icon: Building2,
      content: <SiteAccessTab userId={user.id} />
    },
    {
      id: 'sessions',
      label: 'Sessions Actives',
      icon: Monitor,
      content: <SessionsTab userId={user.id} />
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            onClick={() => navigate('/admin/users')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {user.full_name}
            </h1>
            <p className="text-sm text-slate-600">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              user.is_active
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {user.is_active ? 'Actif' : 'Inactif'}
          </span>
          {user.account_locked && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
              Compte Verrouillé
            </span>
          )}
          {user.two_factor_enabled && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              2FA Activé
            </span>
          )}
        </div>
      </div>

      <Card className="p-4 bg-slate-50 border-slate-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-600 mb-1">Rôle</p>
            <p className="text-sm font-medium text-slate-900 capitalize">
              {user.role}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">Titre du Poste</p>
            <p className="text-sm font-medium text-slate-900">
              {user.job_title || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">Département</p>
            <p className="text-sm font-medium text-slate-900">
              {user.department || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">Langue</p>
            <p className="text-sm font-medium text-slate-900 uppercase">
              {user.language_preference}
            </p>
          </div>
        </div>
      </Card>

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
      />
    </div>
  );
}
