import { PALETTE_PRODUCTION } from './chartPalette';
import { Card } from '@/components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from '@/lib/recharts';
import { Calendar } from 'lucide-react';

interface MonthlyData {
  month: string;
  total_oz: number;
  monthNum: number;
}

interface MonthlyProductionBarChartProps {
  data: MonthlyData[];
}

const COLORS = PALETTE_PRODUCTION;

export function MonthlyProductionBarChart({ data }: MonthlyProductionBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Production par Mois</h3>
              <p className="text-xs text-gray-600 mt-0.5">Évolution mensuelle de la production</p>
            </div>
          </div>
        </div>
        <div className="p-8 text-center text-sm text-gray-500">
          Aucune donnée disponible pour la période sélectionnée
        </div>
      </Card>
    );
  }

  const totalProduction = data.reduce((sum, d) => sum + d.total_oz, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white px-4 py-3 shadow-xl rounded-lg border border-gray-200">
          <p className="text-sm font-semibold text-gray-900 mb-1">{data.month}</p>
          <p className="text-lg font-bold text-blue-600">{data.total_oz.toFixed(2)} oz</p>
          <p className="text-xs text-gray-500 mt-1">
            {((data.total_oz / totalProduction) * 100).toFixed(1)}% du total
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Production par Mois</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Évolution mensuelle · {totalProduction.toFixed(2)} oz total
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Moyenne</p>
            <p className="text-sm font-bold text-blue-600">
              {(totalProduction / data.length).toFixed(2)} oz/mois
            </p>
          </div>
        </div>
      </div>
      <div className="p-6">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickFormatter={(value) => `${value.toFixed(0)} oz`}
            />
            <YAxis
              dataKey="month"
              type="category"
              tick={{ fontSize: 12, fill: '#1e293b', fontWeight: 600 }}
              width={75}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} />
            <Bar
              dataKey="total_oz"
              radius={[0, 8, 8, 0]}
              maxBarSize={35}
            >
              {data.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  opacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-center gap-6 flex-wrap">
            {data.slice(0, 6).map((item, index) => (
              <div key={item.month} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-xs font-medium text-gray-700">{item.month}</span>
              </div>
            ))}
            {data.length > 6 && (
              <span className="text-xs text-gray-500">+{data.length - 6} autres</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
