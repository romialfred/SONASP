import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { ArrowLeft, Download, Scale } from 'lucide-react';
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
  PieChart,
  Pie,
  Cell
} from 'recharts';

const COLORS = ['#B8860B', '#475569', '#10B981', '#3B82F6', '#EF4444', '#F59E0B'];

const RapportQuantites = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [donnees, setDonnees] = useState<any[]>([]);
  const [dateDebut, setDateDebut] = useState<string>(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  );
  const [dateFin, setDateFin] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    chargerDonnees();
  }, [dateDebut, dateFin]);

  const chargerDonnees = async () => {
    try {
      setLoading(true);
      const quantites = await artisanAnalyticsService.getQuantiteParType(dateDebut, dateFin);
      setDonnees(quantites);
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const exporterRapport = async () => {
    try {
      const blob = await artisanAnalyticsService.exporterRapportExcel(
        `Quantites_${dateDebut}_${dateFin}`,
        donnees
      );

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rapport_quantites_${dateDebut}_${dateFin}.xlsx`;
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
      nombre_ventes: acc.nombre_ventes + item.nombre_ventes,
      quantite_totale_grammes: acc.quantite_totale_grammes + item.quantite_totale_grammes,
      quantite_totale_onces: acc.quantite_totale_onces + item.quantite_totale_onces,
      montant_total: acc.montant_total + item.montant_total
    }),
    { nombre_ventes: 0, quantite_totale_grammes: 0, quantite_totale_onces: 0, montant_total: 0 }
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
              <h1 className="text-3xl font-bold text-gray-900">Rapport Quantités d'Or</h1>
              <p className="text-gray-600 mt-1">Analyse des quantités par type d'or</p>
            </div>
          </div>
          <Button onClick={exporterRapport}>
            <Download className="w-4 h-4 mr-2" />
            Exporter Excel
          </Button>
        </div>

        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="p-6 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-600">Total Ventes</p>
                    <p className="text-3xl font-bold text-amber-900 mt-1">{totaux.nombre_ventes}</p>
                  </div>
                  <Scale className="w-10 h-10 text-amber-500" />
                </div>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-yellow-600">Quantité (grammes)</p>
                    <p className="text-2xl font-bold text-yellow-900 mt-1">
                      {formatMontant(totaux.quantite_totale_grammes)} g
                    </p>
                  </div>
                  <Scale className="w-10 h-10 text-yellow-500" />
                </div>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600">Quantité (onces)</p>
                    <p className="text-2xl font-bold text-orange-900 mt-1">
                      {totaux.quantite_totale_onces.toFixed(2)} oz
                    </p>
                  </div>
                  <Scale className="w-10 h-10 text-orange-500" />
                </div>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-600">Valeur Totale</p>
                    <p className="text-xl font-bold text-emerald-900 mt-1">
                      {formatMontant(totaux.montant_total)} FCFA
                    </p>
                  </div>
                  <Scale className="w-10 h-10 text-emerald-500" />
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Répartition par Type (Grammes)</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={donnees}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.type_or} (${entry.pourcentage_total.toFixed(1)}%)`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="quantite_totale_grammes"
                    >
                      {donnees.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatMontant(value) + ' g'} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparaison Quantités par Type</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={donnees}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type_or" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip formatter={(value: any) => formatMontant(value)} />
                    <Legend />
                    <Bar dataKey="quantite_totale_grammes" fill="#B8860B" name="Quantité (g)" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-600" />
                Détail par Type d'Or
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Type d'Or</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Ventes</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Quantité (g)</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Quantité (oz)</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Montant Total</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Prix Moyen/g</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">% Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {donnees.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="text-sm font-medium text-gray-900">{item.type_or}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">{item.nombre_ventes}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                          {formatMontant(item.quantite_totale_grammes)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                          {item.quantite_totale_onces.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-600">
                          {formatMontant(item.montant_total)} FCFA
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                          {formatMontant(item.prix_moyen_gramme)} FCFA
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {item.pourcentage_total.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 font-semibold">
                    <tr>
                      <td className="px-4 py-3 text-sm">TOTAL</td>
                      <td className="px-4 py-3 text-sm text-right">{totaux.nombre_ventes}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatMontant(totaux.quantite_totale_grammes)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {totaux.quantite_totale_onces.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-emerald-600">
                        {formatMontant(totaux.montant_total)} FCFA
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatMontant(totaux.montant_total / totaux.quantite_totale_grammes)} FCFA
                      </td>
                      <td className="px-4 py-3 text-sm text-right">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default RapportQuantites;
