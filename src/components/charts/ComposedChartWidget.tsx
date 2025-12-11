import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface ComposedChartData {
  name: string;
  [key: string]: string | number;
}

export interface ComposedChartWidgetProps {
  data: ComposedChartData[];
  bars: {
    dataKey: string;
    color: string;
    name: string;
    yAxisId?: string;
  }[];
  lines: {
    dataKey: string;
    color: string;
    name: string;
    yAxisId?: string;
  }[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
}

export function ComposedChartWidget({
  data,
  bars,
  lines,
  height = 300,
  showGrid = false,
  showLegend = true
}: ComposedChartWidgetProps) {
  // Check if we have different yAxisIds
  const hasMultipleAxes = [...bars, ...lines].some(item => item.yAxisId === 'right');

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 5, right: hasMultipleAxes ? 60 : 20, left: 0, bottom: 5 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
        <XAxis
          dataKey="name"
          stroke="#6b7280"
          fontSize={12}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          stroke="#6b7280"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        {hasMultipleAxes && (
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
        )}
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '12px'
          }}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: '12px' }} />}
        {bars.map((bar) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            fill={bar.color}
            name={bar.name}
            yAxisId={bar.yAxisId || 'left'}
            radius={[4, 4, 0, 0]}
          />
        ))}
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            stroke={line.color}
            strokeWidth={2}
            name={line.name}
            yAxisId={line.yAxisId || 'left'}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
