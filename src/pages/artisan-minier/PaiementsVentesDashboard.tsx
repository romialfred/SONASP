import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Clock, CheckCircle, FileText, AlertCircle, Filter, Download, Plus } from 'lucide-react';
import artisanPaiementsService, { type VenteEnAttentePaiement } from '@/services/artisanPaiementsService';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { MainLayout } from '@/components/layout/MainLayout';

const PaiementsVentesDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ventes, setVentes] = useState<VenteEnAttentePaiement[]>([]);
  const [filteredVentes, setFilteredVentes] = useState<VenteEnAttentePaiement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statutFilter, setStatutFilter] = useState<string>('tous');
  const [stats, setStats] = useState({
    total_ventes_en_attente: 0,
    montant_total_a_payer: 0,
    paiements_en_cours: 0,
    paiements_completes: 0
  });

  useEffect(() => {
    chargerDonnees();
  }, []);

  useEffect(() => {
    filtrerVentes();
  }, [searchTerm, statutFilter, ventes]);

  const chargerDonnees = async () => {
    try {
      setLoading(true);
      const [ventesData, statsData] = await Promise.all([
        artisanPaiementsService.getVentesEnAttentePaiement(),
        artisanPaiementsService.getDashboardStats()
      ]);

      setVentes(ventesData);
      setStats(statsData);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtrerVentes = () => {
    let result = [...ventes];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(v =>
        v.artisan_nom_complet?.toLowerCase().includes(term) ||
        v.numero_carte?.toLowerCase().includes(term) ||
        v.reference_vente?.toLowerCase().includes(term) ||
        v.numero_facture?.toLowerCase().includes(term)
      );
    }

    if (statutFilter && statutFilter !== 'tous') {
      result = result.filter(v => v.statut_paiement === statutFilter);
    }

    setFilteredVentes(result);
  };

  const getStatutBadgeClass = (statut: string) => {
    const classes = {
      'non_paye': 'bg-red-100 text-red-700',
      'facture_emise': 'bg-blue-100 text-blue-700',
      'en_paiement': 'bg-yellow-100 text-yellow-700',
      'paye': 'bg-green-100 text-green-700'
    };
    return classes[statut as keyof typeof classes] || 'bg-gray-100 text-gray-700';
  };

  const getStatutLibelle = (statut: string) => {
    const libelles = {
      'non_paye': 'Non payé',
      'facture_emise': 'Facture émise',
      'en_paiement': 'En paiement',
      'paye': 'Payé'
    };
    return libelles[statut as keyof typeof libelles] || statut;
  };

  const handleProcederPaiement = (vente: VenteEnAttentePaiement) => {
    navigate(`/artisan-minier/paiements/${vente.vente_id}/nouveau`);
  };

  const handleVoirDetails = (vente: VenteEnAttentePaiement) => {
    navigate(`/artisan-minier/ventes/${vente.vente_id}`);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <Loading size="lg" />
          <p className="mt-4 text-gray-600">Chargement des paiements en attente...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Paiements des Ventes d'Or Artisanal
          </h1>
          <p className="text-gray-600 mt-1">
            Gestion et suivi des paiements aux artisans miniers
          </p>
        </div>
        <Button
          onClick={() => navigate('/artisan-minier/paiements/historique')}
          variant="secondary"
        >
          <FileText className="w-4 h-4 mr-2" />
          Historique
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ventes en attente</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.total_ventes_en_attente}
              </p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Montant à payer</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.montant_total_a_payer.toLocaleString('fr-FR')}
              </p>
              <p className="text-xs text-gray-500">FCFA</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">En cours</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.paiements_en_cours}
              </p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Complétés</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.paiements_completes}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Rechercher par artisan, numéro carte, référence vente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={statutFilter}
              onChange={(e) => setStatutFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="tous">Tous les statuts</option>
              <option value="non_paye">Non payé</option>
              <option value="facture_emise">Facture émise</option>
              <option value="en_paiement">En paiement</option>
            </select>

            <Button variant="secondary" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Plus de filtres
            </Button>
          </div>
        </div>

        {filteredVentes.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">Aucune vente en attente de paiement</p>
            <p className="text-gray-500 mt-2">
              {searchTerm || statutFilter !== 'tous'
                ? 'Essayez de modifier vos filtres'
                : 'Toutes les ventes ont été payées'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Artisan</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">N° Carte</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Référence</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date vente</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">N° Facture</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Montant</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Attente</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Statut</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVentes.map((vente) => (
                  <tr
                    key={vente.vente_id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{vente.artisan_nom_complet}</p>
                        {vente.telephone && (
                          <p className="text-sm text-gray-500">{vente.telephone}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">{vente.numero_carte}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{vente.reference_vente}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {new Date(vente.date_vente).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4">
                      {vente.numero_facture ? (
                        <span className="text-sm font-medium text-blue-600">
                          {vente.numero_facture}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Aucune</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-semibold text-gray-900">
                        {vente.montant_net_a_payer?.toLocaleString('fr-FR') || '—'} FCFA
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {vente.jours_attente !== null && vente.jours_attente !== undefined ? (
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            vente.jours_attente > 7
                              ? 'bg-red-100 text-red-700'
                              : vente.jours_attente > 3
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {vente.jours_attente} jour{vente.jours_attente > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatutBadgeClass(
                          vente.statut_paiement
                        )}`}
                      >
                        {getStatutLibelle(vente.statut_paiement)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleProcederPaiement(vente)}
                          disabled={!vente.facture_id}
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          Payer
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleVoirDetails(vente)}
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredVentes.length > 0 && (
          <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
            <p>
              {filteredVentes.length} vente{filteredVentes.length > 1 ? 's' : ''} en attente
            </p>
            <p>
              Total à payer:{' '}
              <span className="font-semibold text-gray-900">
                {filteredVentes
                  .reduce((sum, v) => sum + (v.montant_net_a_payer || 0), 0)
                  .toLocaleString('fr-FR')}{' '}
                FCFA
              </span>
            </p>
          </div>
        )}
      </Card>
      </div>
    </MainLayout>
  );
};

export default PaiementsVentesDashboard;
