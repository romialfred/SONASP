import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Loading } from '@/components/ui/Loading';
import { LiveGoldMarketPanel } from '@/components/sales/LiveGoldMarketPanel';
import { PricingCalculator } from '@/components/sales/PricingCalculator';
import { FinancialComparison } from '@/components/sales/FinancialComparison';
import {
  Store,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Lightbulb,
} from 'lucide-react';
import {
  calculatePricingComparison,
  getQuantityRecommendation,
  getApprovedRefineries,
  createGoldSale,
  type PricingMechanism,
  type QuantityRecommendation,
} from '@/services/goldTradeSpaceService';
import { supabase } from '@/lib/supabase';
import { useAlert } from '@/hooks/useAlert';

interface Customer {
  id: string;
  name: string;
  email: string;
  country: string;
}

interface InventoryItem {
  id: string;
  quantity_available_oz: number;
}

export function GoldTradeSpace() {
  const { showSuccess, showError } = useAlert();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [refineries, setRefineries] = useState<any[]>([]);

  const [availableStock, setAvailableStock] = useState(0);
  const [quantityRecommendation, setQuantityRecommendation] = useState<QuantityRecommendation | null>(null);

  const [selectedMechanism, setSelectedMechanism] = useState<PricingMechanism | null>(null);
  const [comparisonData, setComparisonData] = useState<any>(null);

  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedRefinery, setSelectedRefinery] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');

  const [loading, setLoading] = useState(true);
  const [processingOrder, setProcessingOrder] = useState(false);

  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [customersRes, inventoryRes, refineriesRes] = await Promise.all([
        supabase.from('customers').select('id, name, email, country').order('name'),
        supabase.from('gold_inventory').select('id, quantity_available_oz').gt('quantity_available_oz', 0),
        getApprovedRefineries(),
      ]);

      if (customersRes.data) {
        setCustomers(customersRes.data);
      }

      if (inventoryRes.data) {
        setInventory(inventoryRes.data);
        const totalStock = inventoryRes.data.reduce((sum, item) => sum + item.quantity_available_oz, 0);
        setAvailableStock(totalStock);

        if (totalStock > 0) {
          const recResult = await getQuantityRecommendation(totalStock);
          if (recResult.success && recResult.data) {
            setQuantityRecommendation(recResult.data);
          }
        }
      }

      if (refineriesRes.success && refineriesRes.data) {
        setRefineries(refineriesRes.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showError('Failed to load marketplace data');
    } finally {
      setLoading(false);
    }
  };

  const handleMechanismSelect = (mechanism: PricingMechanism) => {
    setSelectedMechanism(mechanism);
  };

  const handleCreateSale = async () => {
    if (!selectedMechanism || !selectedCustomer || !comparisonData) {
      showError('Please select a pricing mechanism and customer');
      return;
    }

    setProcessingOrder(true);
    try {
      const pricingType =
        selectedMechanism.mechanism === 'spot'
          ? 'spot'
          : selectedMechanism.mechanism === 'in_process'
          ? 'in_process'
          : 'forward';

      const forwardDays =
        selectedMechanism.mechanism === 'forward_7d'
          ? 7
          : selectedMechanism.mechanism === 'forward_14d'
          ? 14
          : selectedMechanism.mechanism === 'forward_30d'
          ? 30
          : undefined;

      const result = await createGoldSale({
        customerId: selectedCustomer,
        quantityOz: comparisonData.quantityOz,
        pricingMechanism: pricingType,
        forwardDays,
        refineryId: selectedRefinery || undefined,
        batchId: selectedBatch || undefined,
      });

      if (result.success) {
        showSuccess('Gold sale order created successfully!');
        setSelectedMechanism(null);
        setComparisonData(null);
        setSelectedCustomer('');
        fetchInitialData();
      } else {
        showError(result.error || 'Failed to create sale order');
      }
    } catch (error) {
      console.error('Error creating sale:', error);
      showError('An error occurred while creating the sale');
    } finally {
      setProcessingOrder(false);
    }
  };

  const handleCalculationComplete = (comparison: any) => {
    setComparisonData(comparison);
  };

  if (loading) {
    return (
      <MainLayout>
        <Loading />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Store className="w-8 h-8 text-amber-600" />
              Gold Trade Space
            </h1>
            <p className="text-gray-600 mt-1">
              Marketplace with intelligent pricing mechanisms and financial analysis
            </p>
          </div>
        </div>

        {/* Live Gold Market Panel - Fixed Right Side */}
        <LiveGoldMarketPanel onCollapseChange={setIsPanelCollapsed} />

        {/* Main Content Area - Adjusts based on panel state */}
        <div
          className={`space-y-6 transition-all duration-300 ${
            isPanelCollapsed ? 'mr-0 max-w-full' : 'mr-96 max-w-5xl'
          }`}
        >
          {quantityRecommendation && (
            <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
              <div className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-6 h-6 text-purple-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg">AI-Powered Quantity Recommendation</h3>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Recommended Quantity:</span>
                        <span className="text-xl font-bold text-purple-900">
                          {quantityRecommendation.recommendedQuantityOz.toFixed(2)} oz
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Percentage of Stock:</span>
                        <span className="font-semibold text-purple-800">
                          {quantityRecommendation.recommendedPercentage}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          quantityRecommendation.riskLevel === 'low'
                            ? 'bg-green-100 text-green-800'
                            : quantityRecommendation.riskLevel === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {quantityRecommendation.riskLevel.toUpperCase()} RISK
                        </span>
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                          {quantityRecommendation.confidenceScore}% Confidence
                        </span>
                      </div>
                      </div>
                      <p className="text-sm text-gray-700 mt-3 leading-relaxed">
                      {quantityRecommendation.reasoning}
                      </p>
                      <div className="text-xs text-gray-600 mt-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      <span><strong>Optimal Timing:</strong> {quantityRecommendation.optimalTiming}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <PricingCalculator
              availableStockOz={availableStock}
              onMechanismSelect={(mechanism, comparison) => {
                handleMechanismSelect(mechanism);
                handleCalculationComplete(comparison);
              }}
            />

            {comparisonData && comparisonData.mechanisms && (
              <FinancialComparison
                mechanisms={comparisonData.mechanisms}
                recommendedMechanism={comparisonData.recommendedMechanism}
              />
            )}

            {selectedMechanism && comparisonData && (
              <Card className="border-blue-500 border-2">
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Complete Your Order</h3>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-700">Selected Mechanism:</span>
                      <span className="font-semibold text-gray-900">{selectedMechanism.displayName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-700">Quantity:</span>
                      <span className="font-semibold text-gray-900">{comparisonData.quantityOz.toFixed(2)} oz</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-700">Price per oz:</span>
                      <span className="font-semibold text-gray-900">${selectedMechanism.pricePerOz.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-blue-200 pt-2">
                      <span className="text-base font-semibold text-gray-700">Total Value:</span>
                      <span className="text-xl font-bold text-blue-900">
                      ${selectedMechanism.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Customer <span className="text-red-500">*</span>
                      </label>
                      <Select
                      value={selectedCustomer}
                      onChange={(e) => setSelectedCustomer(e.target.value)}
                      >
                      <option value="">Choose a customer...</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} ({customer.country})
                        </option>
                      ))}
                      </Select>
                    </div>

                    {selectedMechanism.mechanism === 'in_process' && (
                      <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Refinery <span className="text-red-500">*</span>
                      </label>
                      <Select
                        value={selectedRefinery}
                        onChange={(e) => setSelectedRefinery(e.target.value)}
                      >
                        <option value="">Choose a refinery...</option>
                        {refineries.map((refinery) => (
                          <option key={refinery.id} value={refinery.id}>
                            {refinery.refinery_name} - {refinery.refinery_location}
                          </option>
                        ))}
                      </Select>
                      </div>
                    )}

                    <Button
                      onClick={handleCreateSale}
                      disabled={processingOrder || !selectedCustomer || (selectedMechanism.mechanism === 'in_process' && !selectedRefinery)}
                      className="w-full"
                      size="lg"
                    >
                      {processingOrder ? 'Processing Order...' : 'Create Gold Sale Order'}
                    </Button>
                  </div>
                </div>
              </Card>
            )}

          {/* Trading Information Card */}
          <Card className="bg-amber-50 border-amber-200">
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertCircle className="w-5 h-5" />
                <h4 className="font-semibold">Trading Information</h4>
              </div>
              <div className="text-xs text-amber-900 space-y-2">
                <p><strong>Available Stock:</strong> {availableStock.toFixed(2)} oz</p>
                <p><strong>Trading Hours:</strong> 7:30 AM - 4:30 PM EST</p>
                <p><strong>Order Type:</strong> Good Until Cancelled</p>
                <p className="border-t border-amber-200 pt-2 mt-2">
                  All orders are subject to management approval and market conditions
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
