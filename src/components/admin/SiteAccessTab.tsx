import { useEffect, useState } from 'react';
import { Building2, Star, Calendar, Check, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';

interface SiteAccessTabProps {
  userId: string;
}

interface MiningCompanyAccess {
  id: string;
  mining_company_id: string;
  access_level: string;
  is_primary: boolean;
  granted_at: string;
  expires_at: string | null;
  is_active: boolean;
  mining_company?: {
    id: string;
    name: string;
    code: string;
    country: string;
  };
}

const ACCESS_LEVEL_COLORS: Record<string, string> = {
  read: 'bg-blue-100 text-blue-700',
  write: 'bg-emerald-100 text-emerald-700',
  admin: 'bg-amber-100 text-amber-700',
  full: 'bg-purple-100 text-purple-700'
};

const ACCESS_LEVEL_LABELS: Record<string, string> = {
  read: 'Lecture',
  write: 'Écriture',
  admin: 'Administrateur',
  full: 'Complet'
};

export default function SiteAccessTab({ userId }: SiteAccessTabProps) {
  const [accesses, setAccesses] = useState<MiningCompanyAccess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccess();
  }, [userId]);

  const fetchAccess = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_mining_company_access')
        .select(`
          *,
          mining_company:mining_companies(id, name, code, country)
        `)
        .eq('user_id', userId)
        .order('is_primary', { ascending: false })
        .order('granted_at', { ascending: false });

      if (error) throw error;
      setAccesses(data || []);
    } catch (error) {
      console.error('Error fetching access:', error);
      setAccesses([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Aucune expiration';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-64 bg-slate-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  const activeAccesses = accesses.filter(a => a.is_active);
  const expiredAccesses = accesses.filter(a => !a.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Accès aux Sites Miniers
          </h3>
          <p className="text-sm text-slate-600">
            {activeAccesses.length} accès actif{activeAccesses.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {accesses.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">Aucun accès configuré</p>
          <p className="text-sm text-slate-500 mt-2">
            L'utilisateur n'a accès à aucun site minier pour le moment
          </p>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              Accès Actifs
            </h4>

            {activeAccesses.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-sm text-slate-600">Aucun accès actif</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeAccesses.map((access) => {
                  const company = access.mining_company;
                  const isExpired = access.expires_at && new Date(access.expires_at) < new Date();

                  return (
                    <Card
                      key={access.id}
                      className={`p-6 hover:shadow-md transition-shadow ${
                        access.is_primary ? 'border-amber-300 bg-amber-50/30' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Building2 className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="text-base font-semibold text-slate-900">
                              {company?.name || 'Site Inconnu'}
                            </h4>
                            <p className="text-xs text-slate-500">
                              {company?.code} • {company?.country}
                            </p>
                          </div>
                        </div>
                        {access.is_primary && (
                          <Star className="w-5 h-5 text-amber-500 fill-amber-500" title="Site principal" />
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                          <span className="text-xs text-slate-600">Niveau d'accès</span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              ACCESS_LEVEL_COLORS[access.access_level] || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {ACCESS_LEVEL_LABELS[access.access_level] || access.access_level}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                          <span className="text-xs text-slate-600">Accordé le</span>
                          <span className="text-xs text-slate-900">
                            {formatDate(access.granted_at)}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                          <span className="text-xs text-slate-600">Expire le</span>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span className={`text-xs ${isExpired ? 'text-red-600 font-medium' : 'text-slate-900'}`}>
                              {formatDate(access.expires_at)}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center py-2">
                          <span className="text-xs text-slate-600">Statut</span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              isExpired
                                ? 'bg-red-100 text-red-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {isExpired ? 'Expiré' : 'Actif'}
                          </span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {expiredAccesses.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <X className="w-4 h-4 text-red-600" />
                Accès Révoqués/Expirés ({expiredAccesses.length})
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {expiredAccesses.map((access) => {
                  const company = access.mining_company;

                  return (
                    <Card
                      key={access.id}
                      className="p-6 bg-slate-50 border-slate-200 opacity-60"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-slate-200 rounded-lg">
                          <Building2 className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <h4 className="text-base font-semibold text-slate-700">
                            {company?.name || 'Site Inconnu'}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {company?.code} • {company?.country}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">
                          {ACCESS_LEVEL_LABELS[access.access_level]}
                        </span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          Révoqué
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-blue-900 mb-1">
                  À propos des Accès
                </h4>
                <p className="text-sm text-blue-700">
                  Les accès aux sites miniers définissent quelles compagnies minières l'utilisateur
                  peut consulter et gérer dans l'application. Le site principal est le site par
                  défaut affiché lors de la connexion. Les accès expirés sont conservés pour
                  l'historique mais n'autorisent plus l'utilisateur à accéder aux données.
                </p>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
