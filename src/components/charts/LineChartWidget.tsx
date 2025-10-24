import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface LineChartData {
  name: string;
  [key: string]: string | number;
}

export interface LineChartWidgetProps {
  data: LineChartData[];
  lines: {
    dataKey: string;
    color: string;
    name: string;
  }[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
}

export function LineChartWidget({
  data,
  lines,
  height = 300,
  showGrid = true,
  showLegend = true
}: LineChartWidgetProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
        <XAxis
          dataKey="name"
          stroke="#6b7280"
          fontSize={12}
          tickLine={false}
        />
        <YAxis
          stroke="#6b7280"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '12px'
          }}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: '12px' }} />}
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            stroke={line.color}
            strokeWidth={2}
            name={line.name}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
