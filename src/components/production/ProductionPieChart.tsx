import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card } from '@/components/ui/Card';
import { PieChartIcon } from 'lucide-react';
import { DailyProduction } from '@/services/dailyProductionService';

interface MiningCompany {
  id: string;
  name: string;
}

interface ProductionPieChartProps {
  productions: DailyProduction[];
  miningCompanies: MiningCompany[];
}

export function ProductionPieChart({ productions, miningCompanies }: ProductionPieChartProps) {
  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return 'N/A';
    const company = miningCompanies.find(c => c.id === companyId);
    return company?.name || 'Unknown';
  };

  const COLORS = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
    '#6366f1', // indigo
  ];

  // Aggregate data by company
  const companyData = productions.reduce((acc, p) => {
    const companyName = getCompanyName(p.mining_company_id);
    if (!acc[companyName]) {
      acc[companyName] = 0;
    }
    acc[companyName] += p.estimated_oz;
    return acc;
  }, {} as Record<string, number>);

  const totalOz = Object.values(companyData).reduce((sum, val) => sum + val, 0);

  const chartData = Object.entries(companyData).map(([name, value]) => ({
    name,
    value: parseFloat(value.toFixed(2)),
    percentage: ((value / totalOz) * 100).toFixed(1)
  })).sort((a, b) => b.value - a.value);

  const CustomLabel = ({ cx, cy }: any) => {
    return (
      <g>
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-gray-700 text-xl font-bold"
        >
          {totalOz.toFixed(2)} oz
        </text>
        <text
          x={cx}
          y={cy + 15}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-gray-500 text-xs"
        >
          Total Production
        </text>
      </g>
    );
  };

  const CustomLegend = (props: any) => {
    const { payload } = props;
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload.map((entry: any, index: number) => {
          const dataItem = chartData.find(d => d.name === entry.value);
          return (
            <div key={`legend-${index}`} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-gray-700">
                <span className="font-semibold">{entry.value}</span>
                <span className="text-gray-500 ml-1">
                  {dataItem?.value.toFixed(2)} oz ({dataItem?.percentage}%)
                </span>
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900">{data.name}</p>
          <p className="text-sm text-gray-600 mt-1">
            Production: <span className="font-bold text-blue-600">{data.value} oz</span>
          </p>
          <p className="text-sm text-gray-600">
            Pourcentage: <span className="font-bold text-emerald-600">{data.payload.percentage}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <PieChartIcon className="w-5 h-5 text-blue-600" />
        <div>
          <h3 className="text-lg font-bold text-gray-900">Production par Société</h3>
          <p className="text-sm text-gray-600 mt-1">Répartition par société minière</p>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="h-96 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <PieChartIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>Aucune donnée de production disponible</p>
          </div>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={140}
                paddingAngle={2}
                dataKey="value"
                label={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="central"
              >
                <CustomLabel cx="50%" cy="50%" />
              </text>
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-6 grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-1">Total Production</p>
              <p className="text-lg font-bold text-blue-600">{totalOz.toFixed(2)} oz</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-1">Sociétés</p>
              <p className="text-lg font-bold text-emerald-600">{chartData.length}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-1">Plus Productive</p>
              <p className="text-sm font-bold text-purple-600">
                {chartData[0]?.name}
                <span className="block text-xs text-gray-600 font-normal mt-0.5">
                  {chartData[0]?.value.toFixed(2)} oz
                </span>
              </p>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
