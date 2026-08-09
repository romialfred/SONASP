import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { Select } from '@/components/ui/Select';
import { ArrowLeft, Download, MapPin, User, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { artisanAnalyticsService } from '@/services/artisanAnalyticsService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const RapportChiffreAffaires = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [typeRapport, setTypeRapport] = useState<'region' | 'artisan' | 'mensuel' | 'trimestriel' | 'annuel'>('region');
  const [donnees, setDonnees] = useState<any[]>([]);
  const [annee, setAnnee] = useState<number>(new Date().getFullYear());
  const [regionSelectionnee, setRegionSelectionnee] = useState<string>('');

  useEffect(() => {
    chargerDonnees();
  }, [typeRapport, annee, regionSelectionnee]);

  const chargerDonnees = async () => {
    try {
      setLoading(true);

      switch (typeRapport) {
        case 'region':
          const caRegion = await artisanAnalyticsService.getChiffreAffairesParRegion();
          setDonnees(caRegion);
          break;
        case 'artisan':
          const caArtisan = await artisanAnalyticsService.getChiffreAffairesParArtisan(
            undefined,
            undefined,
            regionSelectionnee || undefined
          );
          setDonnees(caArtisan.slice(0, 20));
          break;
        case 'mensuel':
          const caMensuel = await artisanAnalyticsService.getChiffreAffairesParMois(annee);
          setDonnees(caMensuel);
          break;
        case 'trimestriel':
          const caTrimestriel = await artisanAnalyticsService.getChiffreAffairesParTrimestre(annee);
          setDonnees(caTrimestriel);
          break;
        case 'annuel':
          const caAnnuel = await artisanAnalyticsService.getChiffreAffairesParAnnee(
            annee - 4,
            annee
          );
          setDonnees(caAnnuel);
          break;
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const exporterRapport = async () => {
    try {
      const blob = await artisanAnalyticsService.exporterRapportExcel(
        `CA_${typeRapport}_${annee}`,
        donnees
      );

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rapport_ca_${typeRapport}_${annee}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur export:', error);
    }
  };

  const formatMontant = (montant: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(montant);
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={() => navigate('/artisan-minier/rapports')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Rapport Chiffre d'Affaires</h1>
              <p className="text-gray-600 mt-1">Analyse détaillée des ventes par région, artisan et période</p>
            </div>
          </div>
          <Button onClick={exporterRapport}>
            <Download className="w-4 h-4 mr-2" />
            Exporter Excel
          </Button>
        </div>

        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type de rapport</label>
              <Select
                value={typeRapport}
                onChange={(e) => setTypeRapport(e.target.value as any)}
                className="w-full"
              >
                <option value="region">Par Région</option>
                <option value="artisan">Par Artisan</option>
                <option value="mensuel">Mensuel</option>
                <option value="trimestriel">Trimestriel</option>
                <option value="annuel">Annuel</option>
              </Select>
            </div>

            {(typeRapport === 'mensuel' || typeRapport === 'trimestriel' || typeRapport === 'annuel') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Année</label>
                <Select
                  value={annee.toString()}
                  onChange={(e) => setAnnee(parseInt(e.target.value))}
                  className="w-full"
                >
                  {[...Array(5)].map((_, i) => {
                    const year = new Date().getFullYear() - i;
                    return (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    );
                  })}
                </Select>
              </div>
            )}

            {typeRapport === 'artisan' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Région (optionnel)</label>
                <Select
                  value={regionSelectionnee}
                  onChange={(e) => setRegionSelectionnee(e.target.value)}
                  className="w-full"
                >
                  <option value="">Toutes les régions</option>
                  <option value="Hauts-Bassins">Hauts-Bassins</option>
                  <option value="Centre">Centre</option>
                  <option value="Nord">Nord</option>
                  <option value="Est">Est</option>
                  <option value="Sud-Ouest">Sud-Ouest</option>
                </Select>
              </div>
            )}
          </div>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loading size="lg" />
          </div>
        ) : (
          <>
            {typeRapport === 'region' && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Chiffre d'Affaires par Région
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={donnees}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="region" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip formatter={(value: any) => formatMontant(value) + ' FCFA'} />
                    <Legend />
                    <Bar dataKey="montant_total_brut" fill="#B8860B" name="CA Brut" />
                    <Bar dataKey="montant_total_taxes" fill="#EF4444" name="Taxes" />
                    <Bar dataKey="montant_total_net" fill="#10B981" name="CA Net" />
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Région</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Ventes</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Artisans</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Quantité (g)</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">CA Brut</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Taxes</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">CA Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {donnees.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.region}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">{item.nombre_ventes}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">{item.nombre_artisans}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {formatMontant(item.quantite_totale_grammes)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            {formatMontant(item.montant_total_brut)} FCFA
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-red-600">
                            {formatMontant(item.montant_total_taxes)} FCFA
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-600">
                            {formatMontant(item.montant_total_net)} FCFA
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100 font-semibold">
                      <tr>
                        <td className="px-4 py-3 text-sm">TOTAL</td>
                        <td className="px-4 py-3 text-sm text-right">
                          {donnees.reduce((sum, item) => sum + item.nombre_ventes, 0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {donnees.reduce((sum, item) => sum + item.nombre_artisans, 0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {formatMontant(donnees.reduce((sum, item) => sum + item.quantite_totale_grammes, 0))}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {formatMontant(donnees.reduce((sum, item) => sum + item.montant_total_brut, 0))} FCFA
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-red-600">
                          {formatMontant(donnees.reduce((sum, item) => sum + item.montant_total_taxes, 0))} FCFA
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-emerald-600">
                          {formatMontant(donnees.reduce((sum, item) => sum + item.montant_total_net, 0))} FCFA
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            )}

            {typeRapport === 'artisan' && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  Chiffre d'Affaires par Artisan (Top 20)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">N° Carte</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Nom Complet</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Région</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Ventes</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Quantité (g)</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">CA Brut</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">CA Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {donnees.map((item, index) => (
                        <tr key={item.artisan_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.numero_carte}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.nom_complet}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.region}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">{item.nombre_ventes}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {formatMontant(item.quantite_totale_grammes)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            {formatMontant(item.montant_total_brut)} FCFA
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-600">
                            {formatMontant(item.montant_total_net)} FCFA
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {(typeRapport === 'mensuel' || typeRapport === 'trimestriel' || typeRapport === 'annuel') && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Évolution du Chiffre d'Affaires
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={donnees}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="periode"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip formatter={(value: any) => formatMontant(value) + ' FCFA'} />
                    <Legend />
                    <Bar dataKey="montant_total_brut" fill="#B8860B" name="CA Brut" />
                    <Bar dataKey="montant_total_net" fill="#10B981" name="CA Net" />
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Période</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Ventes</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Artisans</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Quantité (g)</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">CA Brut</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">CA Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {donnees.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.periode}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">{item.nombre_ventes}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">{item.nombre_artisans_actifs}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {formatMontant(item.quantite_totale_grammes)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            {formatMontant(item.montant_total_brut)} FCFA
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-600">
                            {formatMontant(item.montant_total_net)} FCFA
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default RapportChiffreAffaires;
