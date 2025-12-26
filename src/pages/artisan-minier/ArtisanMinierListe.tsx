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
  Download
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { artisanMinierService } from '@/services/artisanMinierService';
import { ArtisanMinierFormWithTabs } from '@/components/artisan/ArtisanMinierFormWithTabs';

export default function ArtisanMinierListe() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [artisans, setArtisans] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedArtisan, setSelectedArtisan] = useState<any>(null);

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
    setSelectedArtisan(artisan);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredArtisans = artisans.filter(artisan => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      artisan.nom?.toLowerCase().includes(query) ||
      artisan.prenoms?.toLowerCase().includes(query) ||
      artisan.raison_sociale?.toLowerCase().includes(query) ||
      artisan.numero_carte?.toLowerCase().includes(query) ||
      artisan.telephone?.toLowerCase().includes(query)
    );
  });

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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Liste des Artisans Miniers
            </h1>
            <p className="text-gray-600 mt-1">
              {filteredArtisans.length} artisan(s) enregistré(s)
            </p>
          </div>

          <div className="flex gap-2 mt-4 md:mt-0">
            <Button
              onClick={exportToCSV}
              variant="outline"
              size="sm"
              disabled={artisans.length === 0}
              className="btn-text-base"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Exporter CSV
            </Button>
            {!showForm && (
              <Button
                onClick={() => {
                  setSelectedArtisan(null);
                  setShowForm(true);
                }}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 btn-text-base"
              >
                <Plus className="w-4 h-4 mr-1.5" />
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

        {/* Search Bar */}
        {!showForm && (
          <Card className="shadow-sm">
            <div className="p-5">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Rechercher un artisan (nom, prénom, n° carte, téléphone...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    icon={Search}
                  />
                </div>
                <Button variant="outline" className="flex items-center gap-2 px-5">
                  <Filter className="h-4 w-4" />
                  Filtrer
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Liste des artisans */}
        {!showForm && (
          <Card className="shadow-sm">
            {loading ? (
              <div className="p-12">
                <Loading />
              </div>
            ) : filteredArtisans.length === 0 ? (
              <div className="text-center py-16 px-6">
                <div className="inline-flex p-5 bg-gray-100 rounded-full mb-5">
                  <User className="h-16 w-16 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {searchQuery ? 'Aucun artisan trouvé' : 'Aucun artisan enregistré'}
                </h3>
                <p className="text-gray-600 mb-7 text-base">
                  {searchQuery
                    ? 'Essayez de modifier vos critères de recherche'
                    : 'Commencez par enregistrer votre premier artisan minier'
                  }
                </p>
                {!searchQuery && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      setSelectedArtisan(null);
                      setShowForm(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 px-6 py-3"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Enregistrer le premier artisan
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredArtisans.map((artisan) => (
                  <div
                    key={artisan.id}
                    onClick={() => handleEdit(artisan)}
                    className="p-5 hover:bg-gray-50 transition-all cursor-pointer hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-5 flex-1">
                        <div className="p-4 bg-emerald-100 rounded-xl shadow-sm">
                          {artisan.type_personne === 'physique' ? (
                            <User className="h-7 w-7 text-emerald-600" />
                          ) : (
                            <Building2 className="h-7 w-7 text-emerald-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 mb-2">
                            {artisan.type_personne === 'physique'
                              ? `${artisan.nom} ${artisan.prenoms || ''}`
                              : artisan.raison_sociale
                            }
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                            <span className="flex items-center gap-1.5 font-medium">
                              <CreditCard className="h-4 w-4" />
                              {artisan.numero_carte || 'En attente'}
                            </span>
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">
                              {artisan.type_artisan}
                            </span>
                            {artisan.telephone && (
                              <span className="flex items-center gap-1.5">
                                <Phone className="h-4 w-4" />
                                {artisan.telephone}
                              </span>
                            )}
                            {artisan.email && (
                              <span className="flex items-center gap-1.5">
                                <Mail className="h-4 w-4" />
                                {artisan.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-6 w-6 text-gray-400 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
