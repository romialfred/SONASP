import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { Select } from '@/components/ui/Select';
import { ArrowLeft, Download, Scale, FileText, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { artisanAnalyticsService } from '@/services/artisanAnalyticsService';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';

const RapportTaxesRoyalties = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [donnees, setDonnees] = useState<any[]>([]);
  const [groupBy, setGroupBy] = useState<'mois' | 'trimestre' | 'annee'>('mois');
  const [dateDebut, setDateDebut] = useState<string>(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  );
  const [dateFin, setDateFin] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    chargerDonnees();
  }, [dateDebut, dateFin, groupBy]);

  const chargerDonnees = async () => {
    try {
      setLoading(true);
      const taxes = await artisanAnalyticsService.getRapportTaxesRoyalties(dateDebut, dateFin, groupBy);
      setDonnees(taxes);
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const exporterRapport = async () => {
    try {
      const blob = await artisanAnalyticsService.exporterRapportExcel(
        `Taxes_${groupBy}_${dateDebut}_${dateFin}`,
        donnees
      );

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rapport_taxes_${groupBy}_${dateDebut}_${dateFin}.xlsx`;
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

  const totaux = donnees.reduce(
    (acc, item) => ({
      montant_total_ventes: acc.montant_total_ventes + item.montant_total_ventes,
      montant_total_tva: acc.montant_total_tva + item.montant_total_tva,
      montant_total_retenue_source: acc.montant_total_retenue_source + item.montant_total_retenue_source,
      montant_total_autres_taxes: acc.montant_total_autres_taxes + item.montant_total_autres_taxes,
      montant_total_taxes: acc.montant_total_taxes + item.montant_total_taxes,
      montant_total_royalties: acc.montant_total_royalties + item.montant_total_royalties,
      nombre_factures: acc.nombre_factures + item.nombre_factures
    }),
    {
      montant_total_ventes: 0,
      montant_total_tva: 0,
      montant_total_retenue_source: 0,
      montant_total_autres_taxes: 0,
      montant_total_taxes: 0,
      montant_total_royalties: 0,
      nombre_factures: 0
    }
  );

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={() => navigate('/artisan-minier/rapports')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Rapport Taxes & Royalties</h1>
              <p className="text-gray-600 mt-1">Analyse détaillée des taxes et royalties collectées</p>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Période</label>
              <Select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="w-full"
              >
                <option value="mois">Mensuel</option>
                <option value="trimestre">Trimestriel</option>
                <option value="annee">Annuel</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date début</label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date fin</label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loading size="lg" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">CA Total</p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">
                      {formatMontant(totaux.montant_total_ventes)} FCFA
                    </p>
                    <p className="text-xs text-blue-700 mt-1">{totaux.nombre_factures} factures</p>
                  </div>
                  <FileText className="w-10 h-10 text-blue-500" />
                </div>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-600">TVA (18%)</p>
                    <p className="text-2xl font-bold text-red-900 mt-1">
                      {formatMontant(totaux.montant_total_tva)} FCFA
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      {((totaux.montant_total_tva / totaux.montant_total_ventes) * 100).toFixed(2)}% du CA
                    </p>
                  </div>
                  <Scale className="w-10 h-10 text-red-500" />
                </div>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600">Retenue Source (1.5%)</p>
                    <p className="text-2xl font-bold text-orange-900 mt-1">
                      {formatMontant(totaux.montant_total_retenue_source)} FCFA
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      {((totaux.montant_total_retenue_source / totaux.montant_total_ventes) * 100).toFixed(2)}% du CA
                    </p>
                  </div>
                  <Scale className="w-10 h-10 text-orange-500" />
                </div>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">Royalties (3%)</p>
                    <p className="text-2xl font-bold text-purple-900 mt-1">
                      {formatMontant(totaux.montant_total_royalties)} FCFA
                    </p>
                    <p className="text-xs text-purple-700 mt-1">3% des taxes</p>
                  </div>
                  <TrendingUp className="w-10 h-10 text-purple-500" />
                </div>
              </Card>
            </div>

            <Card className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-600">Total Taxes Collectées</p>
                  <p className="text-3xl font-bold text-emerald-900 mt-1">
                    {formatMontant(totaux.montant_total_taxes)} FCFA
                  </p>
                  <p className="text-sm text-emerald-700 mt-2">
                    Taux de taxation effectif: {' '}
                    {((totaux.montant_total_taxes / totaux.montant_total_ventes) * 100).toFixed(2)}%
                  </p>
                </div>
                <Scale className="w-16 h-16 text-emerald-500" />
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Évolution des Taxes par Période</h3>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={donnees}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periode" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip formatter={(value: any) => formatMontant(value) + ' FCFA'} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="montant_total_tva"
                    stackId="1"
                    stroke="#EF4444"
                    fill="#EF4444"
                    name="TVA"
                  />
                  <Area
                    type="monotone"
                    dataKey="montant_total_retenue_source"
                    stackId="1"
                    stroke="#F59E0B"
                    fill="#F59E0B"
                    name="Retenue Source"
                  />
                  <Area
                    type="monotone"
                    dataKey="montant_total_royalties"
                    stackId="1"
                    stroke="#8B5CF6"
                    fill="#8B5CF6"
                    name="Royalties"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparaison CA vs Taxes</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={donnees}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="periode" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip formatter={(value: any) => formatMontant(value) + ' FCFA'} />
                    <Legend />
                    <Bar dataKey="montant_total_ventes" fill="#3B82F6" name="CA Total" />
                    <Bar dataKey="montant_total_taxes" fill="#EF4444" name="Taxes Totales" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Nombre de Factures par Période</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={donnees}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="periode" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="nombre_factures"
                      stroke="#10B981"
                      strokeWidth={2}
                      name="Nombre de Factures"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-600" />
                Détail par Période
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Période</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Factures</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">CA Total</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">TVA</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Retenue</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Autres</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Total Taxes</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Royalties</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {donnees.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.periode}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">{item.nombre_factures}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">
                          {formatMontant(item.montant_total_ventes)} FCFA
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-red-600">
                          {formatMontant(item.montant_total_tva)} FCFA
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-orange-600">
                          {formatMontant(item.montant_total_retenue_source)} FCFA
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                          {formatMontant(item.montant_total_autres_taxes)} FCFA
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                          {formatMontant(item.montant_total_taxes)} FCFA
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-purple-600">
                          {formatMontant(item.montant_total_royalties)} FCFA
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 font-semibold">
                    <tr>
                      <td className="px-4 py-3 text-sm">TOTAL</td>
                      <td className="px-4 py-3 text-sm text-right">{totaux.nombre_factures}</td>
                      <td className="px-4 py-3 text-sm text-right text-blue-600">
                        {formatMontant(totaux.montant_total_ventes)} FCFA
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">
                        {formatMontant(totaux.montant_total_tva)} FCFA
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-orange-600">
                        {formatMontant(totaux.montant_total_retenue_source)} FCFA
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatMontant(totaux.montant_total_autres_taxes)} FCFA
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatMontant(totaux.montant_total_taxes)} FCFA
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-purple-600">
                        {formatMontant(totaux.montant_total_royalties)} FCFA
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            <Card className="p-6 bg-blue-50 border-blue-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Récapitulatif Global</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Montants Totaux</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Chiffre d'affaires:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatMontant(totaux.montant_total_ventes)} FCFA
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">TVA collectée:</span>
                      <span className="text-sm font-semibold text-red-600">
                        {formatMontant(totaux.montant_total_tva)} FCFA
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Retenue à la source:</span>
                      <span className="text-sm font-semibold text-orange-600">
                        {formatMontant(totaux.montant_total_retenue_source)} FCFA
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-sm font-medium text-gray-700">Total taxes:</span>
                      <span className="text-sm font-bold text-gray-900">
                        {formatMontant(totaux.montant_total_taxes)} FCFA
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">Royalties (3%):</span>
                      <span className="text-sm font-bold text-purple-600">
                        {formatMontant(totaux.montant_total_royalties)} FCFA
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Taux Moyens</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Taux TVA moyen:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {((totaux.montant_total_tva / totaux.montant_total_ventes) * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Taux retenue moyen:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {((totaux.montant_total_retenue_source / totaux.montant_total_ventes) * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-sm font-medium text-gray-700">Taux taxation effectif:</span>
                      <span className="text-sm font-bold text-gray-900">
                        {((totaux.montant_total_taxes / totaux.montant_total_ventes) * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default RapportTaxesRoyalties;
