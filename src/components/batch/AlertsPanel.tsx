import { AlertTriangle, AlertCircle, Info, XCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface BatchAlert {
  id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  triggered_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
}

interface AlertsPanelProps {
  alerts: BatchAlert[];
  onAcknowledge?: (alertId: string) => void;
  onResolve?: (alertId: string) => void;
}

export function AlertsPanel({ alerts, onAcknowledge, onResolve }: AlertsPanelProps) {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'high':
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case 'medium':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'low':
        return <Info className="h-5 w-5 text-blue-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-300 bg-red-50';
      case 'high':
        return 'border-orange-300 bg-orange-50';
      case 'medium':
        return 'border-yellow-300 bg-yellow-50';
      case 'low':
        return 'border-blue-300 bg-blue-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  const getAlertTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      variance: 'Variance',
      delay: 'Delay',
      quality: 'Quality Issue',
      security: 'Security',
      customs: 'Customs',
      approval_pending: 'Approval Pending',
      system: 'System',
    };
    return labels[type] || type;
  };

  const activeAlerts = alerts.filter(a => !a.resolved_at);
  const resolvedAlerts = alerts.filter(a => a.resolved_at);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Alerts
          {activeAlerts.length > 0 && (
            <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
              {activeAlerts.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-400" />
            <p>No alerts</p>
            <p className="text-sm">Everything looks good</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeAlerts.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">Active Alerts</p>
                {activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`border-l-4 p-4 rounded-r-lg ${getSeverityColor(alert.severity)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getSeverityIcon(alert.severity)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900 uppercase">
                              {getAlertTypeLabel(alert.alert_type)}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              alert.severity === 'critical' ? 'bg-red-600 text-white' :
                              alert.severity === 'high' ? 'bg-orange-600 text-white' :
                              alert.severity === 'medium' ? 'bg-yellow-600 text-white' :
                              'bg-blue-600 text-white'
                            }`}>
                              {alert.severity}
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 mb-2">{alert.message}</p>
                          <p className="text-xs text-gray-600">
                            Triggered {new Date(alert.triggered_at).toLocaleString()}
                          </p>
                          {alert.acknowledged_at && (
                            <p className="text-xs text-green-600 mt-1">
                              ✓ Acknowledged {new Date(alert.acknowledged_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        {!alert.acknowledged_at && onAcknowledge && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onAcknowledge(alert.id)}
                          >
                            Acknowledge
                          </Button>
                        )}
                        {onResolve && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => onResolve(alert.id)}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {resolvedAlerts.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">Resolved Alerts</p>
                {resolvedAlerts.slice(0, 3).map((alert) => (
                  <div
                    key={alert.id}
                    className="border-l-4 border-gray-300 bg-gray-50 p-4 rounded-r-lg opacity-60"
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-700 uppercase">
                            {getAlertTypeLabel(alert.alert_type)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
                        <p className="text-xs text-gray-600">
                          Resolved {new Date(alert.resolved_at!).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {resolvedAlerts.length > 3 && (
                  <p className="text-xs text-gray-500 text-center">
                    + {resolvedAlerts.length - 3} more resolved alerts
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
