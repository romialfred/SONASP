import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface AreaChartData {
  name: string;
  [key: string]: string | number;
}

export interface AreaChartWidgetProps {
  data: AreaChartData[];
  areas: {
    dataKey: string;
    color: string;
    name: string;
  }[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
}

export function AreaChartWidget({
  data,
  areas,
  height = 300,
  showGrid = true,
  showLegend = true
}: AreaChartWidgetProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
        {areas.map((area) => (
          <Area
            key={area.dataKey}
            type="monotone"
            dataKey={area.dataKey}
            stroke={area.color}
            fill={area.color}
            fillOpacity={0.6}
            name={area.name}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
