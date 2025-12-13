import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Building2,
  MapPin,
  Package,
  ArrowRight,
  Sparkles,
  CircleDollarSign,
} from 'lucide-react';
import {
  calculatePricingComparison,
  getQuantityRecommendation,
  getApprovedRefineries,
  createGoldSale,
  type PricingMechanism,
  type QuantityRecommendation,
} from '@/services/goldTradeSpaceService';
import { getInventoryBySeller } from '@/services/inventoryService';
import { supabase } from '@/lib/supabase';
import { useAlert } from '@/hooks/useAlert';

interface Customer {
  id: string;
  name: string;
  email: string;
  country: string;
}

interface MiningCompany {
  id: string;
  name: string;
  abbreviation: string;
  country: string;
}

interface MiningCompanyWithStock extends MiningCompany {
  availableStock: number;
  loading: boolean;
}

export function GoldTradeSpace() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useAlert();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [refineries, setRefineries] = useState<any[]>([]);
  const [miningCompaniesWithStock, setMiningCompaniesWithStock] = useState<MiningCompanyWithStock[]>([]);
  const [totalStock, setTotalStock] = useState(0);

  const [selectedMiningCompany, setSelectedMiningCompany] = useState('');
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

  useEffect(() => {
    if (selectedMiningCompany) {
      fetchInventoryByMiningCompany();
    }
  }, [selectedMiningCompany]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [customersRes, refineriesRes, miningCompaniesRes] = await Promise.all([
        supabase.from('customers').select('id, name, email, country').order('name'),
        getApprovedRefineries(),
        supabase.from('mining_companies').select('id, name, abbreviation, country').eq('is_active', true).order('name'),
      ]);

      if (customersRes.data) {
        setCustomers(customersRes.data);
      }

      if (refineriesRes.success && refineriesRes.data) {
        setRefineries(refineriesRes.data);
      }

      if (miningCompaniesRes.data) {
        const companiesWithStock: MiningCompanyWithStock[] = miningCompaniesRes.data.map(company => ({
          ...company,
          availableStock: 0,
          loading: true,
        }));
        setMiningCompaniesWithStock(companiesWithStock);

        await fetchAllMiningCompaniesStock(miningCompaniesRes.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showError('Failed to load marketplace data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllMiningCompaniesStock = async (companies: MiningCompany[]) => {
    let total = 0;

    for (const company of companies) {
      try {
        const result = await getInventoryBySeller(company.id, 'mining_company');

        if (result.success) {
          const stockOz = result.availableOz || 0;
          total += stockOz;

          setMiningCompaniesWithStock(prev =>
            prev.map(c =>
              c.id === company.id
                ? { ...c, availableStock: stockOz, loading: false }
                : c
            )
          );
        } else {
          setMiningCompaniesWithStock(prev =>
            prev.map(c =>
              c.id === company.id
                ? { ...c, availableStock: 0, loading: false }
                : c
            )
          );
        }
      } catch (error) {
        console.error(`Error fetching stock for ${company.name}:`, error);
        setMiningCompaniesWithStock(prev =>
          prev.map(c =>
            c.id === company.id
              ? { ...c, availableStock: 0, loading: false }
              : c
          )
        );
      }
    }

    setTotalStock(total);
  };

  const fetchInventoryByMiningCompany = async () => {
    if (!selectedMiningCompany) {
      setAvailableStock(0);
      setQuantityRecommendation(null);
      return;
    }

    try {
      // Use the proper service to get inventory by seller
      // This follows the chain: production -> freight_shipments -> gold_inventory
      const result = await getInventoryBySeller(selectedMiningCompany, 'mining_company');

      if (result.success) {
        const totalStock = result.availableOz || 0;
        setAvailableStock(totalStock);

        if (totalStock > 0) {
          const recResult = await getQuantityRecommendation(totalStock);
          if (recResult.success && recResult.data) {
            setQuantityRecommendation(recResult.data);
          }
        } else {
          setQuantityRecommendation(null);
        }
      } else {
        console.error('Error fetching inventory:', result.error);
        setAvailableStock(0);
        setQuantityRecommendation(null);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      setAvailableStock(0);
      setQuantityRecommendation(null);
    }
  };

  const handleMechanismSelect = (mechanism: PricingMechanism) => {
    setSelectedMechanism(mechanism);
  };

  const handleCreateSale = () => {
    if (!selectedMechanism || !comparisonData) {
      showError('Please complete the simulation first');
      return;
    }

    // Navigate to sale creation with pre-filled data
    navigate('/sales/new', {
      state: {
        mechanismData: selectedMechanism,
        quantityOz: comparisonData.quantityOz,
        availableStockOz: availableStock,
        preselectedSellerId: selectedMiningCompany,
        lockSeller: true,
        preselectedCustomerId: selectedCustomer || null,
      }
    });
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
            isPanelCollapsed ? 'mr-0 max-w-full' : 'mr-80 max-w-6xl'
          }`}
        >
          {/* Mining Company Selection with Elegant Tiles */}
          {!selectedMiningCompany ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="w-8 h-8 text-amber-600" />
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Sélectionnez une Mine</h2>
                    <p className="text-gray-600">Cliquez sur une tuile pour voir le stock disponible et créer une simulation</p>
                  </div>
                </div>
              </div>

              {/* Global Overview Card - Compact */}
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 shadow-xl">
                <div className="absolute inset-0 bg-grid-white/10"></div>
                <div className="relative p-5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-100" />
                        <p className="text-amber-100 font-semibold text-xs uppercase tracking-wide">Stock Total Disponible</p>
                      </div>
                      <h3 className="text-3xl font-bold text-white tracking-tight">
                        {totalStock.toFixed(3)} <span className="text-xl text-amber-100">oz</span>
                      </h3>
                      <p className="text-amber-100 text-sm">
                        {(totalStock * 31.1035).toFixed(2)} grammes
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <CircleDollarSign className="w-4 h-4 text-amber-200" />
                        <p className="text-amber-100 text-xs">
                          {miningCompaniesWithStock.filter(c => c.availableStock > 0).length} mines actives
                        </p>
                      </div>
                    </div>
                    <div className="hidden md:block">
                      <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Package className="w-10 h-10 text-white" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-orange-400/20 rounded-full blur-3xl"></div>
              </div>

              {/* Individual Mining Company Cards - Compact & Sorted */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {miningCompaniesWithStock
                  .sort((a, b) => b.availableStock - a.availableStock)
                  .map((company) => (
                  <button
                    key={company.id}
                    onClick={() => {
                      setSelectedMiningCompany(company.id);
                      setAvailableStock(company.availableStock);
                    }}
                    disabled={company.loading || company.availableStock === 0}
                    className={`group relative overflow-hidden rounded-xl p-4 text-left transition-all duration-300 ${
                      company.availableStock > 0
                        ? 'bg-gradient-to-br from-slate-50 to-blue-50 border-2 border-slate-200 hover:border-blue-400 hover:shadow-xl hover:scale-105 cursor-pointer'
                        : 'bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 cursor-not-allowed opacity-60'
                    }`}
                  >
                    {/* Background decoration */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    {/* Content */}
                    <div className="relative z-10 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg ${
                              company.availableStock > 0
                                ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                                : 'bg-gradient-to-br from-gray-400 to-gray-500'
                            }`}>
                              {company.abbreviation}
                            </div>
                          </div>
                          <h3 className="text-sm font-bold text-gray-900 leading-tight mb-1">
                            {company.name}
                          </h3>
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <MapPin className="w-3 h-3" />
                            <span>{company.country}</span>
                          </div>
                        </div>
                        {company.availableStock > 0 && (
                          <div className="bg-green-100 text-green-700 rounded-full p-1.5 group-hover:scale-110 transition-transform">
                            <CheckCircle className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>

                      {/* Stock Information */}
                      <div className="space-y-1">
                        {company.loading ? (
                          <div className="flex items-center gap-2 text-gray-500">
                            <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
                            <span className="text-xs">Chargement...</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-baseline gap-1">
                              <span className="text-xs text-gray-600 font-medium">Stock disponible:</span>
                            </div>
                            <div className="space-y-0.5">
                              <p className={`text-2xl font-bold ${
                                company.availableStock > 0 ? 'text-blue-700' : 'text-gray-400'
                              }`}>
                                {company.availableStock.toFixed(3)}
                                <span className="text-base text-gray-500 ml-1">oz</span>
                              </p>
                              <p className="text-xs text-gray-600">
                                {(company.availableStock * 31.1035).toFixed(2)} grammes
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Action hint */}
                      {company.availableStock > 0 && (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs text-blue-600 font-medium group-hover:text-blue-700">
                            Voir la simulation
                          </span>
                          <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
                        </div>
                      )}

                      {company.availableStock === 0 && !company.loading && (
                        <div className="flex items-center gap-1 text-gray-500 text-xs pt-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Aucun stock disponible</span>
                        </div>
                      )}
                    </div>

                    {/* Hover glow effect */}
                    {company.availableStock > 0 && (
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-400/20 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-400/20 rounded-full blur-3xl"></div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Store className="w-6 h-6 text-blue-600" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Mine Sélectionnée</h3>
                      <p className="text-sm text-gray-600">
                        {miningCompaniesWithStock.find(c => c.id === selectedMiningCompany)?.name}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedMiningCompany('');
                      setAvailableStock(0);
                      setQuantityRecommendation(null);
                      setSelectedMechanism(null);
                      setComparisonData(null);
                    }}
                    variant="secondary"
                    size="sm"
                  >
                    Changer de mine
                  </Button>
                </div>

                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Stock Disponible</p>
                      <p className={`text-2xl font-bold ${availableStock > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
                        {availableStock.toFixed(3)} oz
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(availableStock * 31.1035).toFixed(2)} g
                      </p>
                    </div>
                    {availableStock > 0 && (
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {quantityRecommendation && selectedMiningCompany && (
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

            {selectedMiningCompany && availableStock > 0 && (
              <PricingCalculator
                availableStockOz={availableStock}
                miningCompanyId={selectedMiningCompany}
                onMechanismSelect={(mechanism, comparison) => {
                  handleMechanismSelect(mechanism);
                  handleCalculationComplete(comparison);
                }}
              />
            )}

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
                      disabled={!comparisonData || (selectedMechanism.mechanism === 'in_process' && !selectedRefinery)}
                      className="w-full"
                      size="lg"
                    >
                      Proceed to Sale Form
                    </Button>
                  </div>
                </div>
              </Card>
            )}

          {/* Trading Information Card */}
          {selectedMiningCompany && (
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
          )}
        </div>
      </div>
    </MainLayout>
  );
}
