import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  Search,
  Filter,
  User,
  Building2,
  Phone,
  Mail,
  CreditCard,
  ChevronRight,
  Plus,
  Download,
  LayoutGrid,
  LayoutList,
  X,
  TrendingUp,
  Coins
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { Select } from '@/components/ui/Select';
import { artisanMinierService } from '@/services/artisanMinierService';
import { ArtisanMinierFormWithTabs } from '@/components/artisan/ArtisanMinierFormWithTabs';
import { cn } from '@/utils/cn';

type ViewMode = 'table' | 'grid';

export default function ArtisanMinierListe() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [artisans, setArtisans] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedArtisan, setSelectedArtisan] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    region: '',
    sexe: '',
    type_artisan: '',
    pays: ''
  });

  useEffect(() => {
    loadArtisans();
  }, []);

  const loadArtisans = async () => {
    try {
      setLoading(true);
      const data = await artisanMinierService.getAll();
      setArtisans(data || []);
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

  const handleEdit = (artisan: any) => {
    // Navigation vers la page de détails au lieu d'éditer inline
    navigate(`/artisan-minier/${artisan.id}`);
  };

  const filteredArtisans = artisans.filter(artisan => {
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

    if (filters.region && artisan.region !== filters.region) return false;
    if (filters.sexe && artisan.sexe !== filters.sexe) return false;
    if (filters.type_artisan && artisan.type_artisan !== filters.type_artisan) return false;
    if (filters.pays && artisan.pays !== filters.pays) return false;

    return true;
  });

  const uniqueRegions = Array.from(new Set(artisans.map(a => a.region).filter(Boolean))).sort();
  const uniquePays = Array.from(new Set(artisans.map(a => a.pays).filter(Boolean))).sort();

  const clearFilters = () => {
    setFilters({
      region: '',
      sexe: '',
      type_artisan: '',
      pays: ''
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  const exportToCSV = () => {
    if (artisans.length === 0) return;

    const headers = [
      'Type Personne',
      'Type Artisan',
      'Nom',
      'Prénoms',
      'Raison Sociale',
      'Téléphone',
      'Email',
      'Commune',
      'Région'
    ];

    const rows = artisans.map(a => [
      a.type_personne || '',
      a.type_artisan || '',
      a.nom || '',
      a.prenoms || '',
      a.raison_sociale || '',
      a.telephone || '',
      a.email || '',
      a.commune || '',
      a.region || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `artisans_miniers_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Liste des Artisans Miniers
            </h1>
            <p className="text-sm text-gray-600 mt-0.5">
              {filteredArtisans.length} artisan(s) enregistré(s)
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={exportToCSV}
              variant="outline"
              size="sm"
              disabled={artisans.length === 0}
              className="text-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Exporter CSV
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

        {/* Form Section - Inline */}
        {showForm && (
          <ArtisanMinierFormWithTabs
            artisan={selectedArtisan}
            onCancel={handleFormCancel}
            onSuccess={handleFormSuccess}
          />
        )}

        {/* Search Bar and Controls */}
        {!showForm && (
          <Card className="shadow-sm">
            <div className="p-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="Rechercher un artisan (nom, prénom, n° carte, téléphone...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    icon={Search}
                    className="text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={showFilters ? 'primary' : 'outline'}
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 text-xs px-4"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    Filtrer
                    {hasActiveFilters && (
                      <span className="ml-1 px-1.5 py-0.5 bg-emerald-600 text-white rounded-full text-xs">
                        {Object.values(filters).filter(v => v).length}
                      </span>
                    )}
                  </Button>
                  <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={cn(
                        'px-3 py-2 text-xs font-medium transition-colors',
                        viewMode === 'grid'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={cn(
                        'px-3 py-2 text-xs font-medium transition-colors border-l',
                        viewMode === 'table'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      <LayoutList className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Filters Panel */}
              {showFilters && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Région
                      </label>
                      <Select
                        value={filters.region}
                        onChange={(e) => setFilters({ ...filters, region: e.target.value })}
                        className="text-sm"
                      >
                        <option value="">Toutes les régions</option>
                        {uniqueRegions.map(region => (
                          <option key={region} value={region}>{region}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Genre
                      </label>
                      <Select
                        value={filters.sexe}
                        onChange={(e) => setFilters({ ...filters, sexe: e.target.value })}
                        className="text-sm"
                      >
                        <option value="">Tous</option>
                        <option value="M">Masculin</option>
                        <option value="F">Féminin</option>
                        <option value="Autre">Autre</option>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Type d'artisan
                      </label>
                      <Select
                        value={filters.type_artisan}
                        onChange={(e) => setFilters({ ...filters, type_artisan: e.target.value })}
                        className="text-sm"
                      >
                        <option value="">Tous les types</option>
                        <option value="exploitant">Exploitant</option>
                        <option value="collecteur">Collecteur</option>
                        <option value="intermediaire">Intermédiaire</option>
                        <option value="fournisseur">Fournisseur</option>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Pays
                      </label>
                      <Select
                        value={filters.pays}
                        onChange={(e) => setFilters({ ...filters, pays: e.target.value })}
                        className="text-sm"
                      >
                        <option value="">Tous les pays</option>
                        {uniquePays.map(pays => (
                          <option key={pays} value={pays}>{pays}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  {hasActiveFilters && (
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                        className="text-xs"
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Effacer les filtres
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Liste des artisans */}
        {!showForm && (
          <>
            {loading ? (
              <Card className="shadow-sm">
                <div className="p-12">
                  <Loading />
                </div>
              </Card>
            ) : filteredArtisans.length === 0 ? (
              <Card className="shadow-sm">
                <div className="text-center py-12 px-6">
                  <div className="inline-flex p-4 bg-gray-100 rounded-full mb-4">
                    <User className="h-12 w-12 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {searchQuery || hasActiveFilters ? 'Aucun artisan trouvé' : 'Aucun artisan enregistré'}
                  </h3>
                  <p className="text-sm text-gray-600 mb-5">
                    {searchQuery || hasActiveFilters
                      ? 'Essayez de modifier vos critères de recherche ou de filtrage'
                      : 'Commencez par enregistrer votre premier artisan minier'
                    }
                  </p>
                  {!searchQuery && !hasActiveFilters && (
                    <Button
                      variant="primary"
                      onClick={() => {
                        setSelectedArtisan(null);
                        setShowForm(true);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Enregistrer le premier artisan
                    </Button>
                  )}
                </div>
              </Card>
            ) : viewMode === 'table' ? (
              <Card className="shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-emerald-600 to-emerald-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Nom/Raison Sociale
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">
                          N° Carte
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Région
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Contact
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Or Vendu (g)
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">
                          CA (FCFA)
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredArtisans.map((artisan, idx) => (
                        <tr
                          key={artisan.id}
                          onClick={() => handleEdit(artisan)}
                          className={cn(
                            'cursor-pointer transition-colors hover:bg-emerald-50',
                            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                          )}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-emerald-100 rounded-lg">
                                {artisan.type_personne === 'physique' ? (
                                  <User className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <Building2 className="h-4 w-4 text-emerald-600" />
                                )}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-gray-900">
                                  {artisan.type_personne === 'physique'
                                    ? `${artisan.nom} ${artisan.prenoms || ''}`
                                    : artisan.raison_sociale
                                  }
                                </div>
                                {artisan.sexe && artisan.type_personne === 'physique' && (
                                  <div className="text-xs text-gray-500">
                                    {artisan.sexe === 'M' ? 'Masculin' : artisan.sexe === 'F' ? 'Féminin' : 'Autre'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-xs">
                              <CreditCard className="h-3.5 w-3.5 text-gray-400" />
                              <span className="font-mono text-gray-700">
                                {artisan.numero_carte || 'En attente'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              'px-2.5 py-1 rounded-full text-xs font-semibold capitalize',
                              artisan.type_artisan === 'exploitant' && 'bg-blue-100 text-blue-700',
                              artisan.type_artisan === 'collecteur' && 'bg-purple-100 text-purple-700',
                              artisan.type_artisan === 'intermediaire' && 'bg-orange-100 text-orange-700',
                              artisan.type_artisan === 'fournisseur' && 'bg-teal-100 text-teal-700'
                            )}>
                              {artisan.type_artisan}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-700">
                            {artisan.region || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-0.5">
                              {artisan.telephone && (
                                <div className="flex items-center gap-1.5 text-xs text-gray-700">
                                  <Phone className="h-3 w-3 text-gray-400" />
                                  {artisan.telephone}
                                </div>
                              )}
                              {artisan.email && (
                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                  <Mail className="h-3 w-3 text-gray-400" />
                                  {artisan.email.substring(0, 20)}...
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Coins className="h-3.5 w-3.5 text-yellow-500" />
                              <span className="text-xs font-semibold text-gray-900">
                                {artisan.quantite_or_vendu_grammes?.toFixed(2) || '0.00'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="text-xs font-semibold text-gray-900">
                                {artisan.chiffre_affaires_fcfa?.toLocaleString('fr-FR') || '0'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <ChevronRight className="h-5 w-5 text-gray-400 inline-block" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredArtisans.map((artisan) => (
                  <Card
                    key={artisan.id}
                    onClick={() => handleEdit(artisan)}
                    className="shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden border border-gray-200 hover:border-emerald-300"
                  >
                    <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                            {artisan.type_personne === 'physique' ? (
                              <User className="h-5 w-5 text-white" />
                            ) : (
                              <Building2 className="h-5 w-5 text-white" />
                            )}
                          </div>
                          <span className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-semibold capitalize',
                            'bg-white/90 text-emerald-700'
                          )}>
                            {artisan.type_artisan}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-1">
                          {artisan.type_personne === 'physique'
                            ? `${artisan.nom} ${artisan.prenoms || ''}`
                            : artisan.raison_sociale
                          }
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <CreditCard className="h-3 w-3" />
                          <span className="font-mono">
                            {artisan.numero_carte || 'En attente'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        {artisan.region && (
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded font-medium">
                            {artisan.region}
                          </span>
                        )}
                        {artisan.sexe && artisan.type_personne === 'physique' && (
                          <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded font-medium">
                            {artisan.sexe === 'M' ? 'M' : artisan.sexe === 'F' ? 'F' : 'A'}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 border-t pt-3">
                        {artisan.telephone && (
                          <div className="flex items-center gap-2 text-xs text-gray-700">
                            <Phone className="h-3 w-3 text-gray-400" />
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

                      <div className="grid grid-cols-2 gap-2 pt-3 border-t">
                        <div className="bg-yellow-50 p-2 rounded-lg">
                          <div className="flex items-center gap-1 mb-0.5">
                            <Coins className="h-3 w-3 text-yellow-600" />
                            <span className="text-xs text-yellow-700 font-medium">Or Vendu</span>
                          </div>
                          <div className="text-xs font-bold text-yellow-900">
                            {artisan.quantite_or_vendu_grammes?.toFixed(2) || '0.00'} g
                          </div>
                        </div>
                        <div className="bg-emerald-50 p-2 rounded-lg">
                          <div className="flex items-center gap-1 mb-0.5">
                            <TrendingUp className="h-3 w-3 text-emerald-600" />
                            <span className="text-xs text-emerald-700 font-medium">CA</span>
                          </div>
                          <div className="text-xs font-bold text-emerald-900">
                            {((artisan.chiffre_affaires_fcfa || 0) / 1000).toFixed(0)}K
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
