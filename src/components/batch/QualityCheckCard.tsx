import { Shield, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface QualityCheck {
  id: string;
  check_type: string;
  purity_percentage?: number;
  appearance_grade?: string;
  passed: boolean;
  inspection_date: string;
  inspector?: {
    full_name: string;
  };
  notes?: string;
}

interface QualityCheckCardProps {
  checks: QualityCheck[];
  onAddCheck?: () => void;
}

export function QualityCheckCard({ checks, onAddCheck }: QualityCheckCardProps) {
  const getCheckTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      initial: 'Initial Inspection',
      intermediate: 'Intermediate Check',
      final: 'Final Inspection',
      random: 'Random Check',
      customs: 'Customs Inspection',
    };
    return labels[type] || type;
  };

  const getGradeColor = (grade?: string) => {
    switch (grade) {
      case 'A':
        return 'text-green-600 bg-green-100';
      case 'B':
        return 'text-yellow-600 bg-yellow-100';
      case 'C':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const latestCheck = checks[0];
  const passedChecks = checks.filter(c => c.passed).length;
  const passRate = checks.length > 0 ? (passedChecks / checks.length) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-600" />
            Quality Checks
          </CardTitle>
          {onAddCheck && (
            <button
              onClick={onAddCheck}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Add Check
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {checks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Shield className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p>No quality checks recorded</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Total Checks</p>
                <p className="text-2xl font-bold text-gray-900">{checks.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Passed</p>
                <p className="text-2xl font-bold text-green-600">{passedChecks}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Pass Rate</p>
                <p className="text-2xl font-bold text-primary-600">{passRate.toFixed(0)}%</p>
              </div>
            </div>

            {latestCheck && (
              <div className="p-4 border-2 border-primary-200 rounded-lg bg-primary-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {latestCheck.passed ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-semibold text-gray-900">
                      Latest: {getCheckTypeLabel(latestCheck.check_type)}
                    </span>
                  </div>
                  {latestCheck.appearance_grade && (
                    <span className={`px-2 py-1 rounded text-sm font-semibold ${getGradeColor(latestCheck.appearance_grade)}`}>
                      Grade {latestCheck.appearance_grade}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {latestCheck.purity_percentage && (
                    <div>
                      <span className="text-gray-600">Purity:</span>
                      <span className="ml-2 font-semibold">{latestCheck.purity_percentage}%</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600">Date:</span>
                    <span className="ml-2 font-semibold">
                      {new Date(latestCheck.inspection_date).toLocaleDateString()}
                    </span>
                  </div>
                  {latestCheck.inspector && (
                    <div className="col-span-2">
                      <span className="text-gray-600">Inspector:</span>
                      <span className="ml-2 font-semibold">{latestCheck.inspector.full_name}</span>
                    </div>
                  )}
                  {latestCheck.notes && (
                    <div className="col-span-2">
                      <span className="text-gray-600">Notes:</span>
                      <p className="mt-1 text-gray-900">{latestCheck.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700">Check History</p>
              {checks.slice(1).map((check) => (
                <div
                  key={check.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {check.passed ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {getCheckTypeLabel(check.check_type)}
                      </p>
                      <p className="text-xs text-gray-600">
                        {new Date(check.inspection_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {check.appearance_grade && (
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getGradeColor(check.appearance_grade)}`}>
                      {check.appearance_grade}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
