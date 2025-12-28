import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  User,
  Building2,
  Phone,
  Mail,
  CreditCard,
  Plus,
  Download,
  Calendar,
  Clock,
  Coins,
  TrendingUp,
  Receipt,
  Package,
  Users,
  Pickaxe,
  Handshake
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { artisanMinierService } from '@/services/artisanMinierService';
import { carteProfessionnelleService } from '@/services/carteProfessionnelleService';
import { ArtisanMinierFormWithTabs } from '@/components/artisan/ArtisanMinierFormWithTabs';
import { cn } from '@/utils/cn';

type TypeArtisan = 'collecteur' | 'fournisseur' | 'exploitant' | 'intermediaire';

interface ArtisanWithStats {
  id: string;
  numero_carte: string;
  type_personne: 'physique' | 'morale';
  type_artisan: TypeArtisan;
  nom?: string;
  prenoms?: string;
  raison_sociale?: string;
  telephone?: string;
  email?: string;
  region?: string;
  commune?: string;
  photo_url?: string;
  created_at?: string;
  quantite_or_vendu_grammes?: number;
  chiffre_affaires_fcfa?: number;
  total_taxes_fcfa?: number;
  carte?: {
    date_expiration?: string;
    statut?: string;
  };
}

const TYPE_COLORS = {
  collecteur: {
    primary: '#475569',
    light: '#94a3b8',
    bg: '#f8fafc',
    border: '#cbd5e1',
    headerBg: '#1e293b',
    headerText: '#ffffff'
  },
  fournisseur: {
    primary: '#0d9488',
    light: '#5eead4',
    bg: '#f0fdfa',
    border: '#99f6e4',
    headerBg: '#0f766e',
    headerText: '#ffffff'
  },
  exploitant: {
    primary: '#1e40af',
    light: '#93c5fd',
    bg: '#eff6ff',
    border: '#bfdbfe',
    headerBg: '#1e3a8a',
    headerText: '#ffffff'
  },
  intermediaire: {
    primary: '#d97706',
    light: '#fcd34d',
    bg: '#fffbeb',
    border: '#fde68a',
    headerBg: '#b45309',
    headerText: '#ffffff'
  }
};

const TYPE_LABELS = {
  collecteur: 'Collecteurs',
  fournisseur: 'Fournisseurs',
  exploitant: 'Exploitants',
  intermediaire: 'Intermédiaires'
};

const TYPE_ICONS = {
  collecteur: Users,
  fournisseur: Package,
  exploitant: Pickaxe,
  intermediaire: Handshake
};

function calculateTimeUntilExpiration(expirationDate?: string, createdDate?: string) {
  let expiry: Date;

  if (!expirationDate && !createdDate) {
    return { expired: true, years: 0, months: 0, days: 0, text: 'Non définie' };
  }

  if (!expirationDate && createdDate) {
    const created = new Date(createdDate);
    expiry = new Date(created);
    expiry.setFullYear(expiry.getFullYear() + 1);
  } else {
    expiry = new Date(expirationDate!);
  }

  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { expired: true, years: 0, months: 0, days: 0, text: 'Expirée' };
  }

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  const days = diffDays % 30;

  let text = '';
  if (years > 0) text += `${years} an${years > 1 ? 's' : ''}`;
  if (months > 0) text += `${text ? ', ' : ''}${months} mois`;
  if (years === 0 && days > 0) text += `${text ? ', ' : ''}${days} jour${days > 1 ? 's' : ''}`;

  return { expired: false, years, months, days, text: text || '< 1 jour' };
}

export default function ArtisanMinierListe() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [artisans, setArtisans] = useState<ArtisanWithStats[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedArtisan, setSelectedArtisan] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TypeArtisan>('collecteur');

  useEffect(() => {
    loadArtisans();
  }, []);

  const loadArtisans = async () => {
    try {
      setLoading(true);
      const data = await artisanMinierService.getAll();

      const artisansWithCartes = await Promise.all(
        (data || []).map(async (artisan: any) => {
          try {
            const cartes = await carteProfessionnelleService.getByArtisanId(artisan.id);
            const carteActive = cartes?.[0];
            return {
              ...artisan,
              carte: carteActive,
              quantite_or_vendu_grammes: artisan.quantite_or_vendu_grammes || 0,
              chiffre_affaires_fcfa: artisan.chiffre_affaires_fcfa || 0,
              total_taxes_fcfa: artisan.total_taxes_fcfa || 0
            };
          } catch {
            return {
              ...artisan,
              quantite_or_vendu_grammes: artisan.quantite_or_vendu_grammes || 0,
              chiffre_affaires_fcfa: artisan.chiffre_affaires_fcfa || 0,
              total_taxes_fcfa: artisan.total_taxes_fcfa || 0
            };
          }
        })
      );

      setArtisans(artisansWithCartes);
    } catch (error) {
      console.error('Error loading artisans:', error);
      setArtisans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = async () => {
    setShowForm(false);
    setSelectedArtisan(null);
    await loadArtisans();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setSelectedArtisan(null);
  };

  const handleCardClick = (artisan: any) => {
    navigate(`/artisan-minier/${artisan.id}`);
  };

  const filteredArtisans = artisans.filter(artisan => {
    if (artisan.type_artisan !== activeTab) return false;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (
        artisan.nom?.toLowerCase().includes(query) ||
        artisan.prenoms?.toLowerCase().includes(query) ||
        artisan.raison_sociale?.toLowerCase().includes(query) ||
        artisan.numero_carte?.toLowerCase().includes(query) ||
        artisan.telephone?.toLowerCase().includes(query)
      );
      if (!matchesSearch) return false;
    }

    return true;
  });

  const countsByType = {
    collecteur: artisans.filter(a => a.type_artisan === 'collecteur').length,
    fournisseur: artisans.filter(a => a.type_artisan === 'fournisseur').length,
    exploitant: artisans.filter(a => a.type_artisan === 'exploitant').length,
    intermediaire: artisans.filter(a => a.type_artisan === 'intermediaire').length
  };

  const exportToCSV = () => {
    if (filteredArtisans.length === 0) return;

    const headers = [
      'Type Artisan',
      'Nom/Raison Sociale',
      'N° Carte',
      'Téléphone',
      'Email',
      'Région',
      'Or Vendu (g)',
      'CA (FCFA)',
      'Taxes (FCFA)'
    ];

    const rows = filteredArtisans.map(a => [
      a.type_artisan || '',
      a.type_personne === 'physique' ? `${a.nom} ${a.prenoms || ''}` : a.raison_sociale || '',
      a.numero_carte || '',
      a.telephone || '',
      a.email || '',
      a.region || '',
      a.quantite_or_vendu_grammes?.toString() || '0',
      a.chiffre_affaires_fcfa?.toString() || '0',
      a.total_taxes_fcfa?.toString() || '0'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `artisans_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Liste des Artisans Miniers
            </h1>
            <p className="text-sm text-gray-600 mt-0.5">
              {artisans.length} artisan(s) enregistré(s) au total
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={exportToCSV}
              variant="outline"
              size="sm"
              disabled={filteredArtisans.length === 0}
              className="text-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Exporter
            </Button>
            {!showForm && (
              <Button
                onClick={() => {
                  setSelectedArtisan(null);
                  setShowForm(true);
                }}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Nouvel Artisan
              </Button>
            )}
          </div>
        </div>

        {showForm && (
          <ArtisanMinierFormWithTabs
            artisan={selectedArtisan}
            onCancel={handleFormCancel}
            onSuccess={handleFormSuccess}
          />
        )}

        {!showForm && (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="border-b border-gray-200">
                <div className="flex overflow-x-auto bg-gray-50">
                  {(['collecteur', 'fournisseur', 'exploitant', 'intermediaire'] as TypeArtisan[]).map((type) => {
                    const IconComponent = TYPE_ICONS[type];
                    const colors = TYPE_COLORS[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setActiveTab(type)}
                        className={cn(
                          'flex-1 min-w-[160px] px-6 py-4 text-sm font-medium transition-all relative',
                          'hover:bg-white focus:outline-none',
                          activeTab === type
                            ? 'text-gray-900 bg-white'
                            : 'text-gray-600'
                        )}
                      >
                        <div className="flex items-center justify-center gap-3">
                          <IconComponent
                            className="w-5 h-5"
                            style={{
                              color: activeTab === type ? colors.primary : '#9ca3af'
                            }}
                          />
                          <span className={activeTab === type ? 'font-semibold' : ''}>
                            {TYPE_LABELS[type]}
                          </span>
                          <span
                            className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                            style={{
                              backgroundColor: activeTab === type ? colors.primary : '#e5e7eb',
                              color: activeTab === type ? '#ffffff' : '#6b7280'
                            }}
                          >
                            {countsByType[type]}
                          </span>
                        </div>
                        {activeTab === type && (
                          <div
                            className="absolute bottom-0 left-0 right-0 h-0.5"
                            style={{ backgroundColor: colors.primary }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-4">
                <Input
                  placeholder={`Rechercher un ${activeTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  icon={Search}
                  className="text-sm"
                />
              </div>
            </div>

            {loading ? (
              <Card className="shadow-sm">
                <div className="p-12">
                  <Loading />
                </div>
              </Card>
            ) : filteredArtisans.length === 0 ? (
              <Card className="shadow-sm">
                <div className="text-center py-12 px-6">
                  <div
                    className="inline-flex p-4 rounded-full mb-4"
                    style={{ backgroundColor: TYPE_COLORS[activeTab].bg }}
                  >
                    <User
                      className="h-12 w-12"
                      style={{ color: TYPE_COLORS[activeTab].primary }}
                    />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {searchQuery ? 'Aucun artisan trouvé' : `Aucun ${activeTab} enregistré`}
                  </h3>
                  <p className="text-sm text-gray-600 mb-5">
                    {searchQuery
                      ? 'Essayez de modifier votre recherche'
                      : `Commencez par enregistrer votre premier ${activeTab}`
                    }
                  </p>
                  {!searchQuery && (
                    <Button
                      variant="primary"
                      onClick={() => {
                        setSelectedArtisan(null);
                        setShowForm(true);
                      }}
                      className="text-sm hover:opacity-90"
                      style={{ backgroundColor: TYPE_COLORS[activeTab].primary }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Enregistrer le premier {activeTab}
                    </Button>
                  )}
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredArtisans.map((artisan) => {
                  const timeUntilExpiry = calculateTimeUntilExpiration(
                    artisan.carte?.date_expiration,
                    artisan.carte?.created_at || artisan.created_at
                  );
                  const colors = TYPE_COLORS[artisan.type_artisan];

                  return (
                    <Card
                      key={artisan.id}
                      onClick={() => handleCardClick(artisan)}
                      className="shadow-md hover:shadow-xl transition-all cursor-pointer overflow-hidden border border-gray-200 hover:scale-[1.02]"
                      style={{ borderColor: colors.border }}
                    >
                      <div
                        className="p-4 min-h-[112px] flex items-center"
                        style={{ backgroundColor: colors.headerBg }}
                      >
                        <div className="flex items-start justify-between w-full text-white">
                          <div className="flex-1 pr-3">
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className="p-1.5 rounded-lg"
                                style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
                              >
                                {artisan.type_personne === 'physique' ? (
                                  <User className="h-4 w-4" />
                                ) : (
                                  <Building2 className="h-4 w-4" />
                                )}
                              </div>
                              <span
                                className="px-2.5 py-1 rounded-full text-xs font-bold capitalize"
                                style={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                  color: colors.headerBg
                                }}
                              >
                                {artisan.type_artisan}
                              </span>
                            </div>
                            <h3 className="text-sm font-bold leading-tight text-white">
                              {artisan.type_personne === 'physique'
                                ? `${artisan.nom || ''} ${artisan.prenoms || ''}`.trim()
                                : artisan.raison_sociale || 'N/A'
                              }
                            </h3>
                          </div>
                          <div className="flex-shrink-0">
                            <img
                              src={artisan.photo_url || '/sonasp_logo.png'}
                              alt={artisan.photo_url ? 'Photo' : 'Logo SONASP'}
                              className="w-16 h-20 object-cover rounded-lg border-2 border-white shadow-lg bg-white"
                            />
                          </div>
                        </div>
                      </div>

                      <div
                        className="p-4 space-y-3"
                        style={{ backgroundColor: colors.bg }}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-gray-700">
                            <CreditCard className="h-3.5 w-3.5 text-gray-500" />
                            <span className="font-mono font-semibold">
                              {artisan.numero_carte || 'En attente'}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-start gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-gray-600 font-medium">Créé le</div>
                              <div className="text-gray-900 font-semibold">
                                {artisan.created_at
                                  ? new Date(artisan.created_at).toLocaleDateString('fr-FR')
                                  : 'N/A'
                                }
                              </div>
                            </div>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-gray-600 font-medium">Expire dans</div>
                              <div className={cn(
                                'font-semibold text-xs',
                                timeUntilExpiry.expired ? 'text-red-600' : 'text-emerald-600'
                              )}>
                                {timeUntilExpiry.text}
                              </div>
                            </div>
                          </div>
                        </div>

                        {(artisan.telephone || artisan.email) && (
                          <div className="space-y-1 pt-2 border-t border-gray-200">
                            {artisan.telephone && (
                              <div className="flex items-center gap-2 text-xs text-gray-700">
                                <Phone className="h-3 w-3 text-gray-500" />
                                <span>{artisan.telephone}</span>
                              </div>
                            )}
                            {artisan.email && (
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Mail className="h-3 w-3 text-gray-400" />
                                <span className="truncate">{artisan.email}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="bg-gradient-to-br from-gray-50 to-white px-4 py-3 border-t border-gray-200">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white rounded-lg p-2 shadow-sm border border-amber-200">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <Coins className="h-3 w-3 text-amber-600" />
                            </div>
                            <div className="text-[10px] text-gray-600 font-medium mb-0.5">Or Vendu</div>
                            <div className="text-xs font-bold text-amber-700">
                              {(artisan.quantite_or_vendu_grammes || 0).toFixed(1)} g
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-2 shadow-sm border border-emerald-200">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <TrendingUp className="h-3 w-3 text-emerald-600" />
                            </div>
                            <div className="text-[10px] text-gray-600 font-medium mb-0.5">CA</div>
                            <div className="text-xs font-bold text-emerald-700">
                              {((artisan.chiffre_affaires_fcfa || 0) / 1000000).toFixed(1)}M
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-2 shadow-sm border border-blue-200">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <Receipt className="h-3 w-3 text-blue-600" />
                            </div>
                            <div className="text-[10px] text-gray-600 font-medium mb-0.5">Taxes</div>
                            <div className="text-xs font-bold text-blue-700">
                              {((artisan.total_taxes_fcfa || 0) / 1000).toFixed(0)}K
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
