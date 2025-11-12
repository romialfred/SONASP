import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card } from '@/components/ui/Card';
import { TrendingUp, Calendar } from 'lucide-react';
import { DailyProduction } from '@/services/dailyProductionService';

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
  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return 'N/A';
    const company = miningCompanies.find(c => c.id === companyId);
    return company?.name || 'Unknown';
  };

  const getCompanyColor = (index: number) => {
    const colors = [
      '#3b82f6', // blue
      '#10b981', // emerald
      '#f59e0b', // amber
      '#8b5cf6', // violet
      '#ec4899', // pink
      '#14b8a6', // teal
      '#f97316', // orange
      '#6366f1', // indigo
    ];
    return colors[index % colors.length];
  };

  let chartData: any[];
  let companyKeys: string[] = [];

  if (groupByCompany && miningCompanies.length > 0) {
    // Group data by date and company
    const groupedByDate = productions.reduce((acc, p) => {
      const date = new Date(p.production_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      if (!acc[date]) {
        acc[date] = { date, fullDate: p.production_date };
      }
      const companyName = getCompanyName(p.mining_company_id);
      acc[date][companyName] = (acc[date][companyName] || 0) + parseFloat(p.estimated_oz.toFixed(4));
      return acc;
    }, {} as Record<string, any>);

    chartData = Object.values(groupedByDate).sort((a, b) =>
      new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime()
    );

    // Get all unique company names
    companyKeys = miningCompanies.map(c => c.name);
  } else {
    // Original single-series data
    chartData = productions
      .sort((a, b) => new Date(a.production_date).getTime() - new Date(b.production_date).getTime())
      .map(p => ({
        date: new Date(p.production_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        fullDate: p.production_date,
        bullion: parseFloat(p.bullion_grams.toFixed(2)),
        pureGold: parseFloat(p.pure_gold_grams.toFixed(2)),
        oz: parseFloat(p.estimated_oz.toFixed(4)),
      }));
  }

  const totalOz = productions.reduce((sum, p) => sum + p.estimated_oz, 0);
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
          <p className="text-sm text-gray-600 mt-1">
            {groupByCompany ? 'Production by Mining Company (Ounces)' : 'Last 30 Days Daily Production (Ounces)'}
          </p>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 12 }}
                label={{ value: 'Ounces (oz)', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                labelStyle={{ color: '#111827', fontWeight: 600 }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    oz: 'Estimated Oz',
                    pureGold: 'Pure Gold (g)',
                    bullion: 'Bullion (g)'
                  };
                  return [value.toFixed(4), labels[name] || name];
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    oz: 'Estimated Oz',
                    pureGold: 'Pure Gold (g)',
                    bullion: 'Bullion (g)'
                  };
                  return labels[value] || value;
                }}
              />
              {groupByCompany ? (
                companyKeys.map((companyName, index) => (
                  <Bar
                    key={companyName}
                    dataKey={companyName}
                    fill={getCompanyColor(index)}
                    radius={[8, 8, 0, 0]}
                    name={companyName}
                  />
                ))
              ) : (
                <Bar
                  dataKey="oz"
                  fill="#3b82f6"
                  radius={[8, 8, 0, 0]}
                  name="oz"
                />
              )}
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-1">Total Production</p>
              <p className="text-lg font-bold text-blue-600">{totalOz.toFixed(2)} oz</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-1">Daily Average</p>
              <p className="text-lg font-bold text-emerald-600">{avgDaily.toFixed(2)} oz</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-1">Peak Day</p>
              <p className="text-lg font-bold text-purple-600">{maxOz.toFixed(2)} oz</p>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
