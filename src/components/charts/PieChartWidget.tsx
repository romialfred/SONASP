import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from '@/lib/recharts';

export interface PieChartData {
  name: string;
  value: number;
}

export interface PieChartWidgetProps {
  data: PieChartData[];
  colors: string[];
  height?: number;
  showLegend?: boolean;
  innerRadius?: number;
}

export function PieChartWidget({
  data,
  colors,
  height = 300,
  showLegend = true,
  innerRadius = 0
}: PieChartWidgetProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          innerRadius={innerRadius}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((_entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '12px'
          }}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: '12px' }} />}
      </PieChart>
    </ResponsiveContainer>
  );
}
