import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { TrafficLightIndicator } from '@/components/analytics/TrafficLightIndicator';
import { KPICard } from '@/components/analytics/KPICard';
import { DollarSign, TrendingUp, Target } from 'lucide-react';

export function SalesAnalytics() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TrafficLightIndicator
          status="warning"
          label="Sales Pipeline Health"
          value="78%"
          threshold="Target: >85%"
        />
        <TrafficLightIndicator
          status="good"
          label="Conversion Rate"
          value="64%"
          threshold="Target: >60%"
        />
        <TrafficLightIndicator
          status="good"
          label="Average Deal Velocity"
          value="18 days"
          threshold="Target: <21 days"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Pipeline Value"
          value="$2.4M"
          change={15}
          changeLabel="vs last quarter"
          icon={DollarSign}
          color="green"
        />
        <KPICard
          title="Win Rate"
          value="64%"
          change={8}
          changeLabel="vs last quarter"
          icon={Target}
          color="blue"
        />
        <KPICard
          title="Average Deal Size"
          value="$42K"
          change={5}
          changeLabel="vs last quarter"
          icon={TrendingUp}
          color="purple"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales Analytics - Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Full sales funnel analysis, win/loss tracking, and revenue forecasting will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
