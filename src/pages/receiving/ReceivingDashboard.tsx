import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Package, AlertCircle, CheckCircle, Clock, Plane, TrendingUp } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

interface Site {
  name: string;
  site_type: string;
}

interface Batch {
  id: string;
  batch_number: string;
  status: string;
  weight_grams: number;
  weight_ounces: number;
  metal_type: string;
  shipping_date: string;
  comments?: string;
  created_at: string;
  current_site?: Site;
}

export function ReceivingDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    fetchBatches();
  }, []);

  async function fetchBatches() {
    setLoading(true);
    try {
      // Fetch ALL batches with their current site information
      const { data, error } = await supabase
        .from('batches')
        .select(`
          *,
          current_site:current_site_id(name, site_type)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching batches:', error);
      } else {
        // Filter batches that are at AIRPORT locations
        // Based on current_site containing "Airport" in the name
        const airportBatches = (data || []).filter(batch => {
          const siteName = batch.current_site?.name || '';
          return siteName.toLowerCase().includes('airport');
        });

        setBatches(airportBatches);
        console.log(`Found ${airportBatches.length} batches at airport locations`);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  // Count batches by status
  // In Transit: Pending status at airport (waiting to arrive)
  const inTransitCount = batches.filter(
    b => b.status?.toLowerCase() === 'pending'
  ).length;

  // At Airport: Received status (needs validation/confirmation)
  const atAirportCount = batches.filter(
    b => b.status?.toLowerCase() === 'received'
  ).length;

  // Processing: Currently being processed at airport
  const processingCount = batches.filter(
    b => b.status?.toLowerCase() === 'processing'
  ).length;

  const totalWeight = batches.reduce((sum, b) => sum + (b.weight_ounces || 0), 0);

  const metrics = [
    {
      title: 'Pending Arrival',
      value: inTransitCount.toString(),
      change: 'En route to airport',
      changeType: 'neutral' as const,
      icon: Plane,
      iconColor: 'text-blue-500',
    },
    {
      title: 'Need Validation',
      value: atAirportCount.toString(),
      change: 'Awaiting confirmation',
      changeType: 'neutral' as const,
      icon: AlertCircle,
      iconColor: 'text-orange-500',
    },
    {
      title: 'Processing',
      value: processingCount.toString(),
      change: 'Being processed',
      changeType: 'positive' as const,
      icon: CheckCircle,
      iconColor: 'text-green-500',
    },
    {
      title: 'Total Weight',
      value: `${totalWeight.toFixed(1)} oz`,
      change: 'All batches',
      changeType: 'positive' as const,
      icon: TrendingUp,
      iconColor: 'text-primary-500',
    },
  ];

  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    const statusConfig: Record<string, { label: string; color: string }> = {
      pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
      received: { label: 'Received', color: 'bg-orange-100 text-orange-800' },
      processing: { label: 'Processing', color: 'bg-blue-100 text-blue-800' },
      validated: { label: 'Validated', color: 'bg-green-100 text-green-800' },
    };

    const config = statusConfig[statusLower] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const handleConfirmReceipt = (batchId: string) => {
    navigate(`/receiving/confirm/${batchId}`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              Airport Receiving Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Track and validate shipments at airport locations
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loading size="lg" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {metrics.map((metric) => (
                <MetricCard key={metric.title} {...metric} />
              ))}
            </div>

            {batches.length === 0 ? (
              <Card>
                <CardContent>
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">No shipments at airport</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Batches at airport locations will appear here for validation
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Pending Arrival - In Transit */}
                {inTransitCount > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Plane className="w-5 h-5 text-blue-500" />
                        Pending Arrival ({inTransitCount})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {batches
                          .filter(b => b.status?.toLowerCase() === 'pending')
                          .map((batch) => (
                            <div
                              key={batch.id}
                              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <h3 className="font-semibold text-gray-900">
                                    {batch.batch_number}
                                  </h3>
                                  {getStatusBadge(batch.status)}
                                </div>
                                <div className="mt-2 text-sm text-gray-600">
                                  <p>
                                    Weight: {batch.weight_grams.toLocaleString()}g (
                                    {batch.weight_ounces.toFixed(2)} oz)
                                  </p>
                                  <p>Metal: {batch.metal_type}</p>
                                  <p>Location: {batch.current_site?.name}</p>
                                  <p>Shipped: {new Date(batch.shipping_date).toLocaleDateString()}</p>
                                </div>
                              </div>
                              <div className="text-sm text-gray-500">
                                <Clock className="w-5 h-5 inline mr-1" />
                                En route
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* At Airport - Need Validation */}
                {atAirportCount > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-500" />
                        Received - Need Validation ({atAirportCount})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {batches
                          .filter(b => b.status?.toLowerCase() === 'received')
                          .map((batch) => (
                            <div
                              key={batch.id}
                              className="flex items-center justify-between p-4 border border-orange-200 rounded-lg bg-orange-50"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <h3 className="font-semibold text-gray-900">
                                    {batch.batch_number}
                                  </h3>
                                  {getStatusBadge(batch.status)}
                                </div>
                                <div className="mt-2 text-sm text-gray-600">
                                  <p>
                                    Weight: {batch.weight_grams.toLocaleString()}g (
                                    {batch.weight_ounces.toFixed(2)} oz)
                                  </p>
                                  <p>Metal: {batch.metal_type}</p>
                                  <p>Location: {batch.current_site?.name}</p>
                                  {batch.comments && <p className="text-xs mt-1">{batch.comments}</p>}
                                </div>
                              </div>
                              <Button
                                variant="primary"
                                onClick={() => handleConfirmReceipt(batch.id)}
                              >
                                Validate Receipt
                              </Button>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Processing at Airport */}
                {processingCount > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        Processing ({processingCount})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {batches
                          .filter(b => b.status?.toLowerCase() === 'processing')
                          .map((batch) => (
                            <div
                              key={batch.id}
                              className="flex items-center justify-between p-4 border border-green-200 rounded-lg bg-green-50"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <h3 className="font-semibold text-gray-900">
                                    {batch.batch_number}
                                  </h3>
                                  {getStatusBadge(batch.status)}
                                </div>
                                <div className="mt-2 text-sm text-gray-600">
                                  <p>
                                    Weight: {batch.weight_grams.toLocaleString()}g (
                                    {batch.weight_ounces.toFixed(2)} oz)
                                  </p>
                                  <p>Metal: {batch.metal_type}</p>
                                  <p>Location: {batch.current_site?.name}</p>
                                </div>
                              </div>
                              <div className="text-sm text-green-600 font-medium">
                                <CheckCircle className="w-5 h-5 inline mr-1" />
                                Processing
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
