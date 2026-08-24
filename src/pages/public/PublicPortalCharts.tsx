import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@/lib/recharts';

const portalTrend = [
  { month: 'Mars', production: 2.4, expeditions: 1.9 },
  { month: 'Avr.', production: 2.8, expeditions: 2.2 },
  { month: 'Mai', production: 2.5, expeditions: 2.4 },
  { month: 'Juin', production: 3.3, expeditions: 2.8 },
  { month: 'Juil.', production: 3.1, expeditions: 2.9 },
  { month: 'Août', production: 4.3, expeditions: 3.7 },
];

const portalOperations = [
  { label: 'Déclarées', value: 34 },
  { label: 'Planifiées', value: 28 },
  { label: 'Expédiées', value: 23 },
  { label: 'Validées', value: 19 },
];

export default function PublicPortalCharts({ compact }: { compact: boolean }) {
  return (
    <div className="portal-preview__charts">
      <div className="portal-preview__chart-card portal-preview__chart-card--trend">
        <div className="portal-preview__chart-head">
          <div><strong>Flux mensuels</strong><span>Tonnes déclarées et expédiées</span></div>
          <span className="portal-preview__chart-change">+18,6 %</span>
        </div>
        <div className="portal-preview__chart-canvas" role="img" aria-label="Évolution mensuelle de la production et des expéditions de mars à août">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 460, height: 142 }}>
            <AreaChart data={portalTrend} margin={{ top: 8, right: 6, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id={`productionFill-${compact ? 'section' : 'hero'}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#08764b" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#08764b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e8eee9" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#73817b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#8a9691' }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #dce5df', fontSize: 11 }} />
              <Area type="monotone" dataKey="production" stroke="#08764b" strokeWidth={2} fill={`url(#productionFill-${compact ? 'section' : 'hero'})`} />
              <Area type="monotone" dataKey="expeditions" stroke="#c99116" strokeWidth={2} fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="portal-preview__legend"><i />Production <i />Expéditions</div>
      </div>
      {compact && (
        <div className="portal-preview__chart-card portal-preview__chart-card--operations">
          <div className="portal-preview__chart-head"><div><strong>Opérations</strong><span>État du traitement</span></div></div>
          <div className="portal-preview__chart-canvas" role="img" aria-label="34 opérations déclarées, 28 planifiées, 23 expédiées et 19 validées">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 220, height: 142 }}>
              <BarChart data={portalOperations} layout="vertical" margin={{ top: 4, right: 8, left: 2, bottom: 0 }}>
                <CartesianGrid stroke="#edf1ee" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} width={62} tick={{ fontSize: 9, fill: '#66746e' }} />
                <Tooltip cursor={{ fill: '#f4f7f4' }} contentStyle={{ borderRadius: 8, border: '1px solid #dce5df', fontSize: 11 }} />
                <Bar dataKey="value" fill="#c99116" radius={[0, 5, 5, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
