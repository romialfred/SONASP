import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { BarChart, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { analyzeFxTransaction, FxAnalysisResult } from '@/services/fxAnalysisService';

export function FxAnalysisTab() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [startDate, setStartDate] = useState('2024-08-01');
  const [endDate, setEndDate] = useState('2024-10-31');
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<FxAnalysisResult[]>([]);
  const [summary, setSummary] = useState<{
    totalTransactions: number;
    totalUsdPaid: number;
    totalEurReceived: number;
    totalOpportunityCost: number;
    avgSpreadVsEcb: number;
    avgSpreadVsRevolut: number;
    bestPerformer: string;
  } | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    // Auto-load analysis when customer is selected (only on initial load)
    if (selectedCustomer && startDate && endDate && !initialLoadDone) {
      setInitialLoadDone(true);
      runAnalysis();
    }
  }, [selectedCustomer, initialLoadDone]);

  const loadCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, email')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setCustomers(data);
      if (data.length > 0) {
        setSelectedCustomer(data[0].id);
      }
    }
  };

  const runAnalysis = async () => {
    if (!selectedCustomer || !startDate || !endDate) {
      alert('Please select a customer and date range');
      return;
    }

    setLoading(true);
    try {
      const result = await analyzeFxTransaction(selectedCustomer, startDate, endDate);

      if (result.success && result.data) {
        setAnalysisResults(result.data);
        calculateSummary(result.data);
      } else {
        alert('Error analyzing transactions: ' + (result.error?.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (results: FxAnalysisResult[]) => {
    if (results.length === 0) {
      setSummary(null);
      return;
    }

    const totalTransactions = results.length;
    const totalUsdPaid = results.reduce((sum, r) => sum + r.usdPaid, 0);
    const totalEurReceived = results.reduce((sum, r) => sum + r.eurReceived, 0);
    const totalOpportunityCost = results.reduce((sum, r) => sum + r.opportunityCost, 0);
    const avgSpreadVsEcb = results.reduce((sum, r) => sum + r.spreadVsEcb, 0) / totalTransactions;
    const avgSpreadVsRevolut = results.reduce((sum, r) => sum + r.spreadVsRevolut, 0) / totalTransactions;

    // Find best performer
    const sourceCounts = results.reduce((acc, r) => {
      acc[r.bestSource] = (acc[r.bestSource] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bestPerformer = Object.entries(sourceCounts).reduce((a, b) =>
      a[1] > b[1] ? a : b
    )[0];

    setSummary({
      totalTransactions,
      totalUsdPaid,
      totalEurReceived,
      totalOpportunityCost,
      avgSpreadVsEcb,
      avgSpreadVsRevolut,
      bestPerformer,
    });
  };

  const formatCurrency = (amount: number, decimals: number = 2) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(3)}%`;
  };

  const getPerformanceColor = (opportunityCost: number) => {
    if (opportunityCost > 0) return 'text-red-600';
    if (opportunityCost < -100) return 'text-green-600';
    return 'text-gray-600';
  };

  const getPerformanceIcon = (opportunityCost: number) => {
    if (opportunityCost > 1000) return <AlertTriangle className="w-5 h-5 text-red-600" />;
    if (opportunityCost < -100) return <CheckCircle className="w-5 h-5 text-green-600" />;
    return <TrendingDown className="w-5 h-5 text-gray-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="w-5 h-5" />
            FX Rate Analysis - Compare Customer Rates with Market
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <FormField label="Select Customer" required>
              <Select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
              >
                <option value="">Choose customer...</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Start Date" required>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </FormField>

            <FormField label="End Date" required>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </FormField>

            <FormField label="Action" className="flex items-end">
              <Button onClick={runAnalysis} disabled={loading} className="w-full">
                <Search className="w-4 h-4 mr-2" />
                {loading ? 'Analyzing...' : 'Run Analysis'}
              </Button>
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600 mb-1">Total Transactions</div>
              <div className="text-2xl font-bold text-gray-900">{summary.totalTransactions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600 mb-1">Total USD Paid</div>
              <div className="text-2xl font-bold text-gray-900">
                ${formatCurrency(summary.totalUsdPaid)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600 mb-1">Total EUR Received</div>
              <div className="text-2xl font-bold text-gray-900">
                €{formatCurrency(summary.totalEurReceived)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600 mb-1">Total Opportunity Cost</div>
              <div className={`text-2xl font-bold ${getPerformanceColor(summary.totalOpportunityCost)}`}>
                €{formatCurrency(summary.totalOpportunityCost)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {summary.totalOpportunityCost > 0 ? 'Lost' : 'Saved'}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analysis Results Table */}
      {analysisResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed Transaction Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {analysisResults.map((result, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  {/* Transaction Header */}
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {new Date(result.transactionDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </h3>
                      <p className="text-sm text-gray-600">{result.customerName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getPerformanceIcon(result.opportunityCost)}
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          Best: {result.bestSource.toUpperCase()}
                        </div>
                        <div className={`text-xs ${getPerformanceColor(result.opportunityCost)}`}>
                          {result.opportunityCost > 0 ? 'Lost' : 'Saved'} €
                          {formatCurrency(Math.abs(result.opportunityCost))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rate Comparison Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Metric
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Customer Rate
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            ECB Spot
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Revolut
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        <tr>
                          <td className="px-4 py-3 font-medium text-gray-900">USD Paid</td>
                          <td className="px-4 py-3 text-right" colSpan={3}>
                            ${formatCurrency(result.usdPaid)}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-gray-900">Exchange Rate (EUR/USD)</td>
                          <td className="px-4 py-3 text-right font-semibold text-blue-600">
                            {result.customerRate.toFixed(4)}
                          </td>
                          <td className="px-4 py-3 text-right">{result.ecbSpotRate.toFixed(4)}</td>
                          <td className="px-4 py-3 text-right">{result.revolutRate.toFixed(4)}</td>
                        </tr>
                        <tr className="bg-yellow-50">
                          <td className="px-4 py-3 font-medium text-gray-900">EUR Received/Would Receive</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900">
                            €{formatCurrency(result.eurReceived)}
                          </td>
                          <td className="px-4 py-3 text-right">€{formatCurrency(result.eurIfEcb)}</td>
                          <td className="px-4 py-3 text-right">€{formatCurrency(result.eurIfRevolut)}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-gray-900">Difference vs Customer (EUR)</td>
                          <td className="px-4 py-3 text-right text-gray-400">-</td>
                          <td className={`px-4 py-3 text-right font-semibold ${
                            result.diffVsEcb > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {result.diffVsEcb > 0 ? '+' : ''}
                            {formatCurrency(result.diffVsEcb)}
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${
                            result.diffVsRevolut > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {result.diffVsRevolut > 0 ? '+' : ''}
                            {formatCurrency(result.diffVsRevolut)}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-gray-900">Spread (%)</td>
                          <td className="px-4 py-3 text-right text-gray-400">-</td>
                          <td className={`px-4 py-3 text-right ${
                            result.spreadVsEcb > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatPercent(result.spreadVsEcb)}
                          </td>
                          <td className={`px-4 py-3 text-right ${
                            result.spreadVsRevolut > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatPercent(result.spreadVsRevolut)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Commentary */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Analysis Commentary
                    </h4>
                    <p className="text-sm text-blue-800 whitespace-pre-line">{result.commentary}</p>
                  </div>

                  {/* Recommendation */}
                  <div
                    className={`border rounded-lg p-4 ${
                      result.opportunityCost > 1000
                        ? 'bg-red-50 border-red-200'
                        : result.opportunityCost > 0
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-green-50 border-green-200'
                    }`}
                  >
                    <h4
                      className={`text-sm font-semibold mb-2 flex items-center gap-2 ${
                        result.opportunityCost > 1000
                          ? 'text-red-900'
                          : result.opportunityCost > 0
                          ? 'text-yellow-900'
                          : 'text-green-900'
                      }`}
                    >
                      {result.opportunityCost > 1000 ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Strategic Recommendation
                    </h4>
                    <p
                      className={`text-sm whitespace-pre-line ${
                        result.opportunityCost > 1000
                          ? 'text-red-800'
                          : result.opportunityCost > 0
                          ? 'text-yellow-800'
                          : 'text-green-800'
                      }`}
                    >
                      {result.recommendation}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results Message */}
      {!loading && analysisResults.length === 0 && initialLoadDone && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              No transactions found for the selected customer and date range.
              <br />
              Try selecting a different customer or adjusting the date range.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Initial Loading State */}
      {loading && !initialLoadDone && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
              <p className="text-gray-500">Loading FX analysis data...</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
