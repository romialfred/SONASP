import { PALETTE_PRODUCTION } from './chartPalette';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from '@/lib/recharts';
import { Card } from '@/components/ui/Card';
import { TrendingUp, Calendar } from 'lucide-react';
import { DailyProduction } from '@/services/dailyProductionService';
import { ProductionPieChart } from './ProductionPieChart';
import { MonthlyProductionBarChart } from './MonthlyProductionBarChart';

interface MiningCompany {
  id: string;
  name: string;
}

interface ProductionChartProps {
  productions: DailyProduction[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
  groupByCompany?: boolean;
  miningCompanies?: MiningCompany[];
}

export function ProductionChart({ productions, groupByCompany = false, miningCompanies = [] }: ProductionChartProps) {
  // Si groupByCompany est true, afficher le Pie Chart ET le Bar Chart côte à côte
  if (groupByCompany && miningCompanies.length > 0) {
    // Calculer les données mensuelles
    const monthlyMap = new Map<string, { total_oz: number; monthNum: number; year: number }>();

    productions.forEach(prod => {
      const date = new Date(prod.production_date);
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-11
      const monthKey = `${year}-${month}`;

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { total_oz: 0, monthNum: month, year });
      }

      const current = monthlyMap.get(monthKey)!;
      current.total_oz += prod.estimated_oz || 0;
    });

    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

    const monthlyData = Array.from(monthlyMap.entries())
      .map(([, value]) => ({
        month: `${monthNames[value.monthNum]} ${value.year}`,
        total_oz: value.total_oz,
        monthNum: value.year * 12 + value.monthNum
      }))
      .sort((a, b) => a.monthNum - b.monthNum);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProductionPieChart productions={productions} miningCompanies={miningCompanies} />
        <MonthlyProductionBarChart data={monthlyData} />
      </div>
    );
  }
  // Chart data pour une seule société
  const chartData = productions
    .sort((a, b) => new Date(a.production_date).getTime() - new Date(b.production_date).getTime())
    .map(p => ({
      date: new Date(p.production_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      fullDate: p.production_date,
      bullion: parseFloat(p.bullion_grams.toFixed(2)),
      pureGold: parseFloat((p.pure_gold_grams ?? 0).toFixed(2)),
      oz: parseFloat((p.estimated_oz ?? 0).toFixed(4)),
    }));

  const totalOz = productions.reduce((sum, p) => sum + (p.estimated_oz ?? 0), 0);
  const avgDaily = chartData.length > 0 ? totalOz / chartData.length : 0;
  const maxOz = Math.max(...chartData.map(d => d.oz));

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900">Production Trends</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">Daily Production (Ounces)</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>{chartData.length} days</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Avg: <span className="font-semibold text-blue-600">{avgDaily.toFixed(2)} oz/day</span>
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="h-80 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>Aucune donnée de production disponible</p>
          </div>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 12 }}
                label={{ value: 'Onces troy', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                labelStyle={{ color: '#111827', fontWeight: 600 }}
                formatter={(value, name) => {
                  const labels: Record<string, string> = {
                    oz: 'Onces troy',
                    pureGold: 'Or fin (g)',
                    bullion: 'Doré (g)'
                  };
                  const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
                  const seriesName = String(name ?? '');
                  return [
                    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 }).format(numericValue),
                    labels[seriesName] || seriesName,
                  ];
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    oz: 'Onces troy',
                    pureGold: 'Or fin (g)',
                    bullion: 'Doré (g)'
                  };
                  return labels[value] || value;
                }}
              />
              <Bar
                dataKey="oz"
                fill={PALETTE_PRODUCTION[0]}
                radius={[8, 8, 0, 0]}
                name="oz"
              />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-1">Production totale</p>
              <p className="text-lg font-bold text-slate-800">{totalOz.toFixed(2)} oz</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-1">Moyenne journalière</p>
              <p className="text-lg font-bold text-emerald-600">{avgDaily.toFixed(2)} oz</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-1">Meilleure journée</p>
              <p className="text-lg font-bold text-slate-800">{maxOz.toFixed(2)} oz</p>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
