import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Filter, Calendar, DollarSign, CheckCircle, Clock, XCircle } from 'lucide-react';
import artisanPaiementsService, { type PaiementArtisan } from '@/services/artisanPaiementsService';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { MainLayout } from '@/components/layout/MainLayout';

const PaiementsHistorique = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paiements, setPaiements] = useState<PaiementArtisan[]>([]);
  const [filteredPaiements, setFilteredPaiements] = useState<PaiementArtisan[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statutFilter, setStatutFilter] = useState<string>('tous');
  const [typePaiementFilter, setTypePaiementFilter] = useState<string>('tous');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  useEffect(() => {
    chargerHistorique();
  }, []);

  useEffect(() => {
    filtrerPaiements();
  }, [searchTerm, statutFilter, typePaiementFilter, dateDebut, dateFin, paiements]);

  const chargerHistorique = async () => {
    try {
      setLoading(true);
      const data = await artisanPaiementsService.getAllPaiements();
      setPaiements(data);
    } catch (error) {
      console.error('Erreur chargement historique:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtrerPaiements = () => {
    let result = [...paiements];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.reference_paiement?.toLowerCase().includes(term) ||
        (p as any).artisan?.nom?.toLowerCase().includes(term) ||
        (p as any).artisan?.prenoms?.toLowerCase().includes(term) ||
        (p as any).artisan?.numero_carte?.toLowerCase().includes(term)
      );
    }

    if (statutFilter && statutFilter !== 'tous') {
      result = result.filter(p => p.statut === statutFilter);
    }

    if (typePaiementFilter && typePaiementFilter !== 'tous') {
      result = result.filter(p => p.type_paiement === typePaiementFilter);
    }

    if (dateDebut) {
      result = result.filter(p => new Date(p.date_paiement) >= new Date(dateDebut));
    }

    if (dateFin) {
      result = result.filter(p => new Date(p.date_paiement) <= new Date(dateFin));
    }

    setFilteredPaiements(result);
  };

  const getStatutBadge = (statut: string) => {
    const badges = {
      'en_attente': { bg: 'bg-gray-100', text: 'text-gray-700', label: 'En attente', icon: Clock },
      'en_traitement': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'En traitement', icon: Clock },
      'valide': { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Validé', icon: CheckCircle },
      'complete': { bg: 'bg-green-100', text: 'text-green-700', label: 'Complété', icon: CheckCircle },
      'annule': { bg: 'bg-red-100', text: 'text-red-700', label: 'Annulé', icon: XCircle },
      'echec': { bg: 'bg-red-100', text: 'text-red-700', label: 'Échec', icon: XCircle }
    };

    const badge = badges[statut as keyof typeof badges] || badges.en_attente;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  const getTypePaiementLabel = (type: string) => {
    const types: Record<string, string> = {
      'virement_bancaire': 'Virement bancaire',
      'cash': 'Cash',
      'orange_money': 'Orange Money',
      'mobile_money': 'Mobile Money',
      'moov_money': 'Moov Money',
      'wave': 'Wave',
      'cheque': 'Chèque'
    };
    return types[type] || type;
  };

  const exporterHistorique = () => {
    console.log('Export historique:', filteredPaiements);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <Loading size="lg" />
          <p className="mt-4 text-gray-600">Chargement de l'historique...</p>
        </div>
      </MainLayout>
    );
  }

  const stats = {
    total: paiements.length,
    completes: paiements.filter(p => p.statut === 'complete').length,
    enCours: paiements.filter(p => ['en_attente', 'en_traitement', 'valide'].includes(p.statut)).length,
    annules: paiements.filter(p => p.statut === 'annule').length,
    montantTotal: paiements
      .filter(p => p.statut === 'complete')
      .reduce((sum, p) => sum + (p.montant_paye || 0), 0)
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={() => navigate('/artisan-minier/paiements')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Historique des Paiements
              </h1>
              <p className="text-gray-600 mt-1">
                Consultation complète de tous les paiements effectués
              </p>
            </div>
          </div>
          <Button onClick={exporterHistorique} variant="secondary">
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total paiements</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Complétés</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.completes}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">En cours</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.enCours}</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Montant total</p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {stats.montantTotal.toLocaleString('fr-FR')}
                </p>
                <p className="text-xs text-gray-500">FCFA</p>
              </div>
              <div className="bg-emerald-100 p-3 rounded-full">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="space-y-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Rechercher par référence, artisan, numéro carte..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>

              <select
                value={statutFilter}
                onChange={(e) => setStatutFilter(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="tous">Tous les statuts</option>
                <option value="en_attente">En attente</option>
                <option value="en_traitement">En traitement</option>
                <option value="valide">Validé</option>
                <option value="complete">Complété</option>
                <option value="annule">Annulé</option>
                <option value="echec">Échec</option>
              </select>

              <select
                value={typePaiementFilter}
                onChange={(e) => setTypePaiementFilter(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="tous">Tous les types</option>
                <option value="virement_bancaire">Virement bancaire</option>
                <option value="orange_money">Orange Money</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="moov_money">Moov Money</option>
                <option value="wave">Wave</option>
                <option value="cash">Cash</option>
                <option value="cheque">Chèque</option>
              </select>
            </div>

            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <Input
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  placeholder="Date début"
                />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <Input
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  placeholder="Date fin"
                />
              </div>
              {(dateDebut || dateFin || searchTerm || statutFilter !== 'tous' || typePaiementFilter !== 'tous') && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setStatutFilter('tous');
                    setTypePaiementFilter('tous');
                    setDateDebut('');
                    setDateFin('');
                  }}
                >
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>

          {filteredPaiements.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">Aucun paiement trouvé</p>
              <p className="text-gray-500 mt-2">
                {searchTerm || statutFilter !== 'tous' || typePaiementFilter !== 'tous'
                  ? 'Essayez de modifier vos filtres'
                  : 'Aucun paiement enregistré pour le moment'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Référence</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Artisan</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Montant</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Statut</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPaiements.map((paiement) => (
                      <tr
                        key={paiement.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className="font-medium text-blue-600">
                            {paiement.reference_paiement}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">
                              {(paiement as any).artisan?.nom} {(paiement as any).artisan?.prenoms}
                            </p>
                            <p className="text-sm text-gray-500">
                              {(paiement as any).artisan?.numero_carte}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {getTypePaiementLabel(paiement.type_paiement)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {new Date(paiement.date_paiement).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-semibold text-gray-900">
                            {paiement.montant_paye?.toLocaleString('fr-FR')} FCFA
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {getStatutBadge(paiement.statut)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => navigate(`/artisan-minier/paiements/${paiement.id}/details`)}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
                <p>
                  {filteredPaiements.length} paiement{filteredPaiements.length > 1 ? 's' : ''} trouvé{filteredPaiements.length > 1 ? 's' : ''}
                </p>
                <p>
                  Total:{' '}
                  <span className="font-semibold text-gray-900">
                    {filteredPaiements
                      .filter(p => p.statut === 'complete')
                      .reduce((sum, p) => sum + (p.montant_paye || 0), 0)
                      .toLocaleString('fr-FR')}{' '}
                    FCFA
                  </span>
                </p>
              </div>
            </>
          )}
        </Card>
      </div>
    </MainLayout>
  );
};

export default PaiementsHistorique;
